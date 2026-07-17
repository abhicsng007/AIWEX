create extension if not exists pgcrypto;

create table if not exists public.simulation_events (
  id uuid primary key,
  organization_id text not null,
  type text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists simulation_events_organization_created_idx
  on public.simulation_events (organization_id, created_at asc);

create table if not exists public.workspace_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  object_path text not null unique,
  file_name text not null,
  content_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  created_at timestamptz not null default now()
);

create index if not exists workspace_artifacts_organization_created_idx
  on public.workspace_artifacts (organization_id, created_at desc);

alter table public.simulation_events enable row level security;
alter table public.workspace_artifacts enable row level security;

-- All access in this alpha goes through server routes using the service-role key.
-- Do not add public/anon policies until authenticated organization membership exists.
insert into storage.buckets (id, name, public)
values ('workspace-artifacts', 'workspace-artifacts', false)
on conflict (id) do nothing;
