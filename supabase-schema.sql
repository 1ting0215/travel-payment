-- Run this in Supabase SQL Editor

create extension if not exists "uuid-ossp";

create table notebooks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  creator_email text not null,
  password_hash text,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '3 months')
);

create table members (
  id uuid primary key default uuid_generate_v4(),
  notebook_id uuid not null references notebooks(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(notebook_id, name)
);

create table currencies (
  id uuid primary key default uuid_generate_v4(),
  notebook_id uuid not null references notebooks(id) on delete cascade,
  code text not null,
  exchange_rate numeric,
  base_currency text,
  unique(notebook_id, code)
);

create table expenses (
  id uuid primary key default uuid_generate_v4(),
  notebook_id uuid not null references notebooks(id) on delete cascade,
  title text not null,
  date date not null,
  amount numeric not null,
  currency text not null,
  payer text not null,
  split_method text not null check (split_method in ('equal', 'custom', 'ratio')),
  notes text,
  receipt_url text,
  visibility text not null default 'shared' check (visibility in ('private', 'shared')),
  created_by text not null,
  created_at timestamptz not null default now()
);

create table expense_splits (
  id uuid primary key default uuid_generate_v4(),
  expense_id uuid not null references expenses(id) on delete cascade,
  member_name text not null,
  amount numeric not null,
  ratio numeric
);

create table settlement_items (
  id uuid primary key default uuid_generate_v4(),
  notebook_id uuid not null references notebooks(id) on delete cascade,
  from_member text not null,
  to_member text not null,
  amount numeric not null,
  currency text not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'confirmed')),
  proof_url text,
  original_amounts jsonb
);

create table collection_info (
  id uuid primary key default uuid_generate_v4(),
  notebook_id uuid not null references notebooks(id) on delete cascade,
  member_name text not null,
  account_info text,
  qr_code_url text,
  notes text,
  unique(notebook_id, member_name)
);

-- Auto-delete expired notebooks (run via cron or Supabase scheduled function)
-- delete from notebooks where expires_at < now();

-- Storage buckets (create in Supabase dashboard)
-- bucket: receipts    (public: false)
-- bucket: proofs      (public: false)
-- bucket: qrcodes     (public: false)
