'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, X } from 'lucide-react';
import { Paginator } from '@/components/ui/paginator';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';
import { Button } from '@/components/ui/button';
import type { ServicePlan, PlanRecurrence } from '@/types/plan';
import { RECURRENCE_LABELS } from '@/types/plan';

const RECURRENCES: PlanRecurrence[] = ['monthly', 'quarterly', 'semiannual', 'annual'];

const EMPTY_FORM = { name: '', description: '', price: '', recurrence: 'monthly' as PlanRecurrence, is_active: true };

function fmtPrice(n: number) {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n);
}

export default function PlansPage() {
  const t = useT();
  const { user, authFetch } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [plans,     setPlans]     = useState<ServicePlan[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [showAll,   setShowAll]   = useState(false);
  const [page,      setPage]      = useState(1);
  const PAGE_SIZE = 20;

  const [open,      setOpen]      = useState(false);
  const [editing,   setEditing]   = useState<ServicePlan | null>(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (all = showAll) => {
    setLoading(true); setError(null);
    try {
      const res = await authFetch(`/api/plans?active=${all ? 'all' : 'true'}`);
      if (!res.ok) throw new Error('Failed to load plans');
      const { plans: data } = await res.json();
      setPlans(data);
      setPage(1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unknown error'); }
    finally { setLoading(false); }
  }, [authFetch, showAll]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setFormError(null); setOpen(true);
  }
  function openEdit(p: ServicePlan) {
    setEditing(p);
    setForm({ name: p.name, description: p.description ?? '', price: String(p.price), recurrence: p.recurrence, is_active: p.is_active });
    setFormError(null); setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const payload = { ...form, price: parseFloat(form.price) };
      const res = editing
        ? await authFetch(`/api/plans/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await authFetch('/api/plans', { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      setOpen(false);
      await load(showAll);
    } catch (e) { setFormError(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  const canSubmit = form.name.trim() !== '' && form.price !== '' && parseFloat(form.price) >= 0;

  const colHeaders = [t.plans.colName, t.plans.colDescription, t.plans.colPrice, t.plans.colRecurrence, t.plans.colStatus, ''];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-popover-foreground">{t.plans.title}</h1>
          <p className="mt-0.5 text-sm text-muted">{plans.length} {showAll ? t.plans.totalCount : t.plans.activeCount}</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> {t.plans.addPlan}
          </Button>
        )}
      </div>

      <div className="mb-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted select-none">
          <input type="checkbox" checked={showAll} onChange={(e) => { setShowAll(e.target.checked); load(e.target.checked); }} className="accent-primary" />
          {t.common.showInactive}
        </label>
      </div>

      {error && <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-border bg-popover">
        {loading ? (
          <PlansTableSkeleton colHeaders={colHeaders} />
        ) : plans.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted">{t.plans.noPlans}</div>
        ) : (
          <>
            {/* ── Mobile: card list ─────────────────────────────────────── */}
            <ul className="divide-y divide-border sm:hidden">
              {plans.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-popover-foreground truncate">{p.name}</span>
                      <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-border text-muted'}`}>
                        {p.is_active ? t.common.active : t.common.inactive}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-primary">{fmtPrice(p.price)}<span className="ml-1 font-normal text-muted">/ {RECURRENCE_LABELS[p.recurrence]}</span></p>
                    {p.description && <p className="mt-0.5 text-xs text-muted truncate">{p.description}</p>}
                  </div>
                  {isAdmin && (
                    <button onClick={() => openEdit(p)} className="shrink-0 rounded-md p-1.5 text-muted hover:bg-border/60 hover:text-popover-foreground" title={t.common.edit}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {/* ── Desktop: table ────────────────────────────────────────── */}
            <table className="hidden w-full text-sm sm:table">
              <thead className="border-b border-border bg-background/40">
                <tr>
                  {colHeaders.map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plans.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((p) => (
                  <tr key={p.id} className="hover:bg-border/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-popover-foreground">{p.name}</td>
                    <td className="px-4 py-3 text-muted max-w-xs truncate">{p.description ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-popover-foreground">{fmtPrice(p.price)}</td>
                    <td className="px-4 py-3 text-muted">{RECURRENCE_LABELS[p.recurrence]}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-border text-muted'}`}>
                        {p.is_active ? t.common.active : t.common.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin && (
                        <button onClick={() => openEdit(p)} className="rounded-md p-1.5 text-muted hover:bg-border/60 hover:text-popover-foreground" title={t.common.edit}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <Paginator
        page={page}
        total={plans.length}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />

      {open && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-popover p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-popover-foreground">{editing ? t.plans.editTitle : t.plans.newTitle}</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted hover:text-popover-foreground"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {(['name'] as const).map((k) => (
                <div key={k}>
                  <label className="mb-1 block text-xs font-medium text-muted capitalize">{t.plans.nameLabel} *</label>
                  <input required value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15" />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t.common.description}</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2}
                  className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">{t.plans.priceLabel} *</label>
                  <input required type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">{t.plans.recurrenceLabel} *</label>
                  <select value={form.recurrence} onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value as PlanRecurrence }))}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15">
                    {RECURRENCES.map((r) => <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>)}
                  </select>
                </div>
              </div>
              {editing && (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-popover-foreground">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="accent-primary" />
                  {t.plans.activeToggle}
                </label>
              )}
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
                <Button type="submit" disabled={saving || !canSubmit}>{saving ? t.common.saving : editing ? t.clients.saveChanges : t.plans.addPlan}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const SK = [
  { name: 'w-36', desc: 'w-48', price: 'w-16', rec: 'w-20' },
  { name: 'w-28', desc: 'w-60', price: 'w-14', rec: 'w-24' },
  { name: 'w-44', desc: 'w-40', price: 'w-16', rec: 'w-20' },
  { name: 'w-32', desc: 'w-52', price: 'w-12', rec: 'w-20' },
];

function PlansTableSkeleton({ colHeaders }: { colHeaders: string[] }) {
  return (
    <>
      {/* Mobile */}
      <ul className="divide-y divide-border sm:hidden">
        {SK.map((w, i) => (
          <li key={i} className="flex items-start justify-between gap-3 px-4 py-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className={`skeleton h-4 rounded ${w.name}`} />
                <div className="skeleton h-5 w-14 rounded-full" />
              </div>
              <div className={`skeleton h-4 rounded ${w.price}`} />
              <div className={`skeleton h-3 rounded ${w.desc}`} />
            </div>
            <div className="skeleton h-7 w-7 rounded-md" />
          </li>
        ))}
      </ul>

      {/* Desktop */}
      <table className="hidden w-full text-sm sm:table">
        <thead className="border-b border-border bg-background/40">
          <tr>
            {colHeaders.map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {SK.map((w, i) => (
            <tr key={i}>
              <td className="px-4 py-3"><div className={`skeleton h-4 rounded ${w.name}`} /></td>
              <td className="px-4 py-3"><div className={`skeleton h-4 rounded ${w.desc}`} /></td>
              <td className="px-4 py-3"><div className={`skeleton h-4 rounded ${w.price}`} /></td>
              <td className="px-4 py-3"><div className={`skeleton h-4 rounded ${w.rec}`} /></td>
              <td className="px-4 py-3"><div className="skeleton h-5 w-14 rounded-full" /></td>
              <td className="px-4 py-3"><div className="skeleton h-7 w-7 rounded-md ml-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
