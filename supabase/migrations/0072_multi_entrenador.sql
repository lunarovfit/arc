-- ARC · Varios entrenadores: cada entrenador/a solo ve a SUS asesorad@s (y solo si han aceptado).
-- Luna queda como administradora de ARC (contenido, fotos, denuncias, opiniones).

-- 1) Roles
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
create or replace function public.is_trainer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('coach', 'admin'));
$$;
-- Las cuentas de coach que existían hasta hoy son las de Luna: pasan a administradora
create table if not exists public.arc_migrations (name text primary key, at timestamptz not null default now());
do $$ begin
  if not exists (select 1 from public.arc_migrations where name = '0072_admin') then
    update public.profiles set role = 'admin' where role = 'coach';
    insert into public.arc_migrations (name) values ('0072_admin');
  end if;
end $$;
-- Los poderes globales (editar contenido, fotos, denuncias, opiniones…) quedan solo para la administradora
create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin();
$$;

-- 2) Planes de entrenador
alter table public.profiles add column if not exists coach_plan text not null default 'free';
create or replace function public.coach_limit(uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select case when p.role = 'admin' then 100000
    else case p.coach_plan when 'starter' then 5 when 'pro' then 15 when 'elite' then 40 else 1 end end
  from public.profiles p where p.id = uid;
$$;

-- 3) La asesorada tiene que aceptar (salvo las de la administradora, que se aceptan solas)
alter table public.coach_clients add column if not exists accepted boolean not null default false;
do $$ begin
  if not exists (select 1 from public.arc_migrations where name = '0072_accepted') then
    update public.coach_clients set accepted = true where not accepted; -- todo lo que había hasta hoy
    insert into public.arc_migrations (name) values ('0072_accepted');
  end if;
end $$;
create or replace function public.coach_clients_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; lim int;
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.profiles where id = new.coach_id and role = 'admin') then new.accepted := true;
    else
      new.accepted := false;
      select count(*) into n from public.coach_clients where coach_id = new.coach_id;
      lim := coalesce(public.coach_limit(new.coach_id), 1);
      if n >= lim then raise exception 'limite:%', lim; end if;
    end if;
  elsif tg_op = 'UPDATE' and new.accepted and not old.accepted and auth.uid() is distinct from new.client_id
        and not exists (select 1 from public.profiles where id = new.coach_id and role = 'admin') then
    new.accepted := false; -- solo la propia asesorada puede aceptar
  end if;
  return new;
end $$;
drop trigger if exists coach_clients_guard on public.coach_clients;
create trigger coach_clients_guard before insert or update on public.coach_clients
  for each row execute function public.coach_clients_guard();

create or replace function public.is_my_client(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_trainer() and exists (select 1 from public.coach_clients c where c.coach_id = auth.uid() and c.client_id = uid and c.accepted);
$$;

-- 4) Qué puede ver cada entrenador/a: solo lo de sus asesorad@s aceptad@s
drop policy if exists "perfil propio: leer" on public.profiles;
create policy "perfil propio: leer" on public.profiles for select using (id = auth.uid() or public.is_my_client(id));
drop policy if exists "coach ve entrenos" on public.workout_sessions;
create policy "coach ve entrenos" on public.workout_sessions for select using (public.is_my_client(user_id));
drop policy if exists "coach apunta entrenos" on public.workout_sessions;
create policy "coach apunta entrenos" on public.workout_sessions for insert with check (public.is_my_client(user_id));
drop policy if exists "coach corrige entrenos" on public.workout_sessions;
create policy "coach corrige entrenos" on public.workout_sessions for update using (public.is_my_client(user_id)) with check (public.is_my_client(user_id));
drop policy if exists "coach borra entrenos" on public.workout_sessions;
create policy "coach borra entrenos" on public.workout_sessions for delete using (public.is_my_client(user_id));
drop policy if exists "coach ve hábitos" on public.habits;
create policy "coach ve hábitos" on public.habits for select to authenticated using (public.is_my_client(user_id));
drop policy if exists "coach ve revisiones" on public.client_checkins;
create policy "coach ve revisiones" on public.client_checkins for select to authenticated using (public.is_my_client(client_id));
drop policy if exists "checkins: ve la suya o coach" on storage.objects;
create policy "checkins: ve la suya o coach" on storage.objects for select to authenticated
  using (bucket_id = 'checkins' and ((storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.coach_clients c where c.coach_id = auth.uid() and c.accepted and c.client_id::text = (storage.foldername(name))[1])));
