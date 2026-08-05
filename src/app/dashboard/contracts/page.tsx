'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, X, AlertTriangle } from 'lucide-react';
import { Paginator } from '@/components/ui/paginator';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';
import { Button } from '@/components/ui/button';
import { matchesTerm } from '@/lib/search';
import { contractCode } from '@/lib/contracts';
import type { ContractRow, ContractStatus } from '@/types/contract';
import type { Client } from '@/types/client';
import type { ServicePlan } from '@/types/plan';
import { RECURRENCE_LABELS } from '@/types/plan';

const STATUS_COLORS: Record<ContractStatus, string> = {
  active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  suspended: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  cancelled: 'bg-border text-muted',
};

function fmtPrice(n: number) {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n);
}

const EMPTY_FORM = {
  client_id: '', plan_id: '', label: '', special_price: '',
  due_day: '10', start_date: new Date().toISOString().slice(0, 10), notes: '',
};

export default function ContractsPage() {
  const t = useT();
  const { user, authFetch } = useAuth();
  const isAdmin = user?.role === 'admin';

  const STATUS_TABS: { value: ContractStatus | 'all'; label: string }[] = [
    { value: 'all',       label: t.contracts.tabAll       },
    { value: 'active',    label: t.contracts.tabActive    },
    { value: 'suspended', label: t.contracts.tabSuspended },
    { value: 'cancelled', label: t.contracts.tabCancelled },
  ];

  const [contracts,  setContracts]  = useState<ContractRow[]>([]);
  const [clients,    setClients]    = useState<Client[]>([]);
  const [plans,      setPlans]      = useState<ServicePlan[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [statusTab,  setStatusTab]  = useState<ContractStatus | 'all'>('all');
  const [page,       setPage]       = useState(1);
  const PAGE_SIZE = 25;

  const [open,         setOpen]         = useState(false);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [formError,    setFormError]    = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [dropOpen,     setDropOpen]     = useState(false);
  const clientBoxRef = useRef<HTMLDivElement>(null);

  // Inline label editing, so contracts created before labels existed can get one
  const [labelEditing, setLabelEditing] = useState<ContractRow | null>(null);
  const [labelDraft,   setLabelDraft]   = useState('');
  const [savingLabel,  setSavingLabel]  = useState(false);

  // Contracts the selected client already holds — shown before assigning another
  const [clientContracts, setClientContracts] = useState<ContractRow[]>([]);
  const [loadingClientContracts, setLoadingClientContracts] = useState(false);
  const [confirmedExtra, setConfirmedExtra] = useState(false);

  const load = useCallback(async (status: ContractStatus | 'all' = statusTab) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      const [res, cRes, pRes] = await Promise.all([
        authFetch(`/api/contracts?${params}`),
        authFetch('/api/clients'),
        authFetch('/api/plans'),
      ]);
      if (!res.ok) throw new Error('Failed to load contracts');
      const { contracts: data }   = await res.json();
      const { clients: cData }    = await cRes.json();
      const { plans:   pData }    = await pRes.json();
      setContracts(data);
      setClients(cData);
      setPlans(pData);
      setPage(1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unknown error'); }
    finally { setLoading(false); }
  }, [authFetch, statusTab]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clientBoxRef.current && !clientBoxRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredClients = clients.filter((c) =>
    matchesTerm(clientSearch, `${c.first_name} ${c.last_name}`)
  );

  function openAssign() {
    setForm({ ...EMPTY_FORM, start_date: new Date().toISOString().slice(0, 10) });
    setFormError(null); setClientSearch(''); setDropOpen(false);
    setClientContracts([]); setConfirmedExtra(false);
    setOpen(true);
  }

  async function selectClient(clientId: string) {
    setForm((f) => ({ ...f, client_id: clientId }));
    setConfirmedExtra(false);
    setClientContracts([]);
    if (!clientId) return;

    setLoadingClientContracts(true);
    try {
      const res = await authFetch(`/api/contracts?client_id=${clientId}`);
      const { contracts: data } = await res.json();
      setClientContracts(data ?? []);
    } finally {
      setLoadingClientContracts(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const res = await authFetch('/api/contracts', { method: 'POST', body: JSON.stringify(form) });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      setOpen(false);
      await load(statusTab);
    } catch (e) { setFormError(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function saveLabel() {
    if (!labelEditing) return;
    setSavingLabel(true);
    try {
      await authFetch(`/api/contracts/${labelEditing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ label: labelDraft.trim() }),
      });
      setLabelEditing(null);
      await load(statusTab);
    } finally {
      setSavingLabel(false);
    }
  }

  async function changeStatus(id: string, status: ContractStatus) {
    await authFetch(`/api/contracts/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    await load(statusTab);
  }

  async function deleteContract(id: string) {
    if (!confirm('Delete this contract? This cannot be undone.')) return;
    await authFetch(`/api/contracts/${id}`, { method: 'DELETE' });
    await load(statusTab);
  }

  const selectedPlan = plans.find((p) => p.id === form.plan_id);

  // Assigning a second contract is legitimate (two houses, two lines), but it has
  // to be a deliberate choice: the agent confirms after seeing what's already there.
  const activeClientContracts = clientContracts.filter((c) => c.status === 'active');
  const samePlanContract = activeClientContracts.find((c) => c.plan_id === form.plan_id);
  const needsConfirm = activeClientContracts.length > 0;

  const canSubmit = form.client_id !== '' && form.plan_id !== '' && (!needsConfirm || confirmedExtra);

  const colHeaders = [t.contracts.colClient, t.contracts.colPlan, t.contracts.colPrice, t.contracts.colStatus, t.contracts.colDueDay, t.contracts.colStart, ''];

  const statusLabels: Record<ContractStatus, string> = {
    active:    t.contracts.statusActive,
    suspended: t.contracts.statusSuspended,
    cancelled: t.contracts.statusCancelled,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-popover-foreground">{t.contracts.title}</h1>
          <p className="mt-0.5 text-sm text-muted">{contracts.length} {t.contracts.shown}</p>
        </div>
        <Button onClick={openAssign} className="gap-2">
          <Plus className="h-4 w-4" /> {t.contracts.addContract}
        </Button>
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-background/40 p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusTab(tab.value); load(tab.value); }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${statusTab === tab.value ? 'bg-popover text-popover-foreground shadow-sm' : 'text-muted hover:text-popover-foreground'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-border bg-popover">
        {loading ? (
          <ContractsTableSkeleton colHeaders={colHeaders} />
        ) : contracts.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted">{t.contracts.noContracts}</div>
        ) : (
          <>
            {/* ── Mobile: card list ─────────────────────────────────────── */}
            <ul className="divide-y divide-border sm:hidden">
              {contracts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((c) => (
                <li key={c.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-popover-foreground truncate">{c.client_name}</span>
                        <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[c.status]}`}>
                          {statusLabels[c.status]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted">
                        {c.label && <span className="mr-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">{c.label}</span>}
                        {c.plan_name}
                      </p>
                      <p className="mt-0.5 text-sm">
                        <span className="font-medium text-popover-foreground">{fmtPrice(c.effective_price)}</span>
                        {c.special_price !== null && <span className="ml-1 text-xs text-muted">({t.contracts.custom})</span>}
                        <span className="ml-1 text-xs text-muted">/ {RECURRENCE_LABELS[c.plan_recurrence]}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{t.contracts.dueDay} {c.due_day} · {t.contracts.started} {new Date(c.start_date + 'T00:00:00').toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <button onClick={() => { setLabelEditing(c); setLabelDraft(c.label ?? ''); }} className="rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/10">{t.contracts.actionLabel}</button>
                    {c.status !== 'active' && (
                      <button onClick={() => changeStatus(c.id, 'active')} className="rounded-md px-2 py-1 text-xs text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20">{t.contracts.actionActivate}</button>
                    )}
                    {c.status === 'active' && (
                      <button onClick={() => changeStatus(c.id, 'suspended')} className="rounded-md px-2 py-1 text-xs text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/20">{t.contracts.actionSuspend}</button>
                    )}
                    {c.status !== 'cancelled' && (
                      <button onClick={() => changeStatus(c.id, 'cancelled')} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-border/60">{t.contracts.actionCancel}</button>
                    )}
                    {isAdmin && (
                      <button onClick={() => deleteContract(c.id)} className="rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10">{t.contracts.actionDelete}</button>
                    )}
                  </div>
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
                {contracts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((c) => (
                  <tr key={c.id} className="hover:bg-border/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-popover-foreground">{c.client_name}</td>
                    <td className="px-4 py-3 text-muted">
                      {c.label && <span className="mr-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">{c.label}</span>}
                      {c.plan_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-popover-foreground">{fmtPrice(c.effective_price)}</span>
                      {c.special_price !== null && <span className="ml-1 text-xs text-muted">({t.contracts.custom})</span>}
                      <span className="ml-1 text-xs text-muted">/ {RECURRENCE_LABELS[c.plan_recurrence]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[c.status]}`}>
                        {statusLabels[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{t.contracts.dueDay} {c.due_day}</td>
                    <td className="px-4 py-3 text-muted">{new Date(c.start_date + 'T00:00:00').toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setLabelEditing(c); setLabelDraft(c.label ?? ''); }} className="rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/10">{t.contracts.actionLabel}</button>
                        {c.status !== 'active' && (
                          <button onClick={() => changeStatus(c.id, 'active')} className="rounded-md px-2 py-1 text-xs text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20">{t.contracts.actionActivate}</button>
                        )}
                        {c.status === 'active' && (
                          <button onClick={() => changeStatus(c.id, 'suspended')} className="rounded-md px-2 py-1 text-xs text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/20">{t.contracts.actionSuspend}</button>
                        )}
                        {c.status !== 'cancelled' && (
                          <button onClick={() => changeStatus(c.id, 'cancelled')} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-border/60">{t.contracts.actionCancel}</button>
                        )}
                        {isAdmin && (
                          <button onClick={() => deleteContract(c.id)} className="rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10">{t.contracts.actionDelete}</button>
                        )}
                      </div>
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
        total={contracts.length}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />

      {/* Label editor */}
      {labelEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-popover p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-popover-foreground">{t.contracts.labelLabel}</h2>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {labelEditing.client_name} · {labelEditing.plan_name}
                </p>
              </div>
              <button onClick={() => setLabelEditing(null)} className="rounded-md p-1 text-muted hover:text-popover-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              maxLength={40}
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !savingLabel) saveLabel(); }}
              placeholder={t.contracts.labelPlaceholder}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15"
            />
            <p className="mt-1 text-xs text-muted">{t.contracts.labelHint}</p>
            <div className="mt-5 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setLabelEditing(null)}>{t.common.cancel}</Button>
              <Button type="button" disabled={savingLabel} onClick={saveLabel}>
                {savingLabel ? t.common.saving : t.common.save}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-popover p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-popover-foreground">{t.contracts.newTitle}</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted hover:text-popover-foreground"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div ref={clientBoxRef} className="relative">
                <label className="mb-1 block text-xs font-medium text-muted">{t.contracts.clientLabel} *</label>
                <input
                  type="text"
                  autoComplete="off"
                  placeholder={t.contracts.searchClient}
                  value={clientSearch}
                  onFocus={() => setDropOpen(true)}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setDropOpen(true);
                    if (!e.target.value) selectClient('');
                  }}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15"
                />
                {dropOpen && filteredClients.length > 0 && (
                  <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-popover shadow-lg">
                    {filteredClients.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setClientSearch(`${c.first_name} ${c.last_name}`);
                            setDropOpen(false);
                            selectClient(c.id);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-border/40 ${form.client_id === c.id ? 'font-medium text-primary' : 'text-popover-foreground'}`}
                        >
                          {c.first_name} {c.last_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* What this client already has — surfaced before assigning another */}
              {loadingClientContracts && (
                <p className="text-xs text-muted">{t.contracts.loadingClientContracts}</p>
              )}
              {!loadingClientContracts && form.client_id !== '' && clientContracts.length > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {t.contracts.alreadyHasContracts.replace('{n}', String(clientContracts.length))}
                  </p>
                  <ul className="space-y-1">
                    {clientContracts.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-popover-foreground">
                          {c.label ? <span className="font-medium">{c.label} · </span> : null}
                          {c.plan_name}
                          {!c.label && <span className="text-muted"> · {contractCode(c.id)}</span>}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-muted">{fmtPrice(c.effective_price)}</span>
                          <span className={`rounded-full px-1.5 py-0.5 font-medium ${STATUS_COLORS[c.status]}`}>
                            {statusLabels[c.status]}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t.contracts.planLabel} *</label>
                <select required value={form.plan_id} onChange={(e) => setForm((f) => ({ ...f, plan_id: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15">
                  <option value="">{t.contracts.selectPlan}</option>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmtPrice(p.price)} / {RECURRENCE_LABELS[p.recurrence]}</option>)}
                </select>
                {selectedPlan && (
                  <p className="mt-1 text-xs text-muted">{t.contracts.standardPrice} {fmtPrice(selectedPlan.price)}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t.contracts.labelLabel}</label>
                <input
                  type="text"
                  maxLength={40}
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder={t.contracts.labelPlaceholder}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15"
                />
                <p className="mt-1 text-xs text-muted">{t.contracts.labelHint}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t.contracts.customPrice}</label>
                <input type="number" step="0.01" min="0" value={form.special_price} onChange={(e) => setForm((f) => ({ ...f, special_price: e.target.value }))}
                  placeholder={t.contracts.customPricePlaceholder}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">{t.contracts.dueDayLabel}</label>
                  <input type="number" min="1" max="31" value={form.due_day} onChange={(e) => setForm((f) => ({ ...f, due_day: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">{t.contracts.startDateLabel}</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t.common.notes}</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15" />
              </div>
              {samePlanContract && (
                <p className="flex items-start gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t.contracts.samePlanWarning.replace('{code}', contractCode(samePlanContract.id))}
                </p>
              )}

              {needsConfirm && (
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 text-xs text-popover-foreground">
                  <input
                    type="checkbox"
                    checked={confirmedExtra}
                    onChange={(e) => setConfirmedExtra(e.target.checked)}
                    className="mt-0.5 accent-primary"
                  />
                  {t.contracts.confirmExtraContract}
                </label>
              )}

              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
                <Button type="submit" disabled={saving || !canSubmit}>{saving ? t.contracts.assigning : t.contracts.assignContract}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const SK = [
  { client: 'w-32', plan: 'w-36', price: 'w-20' },
  { client: 'w-40', plan: 'w-28', price: 'w-16' },
  { client: 'w-28', plan: 'w-44', price: 'w-20' },
  { client: 'w-36', plan: 'w-32', price: 'w-16' },
  { client: 'w-44', plan: 'w-36', price: 'w-20' },
];

function ContractsTableSkeleton({ colHeaders }: { colHeaders: string[] }) {
  return (
    <>
      {/* Mobile */}
      <ul className="divide-y divide-border sm:hidden">
        {SK.map((w, i) => (
          <li key={i} className="px-4 py-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className={`skeleton h-4 rounded ${w.client}`} />
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
            <div className={`skeleton h-3 rounded ${w.plan}`} />
            <div className={`skeleton h-4 rounded ${w.price}`} />
            <div className="skeleton h-3 w-40 rounded" />
            <div className="flex gap-2 mt-1">
              <div className="skeleton h-6 w-16 rounded-md" />
              <div className="skeleton h-6 w-14 rounded-md" />
            </div>
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
              <td className="px-4 py-3"><div className={`skeleton h-4 rounded ${w.client}`} /></td>
              <td className="px-4 py-3"><div className={`skeleton h-4 rounded ${w.plan}`} /></td>
              <td className="px-4 py-3"><div className={`skeleton h-4 rounded ${w.price}`} /></td>
              <td className="px-4 py-3"><div className="skeleton h-5 w-16 rounded-full" /></td>
              <td className="px-4 py-3"><div className="skeleton h-4 w-10 rounded" /></td>
              <td className="px-4 py-3"><div className="skeleton h-4 w-20 rounded" /></td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <div className="skeleton h-6 w-14 rounded-md" />
                  <div className="skeleton h-6 w-12 rounded-md" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
