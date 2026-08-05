-- =============================================================
-- Optional nickname for a contract
--
-- A client may hold several contracts (two houses, home + business).
-- The plan name alone is ambiguous when both use the same plan, so the
-- agent can give each contract a short name shown on invoice pickers,
-- payment listings and receipts.
-- =============================================================

alter table contracts add column if not exists label text;

comment on column contracts.label is
  'Optional short nickname to tell apart several contracts of the same client (e.g. "Casa", "Negocio"). Null falls back to the plan name.';