drop policy if exists "coach gestiona sus asesoradas" on public.coach_clients;
create policy "coach gestiona sus asesoradas" on public.coach_clients for all to authenticated
  using (coach_id = auth.uid() and public.is_trainer())
  with check (coach_id = auth.uid() and public.is_trainer());
drop policy if exists "asesorada ve su rutina" on public.coach_clients;
create policy "asesorada ve su rutina" on public.coach_clients for select to authenticated
  using (client_id = auth.uid() and accepted);

-- El "sin cuestionario" solo cuando ha aceptado
create or replace function public.coach_onboard(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from public.coach_clients where client_id = uid and accepted order by updated_at desc limit 1;
  if not found then return; end if;
  update public.profiles p set
    onboarded = true,
    start_date = coalesce(p.start_date, current_date),
    data = jsonb_build_object(
      'mode', coalesce(nullif(c.mode, ''), 'clasico'), 'branch', 'female', 'age', 25, 'height', 165, 'weight', 60,
      'activity', 1.45, 'goal', 'mant', 'veg', false, 'trainTime', 'mid',
      'days', greatest(coalesce(jsonb_array_length(c.routine), 3), 2), 'meals', 4, 'cook', 'sencilla', 'eatOut', false,
      'exclude', '[]'::jsonb, 'likes', '[]'::jsonb, 'dislikes', '[]'::jsonb, 'months', 0, 'pullups', 0,
      'squat', jsonb_build_object('kg', 0, 'reps', 0), 'bench', jsonb_build_object('kg', 0, 'reps', 0),
      'deadlift', jsonb_build_object('kg', 0, 'reps', 0), 'fromCoach', true
    ) || coalesce(c.profile, '{}'::jsonb) || coalesce(p.data, '{}'::jsonb)
  where p.id = uid and not p.onboarded;
end $$;
drop trigger if exists coach_clients_onboard on public.coach_clients;
create trigger coach_clients_onboard after insert or update of client_id, routine, mode, profile, accepted on public.coach_clients
  for each row execute function public.coach_clients_onboard();

-- 5) Hacerse entrenador/a, invitaciones y planes
create or replace function public.become_coach(name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set role = 'coach', data = coalesce(data, '{}'::jsonb) || jsonb_build_object('coachName', left(trim(name), 40))
  where id = auth.uid() and role = 'client';
end $$;
drop function if exists public.my_coach_invites();
create or replace function public.my_coach_invites()
returns table (id uuid, coach_name text)
language sql stable security definer set search_path = public as $$
  select c.id, coalesce(nullif(p.data->>'coachName', ''), p.nickname, 'Un entrenador') from public.coach_clients c
  join public.profiles p on p.id = c.coach_id
  where c.client_id = auth.uid() and not c.accepted;
$$;
create or replace function public.respond_coach_invite(inv uuid, ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if ok then update public.coach_clients set accepted = true where id = inv and client_id = auth.uid();
  else delete from public.coach_clients where id = inv and client_id = auth.uid() and not accepted; end if;
end $$;
create or replace function public.my_coach_plan() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('plan', p.coach_plan, 'limit', public.coach_limit(p.id), 'used', (select count(*) from public.coach_clients c where c.coach_id = p.id))
  from public.profiles p where p.id = auth.uid();
$$;
-- La administradora puede cambiar el plan de un entrenador (mientras se conectan los pagos)
create or replace function public.admin_set_coach_plan(nick text, plan text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo la administradora'; end if;
  update public.profiles set coach_plan = plan where lower(nickname) = lower(nick) and role = 'coach';
end $$;
grant execute on function public.become_coach(text), public.my_coach_invites(), public.respond_coach_invite(uuid, boolean), public.my_coach_plan(), public.admin_set_coach_plan(text, text) to authenticated;

-- Comprobación: estas cuentas son ahora administradoras (deberían ser solo las tuyas)
select u.email, p.nickname, p.role from public.profiles p join auth.users u on u.id = p.id where p.role = 'admin';
