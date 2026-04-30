-- Eat Your Way · Supabase schema
-- Run this in Supabase SQL editor (or via `supabase db push` if using the CLI).

-- ── Tables ────────────────────────────────────────────────────────────────
create table if not exists public.runs (
  id            bigserial primary key,
  client_id     text not null,
  handle        text not null check (length(handle) between 1 and 24),
  map_id        text not null check (map_id in ('jackson-heights', 'flushing')),
  flavor        integer not null check (flavor >= 0 and flavor <= 9999),
  combo_max     integer not null check (combo_max >= 0 and combo_max <= 20),
  bites         integer not null check (bites >= 0 and bites <= 999),
  gems          integer not null check (gems >= 0 and gems <= 999),
  cuisines      text[] not null default '{}',
  rank          text not null,
  spent         integer not null check (spent >= 0 and spent <= 999),
  ended_reason  text not null,
  created_at    timestamptz not null default now()
);

create index if not exists runs_map_flavor_idx on public.runs (map_id, flavor desc);
create index if not exists runs_client_id_idx on public.runs (client_id);

-- ── View: best run per (client_id, map_id) ────────────────────────────────
-- Used by the leaderboard so a player only appears once per map.
create or replace view public.top_runs as
select distinct on (client_id, map_id)
  client_id,
  handle,
  map_id,
  flavor,
  combo_max,
  bites,
  gems,
  cuisines,
  rank,
  spent,
  ended_reason,
  created_at
from public.runs
order by client_id, map_id, flavor desc, created_at desc;

-- ── Row-Level Security ────────────────────────────────────────────────────
alter table public.runs enable row level security;

-- Anyone (including anon key) can read runs
drop policy if exists "runs are public" on public.runs;
create policy "runs are public"
  on public.runs for select
  using (true);

-- Anyone can insert their own runs (anon key is used; client_id is opaque per device)
drop policy if exists "anon can insert runs" on public.runs;
create policy "anon can insert runs"
  on public.runs for insert
  with check (true);

-- ── Rate limiting (simple) ────────────────────────────────────────────────
-- Trigger to prevent more than 1 insert per client_id per 3 seconds
-- (light protection; for stronger guards use Supabase Edge Functions or pg_cron).
create or replace function public.runs_rate_limit() returns trigger as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from public.runs
  where client_id = new.client_id
    and created_at > now() - interval '3 seconds';
  if recent_count > 0 then
    raise exception 'rate-limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists runs_rate_limit_trg on public.runs;
create trigger runs_rate_limit_trg
  before insert on public.runs
  for each row execute procedure public.runs_rate_limit();
