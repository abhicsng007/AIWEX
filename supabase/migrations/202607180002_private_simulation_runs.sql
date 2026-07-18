-- Private, authenticated simulation tenancy. Event rows remain the immutable
-- ledger; this table makes run ownership explicit for operations, retention,
-- and future shared-team membership.
create table if not exists public.simulation_runs (
  id text primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  scenario_key text not null default 'signaldesk-usage-alerts',
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, scenario_key)
);

create index if not exists simulation_runs_owner_idx on public.simulation_runs (owner_user_id, updated_at desc);

alter table public.simulation_runs enable row level security;

create policy "learners read their own runs"
  on public.simulation_runs for select
  using (auth.uid() = owner_user_id);

create policy "learners update their own active runs"
  on public.simulation_runs for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

-- Service-role route handlers create runs and append the protected event
-- ledger. Never add an anonymous write policy for simulation events.
