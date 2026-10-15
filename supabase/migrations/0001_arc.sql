-- =====================================================================
-- ARC by Lunarovx · esquema de base de datos (Supabase / PostgreSQL)
-- Pégalo entero en Supabase > SQL Editor y dale a Run.
-- =====================================================================

-- ---------- PERFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'client' check (role in ('client', 'coach', 'admin')),
  onboarded boolean not null default false,
  data jsonb,                    -- respuestas del cuestionario (rama, peso, marcas, preferencias…)
  start_date date,
  xp int not null default 0,
  gems int not null default 0,
  active_session jsonb,          -- entreno en curso, para retomarlo en otro dispositivo
  health_consent_at timestamptz, -- consentimiento para tratar datos de salud (RGPD)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, health_consent_at)
  values (new.id, case when (new.raw_user_meta_data->>'health_consent') = 'true' then now() end);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin'));
$$;

alter table public.profiles enable row level security;
drop policy if exists "perfil propio: leer" on public.profiles;
create policy "perfil propio: leer" on public.profiles for select using (id = auth.uid() or public.is_coach());
drop policy if exists "perfil propio: editar" on public.profiles;
create policy "perfil propio: editar" on public.profiles for update using (id = auth.uid());
-- La usuaria no puede cambiarse el rol ni sumarse XP o gemas a mano
revoke update on public.profiles from authenticated, anon;
grant update (onboarded, data, start_date, active_session, health_consent_at, updated_at) on public.profiles to authenticated;

-- ---------- ENTRENOS ----------
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  performed_at timestamptz not null default now(),
  day_id text,
  day_name text,
  duration_s int not null default 0,
  volume_kg numeric not null default 0,
  sets_done int not null default 0,
  exercises jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists workout_sessions_user_idx on public.workout_sessions (user_id, performed_at);
alter table public.workout_sessions enable row level security;
drop policy if exists "entrenos propios" on public.workout_sessions;
create policy "entrenos propios" on public.workout_sessions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "coach ve entrenos" on public.workout_sessions;
create policy "coach ve entrenos" on public.workout_sessions for select using (public.is_coach());

create or replace function public.reward_session() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set xp = xp + 40, gems = gems + 5, active_session = null, updated_at = now()
  where id = new.user_id;
  return new;
end $$;
drop trigger if exists on_session_saved on public.workout_sessions;
create trigger on_session_saved after insert on public.workout_sessions
  for each row execute function public.reward_session();

-- ---------- HÁBITOS ----------
create table if not exists public.habits (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  water int,
  steps int,
  sleep numeric,
  weight numeric,
  primary key (user_id, day)
);
alter table public.habits enable row level security;
drop policy if exists "hábitos propios" on public.habits;
create policy "hábitos propios" on public.habits for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- IMÁGENES Y VÍDEOS (los sube la coach) ----------
create table if not exists public.media (
  key text primary key,
  url text not null,
  kind text,
  updated_at timestamptz not null default now()
);
alter table public.media enable row level security;
drop policy if exists "media: leer" on public.media;
create policy "media: leer" on public.media for select using (auth.role() = 'authenticated');
drop policy if exists "media: coach escribe" on public.media;
create policy "media: coach escribe" on public.media for all using (public.is_coach()) with check (public.is_coach());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 524288000, array['image/*', 'video/*'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media: leer" on storage.objects;
create policy "media: leer" on storage.objects for select to authenticated
  using (bucket_id = 'media');
drop policy if exists "media: coach sube" on storage.objects;
create policy "media: coach sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_coach());
drop policy if exists "media: coach cambia" on storage.objects;
create policy "media: coach cambia" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_coach());
drop policy if exists "media: coach borra" on storage.objects;
create policy "media: coach borra" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_coach());

-- ---------- SUSCRIPCIONES (para los pagos, más adelante) ----------
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "suscripción propia: leer" on public.subscriptions;
create policy "suscripción propia: leer" on public.subscriptions for select using (user_id = auth.uid());

-- =====================================================================
-- DESPUÉS DE REGISTRARTE EN LA APP, conviértete en coach con:
--   update public.profiles set role = 'coach'
--   where id = (select id from auth.users where lower(email) = 'TU-EMAIL');
-- =====================================================================
