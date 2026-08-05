'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { UserPlus, Search, ToggleLeft, ToggleRight, X, AlertTriangle } from 'lucide-react';
import { Paginator } from '@/components/ui/paginator';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';
import { Button } from '@/components/ui/button';
import type { Client } from '@/types/client';
import { ClientDrawer } from '@/components/clients/ClientDrawer';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fullName(c: Client) { return `${c.first_name} ${c.last_name}`; }

interface InvoiceSummary { overdue: number; pending: number; }

const EMPTY_FORM = {
  first_name: '', last_name: '', phone: '', email: '', address: '', notes: '',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const t = useT();
  const { authFetch } = useAuth();

  const [clients,   setClients]   = useState<Client[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [search,    setSearch]    = useState('');
  const [showAll,   setShowAll]   = useState(true);
  const [page,      setPage]      = useState(1);
  const PAGE_SIZE = 25;

  // invoice status badges per client
  const [invStatus, setInvStatus] = useState<Record<string, InvoiceSummary>>({});

  // create modal
  const [open,      setOpen]      = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // drawer
  const [drawerClient, setDrawerClient] = useState<Client | null>(null);
  const [drawerOpen,   setDrawerOpen]   = useState(false);

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadInvoiceStatus = useCallback(async () => {
    try {
      // Counted server-side: fetching the invoice listing here would only ever
      // see its first page, undercounting clients with older open invoices.
      const res = await authFetch('/api/invoices?summary=1');
      const { summary = {} } = await res.json();
      setInvStatus(summary as Record<string, InvoiceSummary>);
    } catch { /* non-critical */ }
  }, [authFetch]);

  const load = useCallback(async (q = search, all = showAll) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ search: q });
      if (!all) params.set('active', 'true');
      const res = await authFetch(`/api/clients?${params}`);
      if (!res.ok) throw new Error('Failed to load clients');
      const { clients: data } = await res.json();
      setClients(data);
      setPage(1);
      // Keep drawer header in sync when the open client was just edited
      setDrawerClient((prev) => {
        if (!prev) return prev;
        return (data as Client[]).find((c) => c.id === prev.id) ?? prev;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [authFetch, search, showAll]);

  useEffect(() => { load(); loadInvoiceStatus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onSearchChange(v: string) {
    setSearch(v);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => load(v, showAll), 350);
  }

  function openCreate() {
    setForm(EMPTY_FORM); setFormError(null); setOpen(true);
  }

  function openDrawer(c: Client) {
    setDrawerClient(c);
    setDrawerOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const res = await authFetch('/api/clients', { method: 'POST', body: JSON.stringify(form) });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      setOpen(false);
      await load(search, showAll);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(e: React.MouseEvent, c: Client) {
    e.stopPropagation();
    await authFetch(`/api/clients/${c.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !c.is_active }) });
    await load(search, showAll);
    // keep drawer data fresh if this client is open
    if (drawerClient?.id === c.id) {
      setDrawerClient((prev) => prev ? { ...prev, is_active: !prev.is_active } : prev);
    }
  }

  function InvoiceBadge({ clientId }: { clientId: string }) {
    const s = invStatus[clientId];
    if (!s || (s.overdue === 0 && s.pending === 0)) return <span className="text-xs text-muted">—</span>;

    if (s.overdue >= 3) return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-400">
        <AlertTriangle className="h-3 w-3" />
        {s.overdue} {t.clients.badgeOverduePlural}
      </span>
    );

    if (s.overdue > 0) return (
      <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
        {s.overdue} {s.overdue === 1 ? t.clients.badgeOverdue : t.clients.badgeOverduePlural}
      </span>
    );

    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        {s.pending} {s.pending === 1 ? t.clients.badgePending : t.clients.badgePendingPlural}
      </span>
    );
  }

  const canSubmit =
    form.first_name.trim() !== '' &&
    form.last_name.trim() !== '' &&
    form.phone.trim() !== '' &&
    form.address.trim() !== '';

  const INPUT_CLS = 'w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15 dark:focus:border-primary';

  const field = (key: keyof typeof EMPTY_FORM, label: string, required = false, type = 'text') => (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{label}{required && ' *'}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        required={required}
        className={INPUT_CLS}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-popover-foreground">{t.clients.title}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {clients.length} {showAll ? t.common.total : t.clients.activeOnly}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <UserPlus className="h-4 w-4" /> {t.clients.addClient}
        </Button>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            placeholder={t.clients.searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-input pl-9 pr-3 py-2 text-sm text-popover-foreground outline-none focus:border-primary dark:bg-[#2c2520] dark:border-white/15"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted select-none">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => { setShowAll(e.target.checked); load(search, e.target.checked); }}
            className="accent-primary"
          />
          {t.clients.showInactive}
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-popover">
        {loading ? (
          <ClientsTableSkeleton colHeaders={[t.clients.colName, t.clients.colPhone, t.clients.colEmail, t.clients.colAddress, t.clients.colStatus, t.clients.colInvoices, '']} />
        ) : clients.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted">{t.clients.noClients}</div>
        ) : (
          <>
            {/* Mobile: card list */}
            <ul className="divide-y divide-border sm:hidden">
              {clients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((c) => (
                <li
                  key={c.id}
                  className="flex cursor-pointer items-start justify-between gap-3 px-4 py-4 transition-colors hover:bg-border/20"
                  onClick={() => openDrawer(c)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-popover-foreground">{fullName(c)}</span>
                      <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-border text-muted'
                      }`}>
                        {c.is_active ? t.common.active : t.common.inactive}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{c.phone}{c.email ? ` · ${c.email}` : ''}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">{c.address}</p>
                    <div className="mt-1"><InvoiceBadge clientId={c.id} /></div>
                  </div>
                  <button
                    onClick={(e) => toggleActive(e, c)}
                    className="shrink-0 rounded-md p-1.5 text-muted hover:bg-border/60"
                    title={c.is_active ? t.clients.deactivate : t.clients.activate}
                  >
                    {c.is_active
                      ? <ToggleRight className="h-4 w-4 text-green-500" />
                      : <ToggleLeft className="h-4 w-4" />}
                  </button>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <table className="hidden w-full text-sm sm:table">
              <thead className="border-b border-border bg-background/40">
                <tr>
                  {[t.clients.colName, t.clients.colPhone, t.clients.colEmail, t.clients.colAddress, t.clients.colStatus, t.clients.colInvoices, ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer transition-colors hover:bg-border/20"
                    onClick={() => openDrawer(c)}
                  >
                    <td className="px-4 py-3 font-medium text-popover-foreground">{fullName(c)}</td>
                    <td className="px-4 py-3 text-muted">{c.phone}</td>
                    <td className="px-4 py-3 text-muted">{c.email ?? '—'}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-muted">{c.address}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-border text-muted'
                      }`}>
                        {c.is_active ? t.common.active : t.common.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceBadge clientId={c.id} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={(e) => toggleActive(e, c)}
                          className="rounded-md p-1.5 text-muted hover:bg-border/60 hover:text-popover-foreground"
                          title={c.is_active ? t.clients.deactivate : t.clients.activate}
                        >
                          {c.is_active
                            ? <ToggleRight className="h-4 w-4 text-green-500" />
                            : <ToggleLeft className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <Paginator page={page} total={clients.length} pageSize={PAGE_SIZE} onChange={setPage} />

      {/* Create client modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-popover p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-popover-foreground">{t.clients.newTitle}</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted hover:text-popover-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {field('first_name', t.clients.firstName, true)}
                {field('last_name',  t.clients.lastName,  true)}
              </div>
              {field('phone',   t.common.phone,   true, 'tel')}
              {field('email',   t.common.email,   false, 'email')}
              {field('address', t.common.address, true)}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">{t.common.notes}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className={`${INPUT_CLS} resize-none`}
                />
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
                <Button type="submit" disabled={saving || !canSubmit}>
                  {saving ? t.common.saving : t.clients.createClient}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client drawer */}
      <ClientDrawer
        client={drawerClient}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onClientUpdated={() => { load(search, showAll); loadInvoiceStatus(); }}
      />
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SKELETON_WIDTHS = [
  { name: 'w-32', phone: 'w-24', email: 'w-28', address: 'w-44' },
  { name: 'w-28', phone: 'w-20', email: 'w-36', address: 'w-52' },
  { name: 'w-36', phone: 'w-28', email: 'w-24', address: 'w-40' },
  { name: 'w-24', phone: 'w-24', email: 'w-32', address: 'w-48' },
  { name: 'w-40', phone: 'w-20', email: 'w-28', address: 'w-36' },
  { name: 'w-30', phone: 'w-26', email: 'w-20', address: 'w-56' },
];

function ClientsTableSkeleton({ colHeaders }: { colHeaders: string[] }) {
  return (
    <>
      {/* Mobile */}
      <ul className="divide-y divide-border sm:hidden">
        {SKELETON_WIDTHS.map((w, i) => (
          <li key={i} className="flex items-start justify-between gap-3 px-4 py-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className={`skeleton h-4 rounded ${w.name}`} />
                <div className="skeleton h-5 w-14 rounded-full" />
              </div>
              <div className={`skeleton h-3 rounded ${w.phone}`} />
              <div className={`skeleton h-3 rounded ${w.address}`} />
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
          {SKELETON_WIDTHS.map((w, i) => (
            <tr key={i}>
              <td className="px-4 py-3"><div className={`skeleton h-4 rounded ${w.name}`} /></td>
              <td className="px-4 py-3"><div className={`skeleton h-4 rounded ${w.phone}`} /></td>
              <td className="px-4 py-3"><div className={`skeleton h-4 rounded ${w.email}`} /></td>
              <td className="px-4 py-3"><div className={`skeleton h-4 rounded ${w.address}`} /></td>
              <td className="px-4 py-3"><div className="skeleton h-5 w-14 rounded-full" /></td>
              <td className="px-4 py-3">
                <div className="flex justify-end">
                  <div className="skeleton h-7 w-7 rounded-md" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
