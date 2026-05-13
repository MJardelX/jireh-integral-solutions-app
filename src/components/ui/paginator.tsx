interface PaginatorProps {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export function Paginator({ page, total, pageSize, onChange }: PaginatorProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  // Build page number list with ellipsis
  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  const btn = 'rounded-md px-2.5 py-1 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3">
      <p className="text-sm text-muted">{from}–{to} of {total}</p>
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className={`${btn} text-muted hover:bg-border/60 hover:text-popover-foreground`}
        >
          ←
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-1.5 text-sm text-muted">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`${btn} ${p === page ? 'bg-primary text-primary-foreground font-medium' : 'text-muted hover:bg-border/60 hover:text-popover-foreground'}`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className={`${btn} text-muted hover:bg-border/60 hover:text-popover-foreground`}
        >
          →
        </button>
      </div>
    </div>
  );
}
