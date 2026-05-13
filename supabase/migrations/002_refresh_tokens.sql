-- =============================================================
-- Refresh tokens table for JWT rotation
-- =============================================================

create table refresh_tokens (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  token_hash  text        not null unique,   -- SHA-256 hash, never stored in plaintext
  family      uuid        not null,          -- rotation family for theft detection
  expires_at  timestamptz not null,
  revoked     boolean     not null default false,
  created_at  timestamptz not null default now()
);

create index idx_refresh_tokens_user_id    on refresh_tokens (user_id);
create index idx_refresh_tokens_token_hash on refresh_tokens (token_hash);
create index idx_refresh_tokens_family     on refresh_tokens (family);

-- No RLS policies = zero client-side access (service role bypasses RLS)
alter table refresh_tokens enable row level security;

-- Clean up expired tokens daily (requires pg_cron extension in Supabase)
-- SELECT cron.schedule('cleanup-refresh-tokens', '0 3 * * *',
--   $$ DELETE FROM refresh_tokens WHERE expires_at < now() OR revoked = true $$);
