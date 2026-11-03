-- ARC · insignias en el perfil: retos antiguos y programas de personaje completados
create or replace function public.public_profile(nick text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p profiles%rowtype;
  d0 date := date_trunc('week', now() at time zone 'Europe/Madrid')::date;
  res jsonb;
begin
  select * into p from profiles
  where lower(nickname) = lower(nick) and not rank_hidden
    and (rank_opt_in or id = auth.uid() or public._are_friends(auth.uid(), id))
    and not public._blocked_between(auth.uid(), id);
  if not found then return null; end if;
  if not p.profile_public and p.id <> auth.uid() and not (public._are_friends(auth.uid(), p.id) and p.share_feed) then
    return jsonb_build_object('nickname', p.nickname, 'private', true, 'avatar_url', p.avatar_url,
      'branch', p.data->>'branch', 'mode', coalesce(p.data->>'mode', 'otaku'), 'level', p.level);
  end if;

  select jsonb_build_object(
    'nickname', p.nickname, 'private', false, 'is_me', p.id = auth.uid(), 'friend', public._are_friends(auth.uid(), p.id), 'avatar_url', p.avatar_url,
    'branch', p.data->>'branch', 'mode', coalesce(p.data->>'mode', 'otaku'), 'level', p.level,
    'since', p.start_date,
    'program', p.data->>'program', 'goal_days', coalesce((p.data->>'days')::int, 3),
    -- 3 mejores marcas (1RM estimado con series de 10 reps o menos)
    'records', coalesce((
      select jsonb_agg(jsonb_build_object('exId', ex_id, 'kg', kg, 'reps', reps, 'e1', round(e1)) order by e1 desc) from (select * from (
        select distinct on (ex_id) ex_id, kg, reps, e1 from (
          select e->>'exId' as ex_id, (s->>'kg')::numeric as kg, (s->>'reps')::int as reps,
                 (s->>'kg')::numeric * (1 + (s->>'reps')::numeric / 30) as e1
          from workout_sessions w
          cross join lateral jsonb_array_elements(w.exercises) e
          cross join lateral jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) s
          where w.user_id = p.id and coalesce((s->>'done')::boolean, false) and coalesce(s->>'type', '') <> 'W'
            and (s->>'kg') ~ '^[0-9]+([.][0-9]+)?$' and (s->>'reps') ~ '^[0-9]+$'
            and (s->>'reps')::int between 1 and 10 and (s->>'kg')::numeric > 0
            and (p.feed_show_kg or p.id = auth.uid())
        ) x order by ex_id, e1 desc
      ) y order by e1 desc limit 3) z
    ), '[]'::jsonb),
    -- insignias: retos de personaje superados (la primera vez de cada uno)
    'badges', coalesce((
      with r as (
        select w.day_id, min(w.performed_at) as at from workout_sessions w
        where w.user_id = p.id and w.day_id like 'R:%' group by w.day_id
      ), b as (
        -- retos semanales antiguos (R:maki)
        select 'R:' || split_part(day_id, ':', 2) as id, min(at) as at from r
        where array_length(string_to_array(day_id, ':'), 1) = 2 group by 1
        union all
        -- programas de personaje (R:maki:5:A): insignia al completar todos sus días
        select 'R:' || split_part(day_id, ':', 2), max(at) from r
        where array_length(string_to_array(day_id, ':'), 1) = 4
        group by split_part(day_id, ':', 2), split_part(day_id, ':', 3)
        having count(*) >= split_part(day_id, ':', 3)::int
      )
      select jsonb_agg(jsonb_build_object('id', id, 'at', at) order by at desc)
      from (select id, min(at) as at from b group by id) x
    ), '[]'::jsonb),
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
revoke all on function public.public_profile(text) from anon;
