create table if not exists public.user_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_data jsonb not null,
  schema_version integer not null,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

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
