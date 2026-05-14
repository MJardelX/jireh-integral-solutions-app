/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { PaymentMethod } from '@/types/payment';

// ─── Input shapes ──────────────────────────────────────────────────────────────

interface ImportClient {
  nombre: string;
  apellido: string;
  telefono: string;
  correo?: string;
  direccion: string;
  notas?: string;
  activo?: boolean | string;
}

interface ImportContract {
  telefono_cliente: string;
  plan: string;
  precio_especial?: number | null;
  dia_cobro?: number;
  fecha_inicio?: string;
  estado?: string;
}

interface ImportInvoice {
  telefono_cliente: string;
  plan: string;
  mes_referencia: string; // YYYY-MM
  monto: number;
  fecha_vencimiento?: string;
  estado?: string;
}

interface ImportPayment {
  telefono_cliente: string;
  monto: number;
  fecha_pago: string;
  metodo: PaymentMethod;
  notas?: string;
  meses_cubiertos?: string; // comma-separated YYYY-MM
}

interface ImportPayload {
  clients: ImportClient[];
  contracts: ImportContract[];
  invoices: ImportInvoice[];
  payments: ImportPayment[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapStatus(val: string | undefined, map: Record<string, string>, fallback: string): string {
  if (!val) return fallback;
  return map[val.toLowerCase().trim()] ?? fallback;
}

function isActive(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  const s = String(val).toLowerCase().trim();
  return s !== 'false' && s !== '0' && s !== 'no' && s !== 'inactivo';
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: ImportPayload = await req.json();
  const db = createAdminClient();

  const result = {
    clients:   { created: 0, updated: 0, errors: [] as string[] },
    contracts: { created: 0, errors: [] as string[] },
    invoices:  { created: 0, skipped: 0, errors: [] as string[] },
    payments:  { created: 0, errors: [] as string[] },
  };

  // Pre-load plans
  const { data: allPlans } = await db.from('service_plans').select('id, name');
  const planMap = new Map<string, string>();
  for (const p of allPlans ?? []) planMap.set(p.name.toLowerCase().trim(), p.id);

  // Maps built during import (phone → id, phone:planId → contractId, etc.)
  const phoneToClientId = new Map<string, string>();
  const contractKey = (phone: string, planId: string) => `${phone}::${planId}`;
  const phoneAndPlanToContractId = new Map<string, string>();
  const invoiceKey = (phone: string, ym: string) => `${phone}::${ym}`;
  const phoneAndMonthToInvoiceId = new Map<string, string>();

  // ── 1. Seed phoneToClientId from existing clients ──────────────────────────
  const inputPhones = [...new Set(body.clients.map((c) => c.telefono?.trim()).filter(Boolean))];
  if (inputPhones.length) {
    const { data: existing } = await db.from('clients').select('id, phone').in('phone', inputPhones);
    for (const c of existing ?? []) phoneToClientId.set(c.phone, c.id);
  }

  // ── 2. Clients ─────────────────────────────────────────────────────────────
  for (const c of body.clients ?? []) {
    const phone = c.telefono?.trim();
    if (!c.nombre?.trim() || !c.apellido?.trim() || !phone || !c.direccion?.trim()) {
      result.clients.errors.push(`Datos incompletos: ${phone ?? 'sin teléfono'}`);
      continue;
    }
    try {
      if (phoneToClientId.has(phone)) {
        await db.from('clients').update({
          first_name: c.nombre.trim(),
          last_name:  c.apellido.trim(),
          email:      c.correo?.trim() || null,
          address:    c.direccion.trim(),
          notes:      c.notas?.trim() || null,
          is_active:  isActive(c.activo),
        }).eq('phone', phone);
        result.clients.updated++;
      } else {
        const { data, error } = await db.from('clients').insert({
          first_name: c.nombre.trim(),
          last_name:  c.apellido.trim(),
          phone,
          email:     c.correo?.trim() || null,
          address:   c.direccion.trim(),
          notes:     c.notas?.trim() || null,
          is_active: isActive(c.activo),
        }).select('id').single();
        if (error) throw error;
        phoneToClientId.set(phone, data.id);
        result.clients.created++;
      }
    } catch (err: any) {
      result.clients.errors.push(`${phone}: ${err.message}`);
    }
  }

  // ── 3. Contracts ───────────────────────────────────────────────────────────
  const contractStatusMap: Record<string, string> = { activo: 'active', suspendido: 'suspended', cancelado: 'cancelled' };

  for (const c of body.contracts ?? []) {
    const phone = c.telefono_cliente?.trim();
    const clientId = phone ? phoneToClientId.get(phone) : undefined;
    if (!clientId) { result.contracts.errors.push(`Cliente no encontrado: ${phone}`); continue; }

    const planId = planMap.get(c.plan?.toLowerCase().trim());
    if (!planId) { result.contracts.errors.push(`Plan no encontrado: "${c.plan}" (cliente ${phone})`); continue; }

    try {
      const { data, error } = await db.from('contracts').insert({
        client_id:     clientId,
        plan_id:       planId,
        special_price: c.precio_especial ?? null,
        due_day:       c.dia_cobro ?? 10,
        start_date:    c.fecha_inicio ?? new Date().toISOString().slice(0, 10),
        status:        mapStatus(c.estado, contractStatusMap, 'active'),
      }).select('id').single();
      if (error) throw error;
      phoneAndPlanToContractId.set(contractKey(phone, planId), data.id);
      result.contracts.created++;
    } catch (err: any) {
      result.contracts.errors.push(`${phone} - ${c.plan}: ${err.message}`);
    }
  }

  // ── 4. Invoices ────────────────────────────────────────────────────────────
  const invoiceStatusMap: Record<string, string> = { pendiente: 'pending', pagada: 'paid', vencida: 'overdue', cancelada: 'cancelled' };

  for (const inv of body.invoices ?? []) {
    const phone = inv.telefono_cliente?.trim();
    const clientId = phone ? phoneToClientId.get(phone) : undefined;
    if (!clientId) { result.invoices.errors.push(`Cliente no encontrado: ${phone}`); continue; }

    const planId = planMap.get(inv.plan?.toLowerCase().trim());
    if (!planId) { result.invoices.errors.push(`Plan no encontrado: "${inv.plan}" (${phone})`); continue; }

    // Find contractId — first from this import's map, then from DB
    let cId = phoneAndPlanToContractId.get(contractKey(phone, planId));
    if (!cId) {
      const { data: found } = await db.from('contracts').select('id')
        .eq('client_id', clientId).eq('plan_id', planId).limit(1).maybeSingle();
      if (!found) { result.invoices.errors.push(`Contrato no encontrado: ${phone} - ${inv.plan}`); continue; }
      cId = found.id as string;
      phoneAndPlanToContractId.set(contractKey(phone, planId), cId);
    }

    // Normalize reference_month to YYYY-MM-01
    const ym = inv.mes_referencia?.trim().substring(0, 7); // YYYY-MM
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) { result.invoices.errors.push(`Mes inválido: "${inv.mes_referencia}" (${phone})`); continue; }
    const refMonth = `${ym}-01`;

    // Skip if already exists
    const { data: existing } = await db.from('invoices').select('id')
      .eq('contract_id', cId).eq('reference_month', refMonth).maybeSingle();
    if (existing) {
      phoneAndMonthToInvoiceId.set(invoiceKey(phone, ym), existing.id);
      result.invoices.skipped++;
      continue;
    }

    try {
      const { data, error } = await db.from('invoices').insert({
        contract_id:     cId,
        reference_month: refMonth,
        due_date:        inv.fecha_vencimiento ?? `${ym}-15`,
        amount:          Number(inv.monto),
        status:          mapStatus(inv.estado, invoiceStatusMap, 'pending'),
      }).select('id').single();
      if (error) throw error;
      phoneAndMonthToInvoiceId.set(invoiceKey(phone, ym), data.id);
      result.invoices.created++;
    } catch (err: any) {
      result.invoices.errors.push(`${phone} ${ym}: ${err.message}`);
    }
  }

  // ── 5. Payments ────────────────────────────────────────────────────────────
  const VALID_METHODS: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta_de_credito', 'tarjeta_de_debito'];

  for (const p of body.payments ?? []) {
    const phone = p.telefono_cliente?.trim();
    const clientId = phone ? phoneToClientId.get(phone) : undefined;
    if (!clientId) { result.payments.errors.push(`Cliente no encontrado: ${phone}`); continue; }

    const method = p.metodo?.trim() as PaymentMethod;
    if (!VALID_METHODS.includes(method)) {
      result.payments.errors.push(`Método inválido: "${p.metodo}" (${phone})`); continue;
    }

    const meses = p.meses_cubiertos
      ? p.meses_cubiertos.split(',').map((m) => m.trim().substring(0, 7)).filter((m) => /^\d{4}-\d{2}$/.test(m))
      : [];

    try {
      const { data: pay, error: payErr } = await db.from('payments').insert({
        client_id:      clientId,
        total_amount:   Number(p.monto),
        payment_method: method,
        payment_date:   p.fecha_pago,
        notes:          p.notas?.trim() || null,
        created_by:     userId,
      }).select('id').single();
      if (payErr) throw payErr;

      // Link to invoices
      for (const ym of meses) {
        // Check in-memory map first
        let invoiceId = phoneAndMonthToInvoiceId.get(invoiceKey(phone, ym));

        // If not found, query DB via join contracts → invoices
        if (!invoiceId) {
          const { data: contractIds } = await db.from('contracts').select('id').eq('client_id', clientId);
          if (contractIds?.length) {
            const { data: found } = await db.from('invoices').select('id')
              .in('contract_id', contractIds.map((c) => c.id))
              .eq('reference_month', `${ym}-01`).maybeSingle();
            if (found) invoiceId = found.id;
          }
        }

        if (!invoiceId) continue;

        const { data: invAmt } = await db.from('invoices').select('amount').eq('id', invoiceId).single();
        await db.from('payment_items').insert({ payment_id: pay.id, invoice_id: invoiceId, amount_applied: invAmt?.amount ?? Number(p.monto) });
        await db.from('invoices').update({ status: 'paid' }).eq('id', invoiceId);
      }

      result.payments.created++;
    } catch (err: any) {
      result.payments.errors.push(`${phone} ${p.fecha_pago}: ${err.message}`);
    }
  }

  return NextResponse.json(result);
}
