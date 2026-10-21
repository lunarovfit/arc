-- =====================================================================
-- ARC · ranking con fotos de perfil, perfiles públicos y buscador
-- Pégalo en Supabase > SQL Editor y dale a Run.
-- =====================================================================

-- Foto de perfil y si el perfil se puede ver
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists profile_public boolean not null default true;
grant update (avatar_url, profile_public) on public.profiles to authenticated;

-- Carpeta pública para las fotos de perfil (cada una solo toca la suya)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/*'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: sube la suya" on storage.objects;
create policy "avatars: sube la suya" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars: cambia la suya" on storage.objects;
create policy "avatars: cambia la suya" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars: borra la suya" on storage.objects;
create policy "avatars: borra la suya" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Ranking semanal, ahora con la foto
drop function if exists public.weekly_ranking(int);
create function public.weekly_ranking(weeks_ago int default 0)
returns table (rank int, nickname text, branch text, mode text, level int, points int, is_me boolean, avatar_url text, days int)
language sql stable security definer set search_path = public as $$
  with bounds as (
    select (date_trunc('week', now() at time zone 'Europe/Madrid') - make_interval(weeks => weeks_ago))::date as d0
  ),
  train as (
    select w.user_id, count(distinct (w.performed_at at time zone 'Europe/Madrid')::date) as n
    from workout_sessions w, bounds b
    where (w.performed_at at time zone 'Europe/Madrid')::date >= b.d0
      and (w.performed_at at time zone 'Europe/Madrid')::date < b.d0 + 7
    group by w.user_id
  ),
  hab as (
    select h.user_id, count(*) as n
    from habits h, bounds b
    where h.day >= b.d0 and h.day < b.d0 + 7
      and ((coalesce(h.water, 0) >= 8)::int + (coalesce(h.steps, 0) >= 10000)::int + (coalesce(h.sleep, 0) >= 7)::int) >= 2
    group by h.user_id
  ),
  pts as (
    select p.id, p.nickname, p.data->>'branch' as branch, coalesce(p.data->>'mode', 'otaku') as mode, p.level, p.avatar_url,
           coalesce(t.n, 0)::int as days,
           (coalesce(t.n, 0) * 40 + coalesce(h.n, 0) * 15)::int as points
    from profiles p
    left join train t on t.user_id = p.id
    left join hab h on h.user_id = p.id
    where p.rank_opt_in and not p.rank_hidden and p.nickname is not null
  )
  select (rank() over (order by points desc))::int, nickname, branch, mode, level, points, id = auth.uid(), avatar_url, days
  from pts
  order by points desc, nickname
  limit 100;
$$;
grant execute on function public.weekly_ranking(int) to authenticated;

-- Buscar perfiles por apodo
create or replace function public.search_profiles(q text)
returns table (nickname text, branch text, mode text, level int, avatar_url text, is_me boolean)
language sql stable security definer set search_path = public as $$
  select p.nickname, p.data->>'branch', coalesce(p.data->>'mode', 'otaku'), p.level, p.avatar_url, p.id = auth.uid()
  from profiles p
  where p.rank_opt_in and not p.rank_hidden and p.nickname is not null
    and (p.profile_public or p.id = auth.uid())
    and length(trim(q)) >= 2 and p.nickname ilike '%' || replace(replace(trim(q), '%', ''), '_', '\_') || '%'
  order by (lower(p.nickname) = lower(trim(q))) desc, length(p.nickname), p.nickname
  limit 20;
$$;
grant execute on function public.search_profiles(text) to authenticated;

-- Perfil público: nivel, días entrenados y la carga de la semana (series y kilos por ejercicio).
-- Nunca devuelve peso corporal, medidas, fotos de progreso ni nada privado.
create or replace function public.public_profile(nick text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p profiles%rowtype;
  d0 date := date_trunc('week', now() at time zone 'Europe/Madrid')::date;
  res jsonb;
begin
  select * into p from profiles
  where lower(nickname) = lower(nick) and rank_opt_in and not rank_hidden;
  if not found then return null; end if;
  if not p.profile_public and p.id <> auth.uid() then
    return jsonb_build_object('nickname', p.nickname, 'private', true, 'avatar_url', p.avatar_url,
      'branch', p.data->>'branch', 'mode', coalesce(p.data->>'mode', 'otaku'), 'level', p.level);
  end if;

  select jsonb_build_object(
    'nickname', p.nickname, 'private', false, 'is_me', p.id = auth.uid(), 'avatar_url', p.avatar_url,
    'branch', p.data->>'branch', 'mode', coalesce(p.data->>'mode', 'otaku'), 'level', p.level,
    'since', p.start_date,
    'total_sessions', (select count(*) from workout_sessions w where w.user_id = p.id),
    -- días entrenados en cada una de las últimas 8 semanas (la última es la actual)
    'weeks', (
      select jsonb_agg(coalesce(x.n, 0) order by g.k desc)
      from generate_series(0, 7) as g(k)
      left join lateral (
        select count(distinct (w.performed_at at time zone 'Europe/Madrid')::date) as n
        from workout_sessions w
        where w.user_id = p.id
          and (w.performed_at at time zone 'Europe/Madrid')::date >= d0 - g.k * 7
          and (w.performed_at at time zone 'Europe/Madrid')::date < d0 - g.k * 7 + 7
      ) x on true
    ),
    -- qué días de esta semana ha entrenado (1 = lunes … 7 = domingo)
    'week_days', coalesce((
      select jsonb_agg(distinct extract(isodow from w.performed_at at time zone 'Europe/Madrid')::int)
      from workout_sessions w
      where w.user_id = p.id and (w.performed_at at time zone 'Europe/Madrid')::date >= d0
    ), '[]'::jsonb),
    'week_volume', coalesce((select sum(w.volume_kg) from workout_sessions w
      where w.user_id = p.id and (w.performed_at at time zone 'Europe/Madrid')::date >= d0), 0),
    'week_sets', coalesce((select sum(w.sets_done) from workout_sessions w
      where w.user_id = p.id and (w.performed_at at time zone 'Europe/Madrid')::date >= d0), 0),
    -- series hechas por ejercicio esta semana (la app las agrupa por músculo)
    'week_ex', coalesce((
      select jsonb_object_agg(ex_id, n) from (
        select e->>'exId' as ex_id, count(*) as n
        from workout_sessions w
        cross join lateral jsonb_array_elements(w.exercises) e
        cross join lateral jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) s
        where w.user_id = p.id and (w.performed_at at time zone 'Europe/Madrid')::date >= d0
          and coalesce((s->>'done')::boolean, false) and coalesce(s->>'type', '') <> 'W'
        group by 1
      ) t
    ), '{}'::jsonb),
    -- últimos 3 entrenos (nombre del día, fecha, duración y kilos)
    'last', coalesce((
      select jsonb_agg(jsonb_build_object('name', w.day_name, 'at', w.performed_at, 'dur', w.duration_s, 'kg', w.volume_kg, 'sets', w.sets_done) order by w.performed_at desc)
      from (select * from workout_sessions w where w.user_id = p.id order by performed_at desc limit 3) w
    ), '[]'::jsonb)
  ) into res;
  return res;
end $$;
grant execute on function public.public_profile(text) to authenticated;

-- La coach quita una foto de perfil denunciada (sin echar a la persona del ranking)
create or replace function public.clear_avatar(nick text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_coach() then raise exception 'Solo la coach puede hacer esto'; end if;
  update profiles set avatar_url = null where lower(nickname) = lower(nick);
  update rank_reports set resolved = true where lower(nickname) = lower(nick);
end $$;
grant execute on function public.clear_avatar(text) to authenticated;

-- Para la coach: ver la foto de quien ha sido denunciada
create or replace function public.avatar_of(nick text)
returns text language sql stable security definer set search_path = public as $$
  select avatar_url from profiles where lower(nickname) = lower(nick) and public.is_coach();
$$;
grant execute on function public.avatar_of(text) to authenticated;

-- Eliminar cuenta: también borra la foto de perfil
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'No autenticado'; end if;
  begin
    delete from storage.objects where bucket_id in ('checkins', 'avatars') and (storage.foldername(name))[1] = uid::text;
  exception when others then null;
  end;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
