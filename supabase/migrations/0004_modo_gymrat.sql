-- =====================================================================
-- ARC by Lunarovx · modo otaku / modo gymrat en el ranking
-- Pégalo en Supabase > SQL Editor y dale a Run (después de 0003_ranking.sql).
-- El ranking devuelve también el modo, para mostrar el personaje o la fase de la rata.
-- =====================================================================

drop function if exists public.weekly_ranking(int);

create function public.weekly_ranking(weeks_ago int default 0)
returns table (rank int, nickname text, branch text, mode text, level int, points int, is_me boolean)
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
    select p.id, p.nickname, p.data->>'branch' as branch, coalesce(p.data->>'mode', 'otaku') as mode, p.level,
           (coalesce(t.n, 0) * 40 + coalesce(h.n, 0) * 15)::int as points
    from profiles p
    left join train t on t.user_id = p.id
    left join hab h on h.user_id = p.id
    where p.rank_opt_in and not p.rank_hidden and p.nickname is not null
  )
  select (rank() over (order by points desc))::int, nickname, branch, mode, level, points, id = auth.uid()
  from pts
  where points > 0 or id = auth.uid()
  order by points desc, nickname
  limit 100;
$$;
grant execute on function public.weekly_ranking(int) to authenticated;
