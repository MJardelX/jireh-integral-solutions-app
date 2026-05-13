-- =============================================================
-- Jireh Enterprise – Internet Service Invoice Management
-- Initial Schema Migration
-- =============================================================

-- ---------------------
-- Extensions
-- ---------------------
create extension if not exists "uuid-ossp";

-- ---------------------
-- Enums
-- ---------------------
create type plan_recurrence  as enum ('monthly', 'quarterly', 'semiannual', 'annual');
create type contract_status  as enum ('active', 'suspended', 'cancelled');
create type invoice_status   as enum ('pending', 'paid', 'overdue', 'cancelled');
create type payment_method   as enum ('efectivo', 'transferencia', 'tarjeta_de_credito', 'tarjeta_de_debito');
create type user_role        as enum ('admin', 'staff');

-- ---------------------
-- Reusable trigger: set updated_at on row update
-- ---------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------
-- profiles
-- Extends Supabase auth.users.
-- Created automatically on signup (email/password or Google OAuth).
-- ---------------------
create table profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  username    text        unique,
  full_name   text,
  role        user_role   not null default 'staff',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------
-- clients
-- ---------------------
create table clients (
  id          uuid        primary key default uuid_generate_v4(),
  first_name  text        not null,
  last_name   text        not null,
  email       text,                         -- optional
  phone       text        not null,
  address     text        not null,
  is_active   boolean     not null default true,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_clients_is_active  on clients (is_active);
create index idx_clients_last_name  on clients (last_name);
create index idx_clients_email      on clients (email) where email is not null;

create trigger trg_clients_updated_at
  before update on clients
  for each row execute function set_updated_at();

-- ---------------------
-- service_plans
-- ---------------------
create table service_plans (
  id          uuid             primary key default uuid_generate_v4(),
  name        text             not null,
  description text,
  price       numeric(10, 2)   not null check (price >= 0),
  recurrence  plan_recurrence  not null default 'monthly',
  is_active   boolean          not null default true,
  created_at  timestamptz      not null default now(),
  updated_at  timestamptz      not null default now()
);

create index idx_service_plans_is_active on service_plans (is_active);

create trigger trg_service_plans_updated_at
  before update on service_plans
  for each row execute function set_updated_at();

-- ---------------------
-- contracts
-- One client can have multiple contracts (e.g. multiple service locations).
-- special_price overrides the plan price for this specific client when set.
-- ---------------------
create table contracts (
  id            uuid             primary key default uuid_generate_v4(),
  client_id     uuid             not null references clients(id)       on delete restrict,
  plan_id       uuid             not null references service_plans(id) on delete restrict,
  special_price numeric(10, 2)   check (special_price >= 0),  -- null = use plan.price
  status        contract_status  not null default 'active',
  start_date    date             not null default current_date,
  end_date      date,
  due_day       smallint         not null default 10 check (due_day between 1 and 31),
  notes         text,
  created_at    timestamptz      not null default now(),
  updated_at    timestamptz      not null default now(),

  constraint chk_contract_dates check (end_date is null or end_date > start_date)
);

create index idx_contracts_client_id on contracts (client_id);
create index idx_contracts_plan_id   on contracts (plan_id);
create index idx_contracts_status    on contracts (status);

create trigger trg_contracts_updated_at
  before update on contracts
  for each row execute function set_updated_at();

-- ---------------------
-- invoices
-- One invoice per (contract, reference_month).
-- amount is a snapshot of the price at invoice creation time
-- (uses contract.special_price if set, otherwise plan.price).
-- ---------------------
create table invoices (
  id               uuid            primary key default uuid_generate_v4(),
  contract_id      uuid            not null references contracts(id) on delete restrict,
  reference_month  date            not null,  -- always stored as first day of the month, e.g. 2025-05-01
  due_date         date            not null,
  amount           numeric(10, 2)  not null check (amount >= 0),
  status           invoice_status  not null default 'pending',
  notes            text,
  issued_at        timestamptz     not null default now(),
  updated_at       timestamptz     not null default now(),

  unique (contract_id, reference_month)  -- no duplicate invoice for same contract + month
);

create index idx_invoices_contract_id     on invoices (contract_id);
create index idx_invoices_reference_month on invoices (reference_month);
create index idx_invoices_status          on invoices (status);
create index idx_invoices_due_date        on invoices (due_date);

create trigger trg_invoices_updated_at
  before update on invoices
  for each row execute function set_updated_at();

-- ---------------------
-- payments
-- A single payment can cover multiple invoices (multiple months at once).
-- The total amount paid is stored here; how it is applied across invoices
-- is recorded in payment_items.
-- ---------------------
create table payments (
  id              uuid            primary key default uuid_generate_v4(),
  client_id       uuid            not null references clients(id)   on delete restrict,
  total_amount    numeric(10, 2)  not null check (total_amount > 0),
  payment_method  payment_method  not null,
  payment_date    date            not null default current_date,
  notes           text,
  created_by      uuid            references profiles(id) on delete set null,
  created_at      timestamptz     not null default now()
);

create index idx_payments_client_id    on payments (client_id);
create index idx_payments_payment_date on payments (payment_date);
create index idx_payments_created_by   on payments (created_by);

-- ---------------------
-- payment_items
-- Bridge between a payment and the invoices it covers.
-- amount_applied can be less than invoice.amount (partial payment support).
-- ---------------------
create table payment_items (
  id              uuid            primary key default uuid_generate_v4(),
  payment_id      uuid            not null references payments(id)  on delete cascade,
  invoice_id      uuid            not null references invoices(id)  on delete restrict,
  amount_applied  numeric(10, 2)  not null check (amount_applied > 0),
  created_at      timestamptz     not null default now(),

  unique (payment_id, invoice_id)
);

create index idx_payment_items_payment_id on payment_items (payment_id);
create index idx_payment_items_invoice_id on payment_items (invoice_id);

-- ---------------------
-- Helper: resolve effective price for a contract
-- ---------------------
create or replace function contract_effective_price(p_contract_id uuid)
returns numeric as $$
  select coalesce(c.special_price, sp.price)
  from contracts c
  join service_plans sp on sp.id = c.plan_id
  where c.id = p_contract_id;
$$ language sql stable;

-- ---------------------
-- Convenience view: invoice details
-- ---------------------
create or replace view v_invoice_details as
select
  i.id                                          as invoice_id,
  i.reference_month,
  i.due_date,
  i.amount,
  i.status                                      as invoice_status,
  i.issued_at,
  c.id                                          as contract_id,
  c.due_day,
  c.special_price,
  cl.id                                         as client_id,
  cl.first_name || ' ' || cl.last_name          as client_name,
  cl.email                                      as client_email,
  cl.phone                                      as client_phone,
  sp.id                                         as plan_id,
  sp.name                                       as plan_name,
  sp.price                                      as plan_price,
  sp.recurrence                                 as plan_recurrence
from invoices i
join contracts     c  on c.id  = i.contract_id
join clients       cl on cl.id = c.client_id
join service_plans sp on sp.id = c.plan_id;

-- ---------------------
-- Convenience view: payment details
-- ---------------------
create or replace view v_payment_details as
select
  p.id                                          as payment_id,
  p.payment_date,
  p.payment_method,
  p.total_amount,
  p.notes,
  cl.id                                         as client_id,
  cl.first_name || ' ' || cl.last_name          as client_name,
  pr.full_name                                  as recorded_by,
  pi.invoice_id,
  pi.amount_applied,
  i.reference_month,
  i.amount                                      as invoice_amount,
  i.status                                      as invoice_status
from payments p
join clients          cl on cl.id = p.client_id
left join profiles    pr on pr.id = p.created_by
join payment_items    pi on pi.payment_id = p.id
join invoices          i on i.id  = pi.invoice_id;

-- =============================================================
-- Row Level Security
-- All tables are accessible only to authenticated users.
-- Only admins can delete clients, contracts, and service_plans.
-- =============================================================

alter table profiles     enable row level security;
alter table clients      enable row level security;
alter table service_plans enable row level security;
alter table contracts    enable row level security;
alter table invoices     enable row level security;
alter table payments     enable row level security;
alter table payment_items enable row level security;

-- Helper: check if the current user is an admin
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer set search_path = public;

-- profiles: users manage their own; admins see all
create policy "profiles_select_own"   on profiles for select using (auth.uid() = id);
create policy "profiles_update_own"   on profiles for update using (auth.uid() = id);
create policy "profiles_select_admin" on profiles for select using (is_admin());

-- clients
create policy "clients_select"  on clients for select  to authenticated using (true);
create policy "clients_insert"  on clients for insert  to authenticated with check (true);
create policy "clients_update"  on clients for update  to authenticated using (true);
create policy "clients_delete"  on clients for delete  to authenticated using (is_admin());

-- service_plans
create policy "plans_select" on service_plans for select to authenticated using (true);
create policy "plans_insert" on service_plans for insert to authenticated with check (is_admin());
create policy "plans_update" on service_plans for update to authenticated using (is_admin());
create policy "plans_delete" on service_plans for delete to authenticated using (is_admin());

-- contracts
create policy "contracts_select" on contracts for select to authenticated using (true);
create policy "contracts_insert" on contracts for insert to authenticated with check (true);
create policy "contracts_update" on contracts for update to authenticated using (true);
create policy "contracts_delete" on contracts for delete to authenticated using (is_admin());

-- invoices
create policy "invoices_select" on invoices for select to authenticated using (true);
create policy "invoices_insert" on invoices for insert to authenticated with check (true);
create policy "invoices_update" on invoices for update to authenticated using (true);
create policy "invoices_delete" on invoices for delete to authenticated using (is_admin());

-- payments
create policy "payments_select" on payments for select to authenticated using (true);
create policy "payments_insert" on payments for insert to authenticated with check (true);
create policy "payments_update" on payments for update to authenticated using (true);
create policy "payments_delete" on payments for delete to authenticated using (is_admin());

-- payment_items
create policy "payment_items_all" on payment_items for all to authenticated using (true) with check (true);
