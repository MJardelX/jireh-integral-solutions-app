'use client';

import { useCallback, useRef, useState } from 'react';
import { read, utils, writeFile } from 'xlsx';
import { FileUp, Download, CheckCircle, AlertTriangle, Loader2, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedData {
  clients:   Record<string, unknown>[];
  contracts: Record<string, unknown>[];
  invoices:  Record<string, unknown>[];
  payments:  Record<string, unknown>[];
}

interface ImportResult {
  clients:   { created: number; updated: number; errors: string[] };
  contracts: { created: number; errors: string[] };
  invoices:  { created: number; skipped: number; errors: string[] };
  payments:  { created: number; errors: string[] };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(serial: unknown): string {
  // Excel sometimes stores dates as serial numbers
  if (typeof serial === 'number') {
    const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  return String(serial ?? '');
}

function parseSheet(wb: ReturnType<typeof read>, sheetName: string): Record<string, unknown>[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
}

// ─── Template download ────────────────────────────────────────────────────────

function downloadTemplate() {
  const wb = utils.book_new();

  const sheets: { name: string; headers: string[]; sample: unknown[] }[] = [
    {
      name: 'Clientes',
      headers: ['nombre', 'apellido', 'telefono', 'correo', 'direccion', 'notas', 'activo'],
      sample:  ['Juan', 'García', '5555-1234', 'juan@email.com', 'Zona 1, Ciudad', '', 'TRUE'],
    },
    {
      name: 'Contratos',
      headers: ['telefono_cliente', 'plan', 'precio_especial', 'dia_cobro', 'fecha_inicio', 'estado'],
      sample:  ['5555-1234', 'Plan Básico', '', '15', '2024-01-01', 'activo'],
    },
    {
      name: 'Facturas',
      headers: ['telefono_cliente', 'plan', 'mes_referencia', 'monto', 'fecha_vencimiento', 'estado'],
      sample:  ['5555-1234', 'Plan Básico', '2024-01', '150', '2024-01-15', 'pagada'],
    },
    {
      name: 'Pagos',
      headers: ['telefono_cliente', 'monto', 'fecha_pago', 'metodo', 'notas', 'meses_cubiertos'],
      sample:  ['5555-1234', '150', '2024-01-20', 'efectivo', '', '2024-01'],
    },
  ];

  for (const { name, headers, sample } of sheets) {
    const ws = utils.aoa_to_sheet([headers, sample]);
    // Column widths
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    utils.book_append_sheet(wb, ws, name);
  }

  writeFile(wb, 'plantilla_importacion_jireh.xlsx');
}

// ─── Component ────────────────────────────────────────────────────────────────

type Step = 'upload' | 'preview' | 'result';

export default function ImportPage() {
  const t = useT();
  const { authFetch } = useAuth();

  const [step,      setStep]      = useState<Step>('upload');
  const [parsed,    setParsed]    = useState<ParsedData | null>(null);
  const [fileName,  setFileName]  = useState('');
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState<ImportResult | null>(null);
  const [parseErr,  setParseErr]  = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    setParseErr(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = read(e.target?.result, { type: 'array' });

        const clients   = parseSheet(wb, 'Clientes');
        const contracts = parseSheet(wb, 'Contratos');
        const invoices  = parseSheet(wb, 'Facturas');
        const payments  = parseSheet(wb, 'Pagos');

        setParsed({ clients, contracts, invoices, payments });
        setStep('preview');
      } catch {
        setParseErr(t.import.parseError);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [t]);

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function handleImport() {
    if (!parsed) return;
    setImporting(true);
    try {
      // Normalize date fields that Excel might return as serial numbers
      const payments = parsed.payments.map((p) => ({
        ...p,
        fecha_pago:  fmtDate(p.fecha_pago),
        meses_cubiertos: String(p.meses_cubiertos ?? ''),
      }));
      const contracts = parsed.contracts.map((c) => ({
        ...c,
        fecha_inicio: c.fecha_inicio ? fmtDate(c.fecha_inicio) : undefined,
      }));
      const invoices = parsed.invoices.map((inv) => ({
        ...inv,
        fecha_vencimiento: inv.fecha_vencimiento ? fmtDate(inv.fecha_vencimiento) : undefined,
      }));

      const res = await authFetch('/api/import', {
        method: 'POST',
        body: JSON.stringify({ clients: parsed.clients, contracts, invoices, payments }),
      });
      const data = await res.json();
      setResult(data);
      setStep('result');
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setParsed(null);
    setResult(null);
    setFileName('');
    setParseErr(null);
    setStep('upload');
  }

  const totalErrors = result
    ? result.clients.errors.length + result.contracts.errors.length + result.invoices.errors.length + result.payments.errors.length
    : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-popover-foreground">{t.import.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.import.subtitle}</p>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2 text-sm">
        {([
          { id: 'upload',  label: t.import.step1 },
          { id: 'preview', label: t.import.step2 },
          { id: 'result',  label: t.import.step3 },
        ] as { id: Step; label: string }[]).map(({ id, label }, i) => (
          <div key={id} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted/40" />}
            <span className={`font-medium ${step === id ? 'text-primary' : step > id ? 'text-muted' : 'text-muted/40'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Step 1: Upload ────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="space-y-6">
          {/* Template download */}
          <div className="rounded-2xl border border-border bg-popover p-6">
            <h2 className="mb-1 font-semibold text-popover-foreground">{t.import.templateTitle}</h2>
            <p className="mb-4 text-sm text-muted">{t.import.templateDesc}</p>
            <Button variant="outline" onClick={downloadTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              {t.import.downloadTemplate}
            </Button>
          </div>

          {/* Format reference */}
          <div className="rounded-2xl border border-border bg-popover p-6">
            <h2 className="mb-3 font-semibold text-popover-foreground">{t.import.formatTitle}</h2>
            <div className="space-y-3 text-sm text-muted">
              {[
                { sheet: 'Clientes',   cols: 'nombre, apellido, telefono*, correo, direccion*, notas, activo' },
                { sheet: 'Contratos',  cols: 'telefono_cliente*, plan*, precio_especial, dia_cobro, fecha_inicio, estado' },
                { sheet: 'Facturas',   cols: 'telefono_cliente*, plan*, mes_referencia* (AAAA-MM), monto*, fecha_vencimiento, estado' },
                { sheet: 'Pagos',      cols: 'telefono_cliente*, monto*, fecha_pago* (AAAA-MM-DD), metodo*, notas, meses_cubiertos' },
              ].map(({ sheet, cols }) => (
                <div key={sheet}>
                  <span className="font-medium text-popover-foreground">{sheet}:</span>
                  <span className="ml-2 font-mono text-xs">{cols}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              * {t.import.requiredNote} · metodo: efectivo | transferencia | tarjeta_de_credito | tarjeta_de_debito
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={[
              'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 transition-colors',
              dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-border/20',
            ].join(' ')}
          >
            <FileUp className="h-8 w-8 text-muted" />
            <div className="text-center">
              <p className="font-medium text-popover-foreground">{t.import.dropzone}</p>
              <p className="mt-0.5 text-sm text-muted">{t.import.fileTypes}</p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onInputChange} />
          </div>

          {parseErr && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{parseErr}</p>
          )}
        </div>
      )}

      {/* ── Step 2: Preview ───────────────────────────────────────────────── */}
      {step === 'preview' && parsed && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-popover p-6">
            <h2 className="mb-4 font-semibold text-popover-foreground">{t.import.previewTitle}</h2>
            <p className="mb-4 text-sm text-muted">{fileName}</p>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: t.nav.clients,   count: parsed.clients.length,   color: 'text-green-600' },
                { label: t.nav.contracts, count: parsed.contracts.length, color: 'text-blue-600' },
                { label: t.nav.invoices,  count: parsed.invoices.length,  color: 'text-orange-500' },
                { label: t.nav.payments,  count: parsed.payments.length,  color: 'text-primary' },
              ].map(({ label, count, color }) => (
                <div key={label} className="rounded-xl border border-border p-4 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{count}</p>
                  <p className="mt-0.5 text-xs text-muted">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Preview tables */}
          {[
            { title: 'Clientes',  rows: parsed.clients },
            { title: 'Contratos', rows: parsed.contracts },
            { title: 'Facturas',  rows: parsed.invoices },
            { title: 'Pagos',     rows: parsed.payments },
          ].map(({ title, rows }) => rows.length > 0 && (
            <div key={title} className="rounded-2xl border border-border bg-popover">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-popover-foreground">{title}</h3>
                <p className="text-xs text-muted">{rows.length} {t.import.rows} · {t.import.previewNote}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border bg-background/40">
                    <tr>
                      {Object.keys(rows[0]).map((k) => (
                        <th key={k} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-muted">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-border/20">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="max-w-[140px] truncate px-3 py-2 text-muted">{String(val ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 5 && (
                <p className="px-4 py-2 text-xs text-muted">… y {rows.length - 5} {t.import.moreRows}</p>
              )}
            </div>
          ))}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={reset}>{t.common.cancel}</Button>
            <Button onClick={handleImport} disabled={importing} className="gap-2">
              {importing ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{t.import.importing}</>
              ) : (
                t.import.importBtn
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Result ────────────────────────────────────────────────── */}
      {step === 'result' && result && (
        <div className="space-y-6">
          <div className={`rounded-2xl border p-6 ${totalErrors === 0 ? 'border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-950/20' : 'border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-950/20'}`}>
            <div className="flex items-center gap-3">
              {totalErrors === 0
                ? <CheckCircle className="h-6 w-6 text-green-600" />
                : <AlertTriangle className="h-6 w-6 text-amber-600" />}
              <div>
                <p className="font-semibold text-popover-foreground">
                  {totalErrors === 0 ? t.import.successTitle : t.import.partialTitle}
                </p>
                <p className="text-sm text-muted">
                  {totalErrors === 0 ? t.import.successDesc : `${totalErrors} ${t.import.errorsFound}`}
                </p>
              </div>
            </div>
          </div>

          {/* Result cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              {
                label: t.nav.clients,
                items: [
                  { k: t.import.created, v: result.clients.created, color: 'text-green-600' },
                  { k: t.import.updated, v: result.clients.updated, color: 'text-blue-600' },
                ],
                errors: result.clients.errors,
              },
              {
                label: t.nav.contracts,
                items: [{ k: t.import.created, v: result.contracts.created, color: 'text-green-600' }],
                errors: result.contracts.errors,
              },
              {
                label: t.nav.invoices,
                items: [
                  { k: t.import.created, v: result.invoices.created, color: 'text-green-600' },
                  { k: t.import.skipped, v: result.invoices.skipped, color: 'text-muted' },
                ],
                errors: result.invoices.errors,
              },
              {
                label: t.nav.payments,
                items: [{ k: t.import.created, v: result.payments.created, color: 'text-green-600' }],
                errors: result.payments.errors,
              },
            ].map(({ label, items, errors }) => (
              <div key={label} className="rounded-2xl border border-border bg-popover p-4">
                <p className="mb-3 font-semibold text-popover-foreground">{label}</p>
                <div className="flex flex-wrap gap-4">
                  {items.map(({ k, v, color }) => (
                    <div key={k}>
                      <p className={`text-xl font-bold ${color}`}>{v}</p>
                      <p className="text-xs text-muted">{k}</p>
                    </div>
                  ))}
                </div>
                {errors.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {errors.slice(0, 5).map((e, i) => (
                      <p key={i} className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">{e}</p>
                    ))}
                    {errors.length > 5 && (
                      <p className="text-xs text-muted">… y {errors.length - 5} errores más</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button onClick={reset} variant="outline">{t.import.importMore}</Button>
        </div>
      )}
    </div>
  );
}
