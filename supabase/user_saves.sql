create table if not exists public.user_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_data jsonb not null,
  schema_version integer not null,
  backup_saves jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.user_saves
add column if not exists backup_saves jsonb not null default '[]'::jsonb;

alter table public.user_saves enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on table public.user_saves to authenticated;

drop policy if exists "Users can read own save" on public.user_saves;
drop policy if exists "Users can insert own save" on public.user_saves;
drop policy if exists "Users can update own save" on public.user_saves;

create policy "Users can read own save"
on public.user_saves
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own save"
on public.user_saves
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own save"
on public.user_saves
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.user_auto_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_index integer not null check (slot_index between 1 and 4),
  app_data jsonb not null,
  schema_version integer not null,
  updated_at timestamptz not null default now(),
  unique (user_id, slot_index)
);

alter table public.user_auto_saves enable row level security;

grant select, insert, update on table public.user_auto_saves to authenticated;

drop policy if exists "Users can read own auto saves" on public.user_auto_saves;
drop policy if exists "Users can insert own auto saves" on public.user_auto_saves;
drop policy if exists "Users can update own auto saves" on public.user_auto_saves;

create policy "Users can read own auto saves"
on public.user_auto_saves
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own auto saves"
on public.user_auto_saves
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own auto saves"
on public.user_auto_saves
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
