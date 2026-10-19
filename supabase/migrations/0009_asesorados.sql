-- =====================================================================
-- ARC by Lunarovx · asesorados de la coach
-- La coach añade a sus asesoradas por correo, les pone rutina y ve cuánto cumplen.
-- Pégalo en Supabase > SQL Editor y dale a Run.
-- =====================================================================

create table if not exists public.coach_clients (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null default auth.uid() references auth.users on delete cascade,
  email text not null,
  name text,
  client_id uuid references auth.users on delete set null,
  routine jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, email)
);
alter table public.coach_clients enable row level security;

drop policy if exists "coach gestiona sus asesoradas" on public.coach_clients;
create policy "coach gestiona sus asesoradas" on public.coach_clients for all to authenticated
  using (coach_id = auth.uid() and public.is_coach())
  with check (coach_id = auth.uid() and public.is_coach());

drop policy if exists "asesorada ve su rutina" on public.coach_clients;
create policy "asesorada ve su rutina" on public.coach_clients for select to authenticated
  using (client_id = auth.uid());

-- Une el correo con la cuenta si ya existe
create or replace function public.link_client() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.email := lower(trim(new.email));
  if new.client_id is null then
    select id into new.client_id from auth.users where lower(email) = new.email limit 1;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists coach_clients_link on public.coach_clients;
create trigger coach_clients_link before insert or update on public.coach_clients
  for each row execute function public.link_client();

-- Si la asesorada se registra después, se une sola
create or replace function public.link_pending_clients() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.coach_clients set client_id = new.id
  where client_id is null and email = lower(new.email);
  return new;
end $$;
drop trigger if exists on_auth_user_link_coach on auth.users;
create trigger on_auth_user_link_coach after insert on auth.users
  for each row execute function public.link_pending_clients();

-- La coach puede ver los hábitos (para el cumplimiento)
drop policy if exists "coach ve hábitos" on public.habits;
create policy "coach ve hábitos" on public.habits for select to authenticated using (public.is_coach());
