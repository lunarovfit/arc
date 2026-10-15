-- =====================================================================
-- ARC by Lunarovx · ranking semanal
-- Pégalo en Supabase > SQL Editor y dale a Run.
-- La semana va de lunes a domingo (hora de España) y se reinicia sola.
-- Puntos: +40 por día con entreno, +15 por día con hábitos cumplidos
-- (al menos 2 de 3: 8 vasos de agua, 10.000 pasos, 7 h de sueño).
-- =====================================================================

alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists rank_opt_in boolean not null default false;
alter table public.profiles add column if not exists rank_hidden boolean not null default false;
alter table public.profiles add column if not exists level int not null default 0;
create unique index if not exists profiles_nickname_unique on public.profiles (lower(nickname));

-- La usuaria elige apodo, entra o sale y actualiza su nivel; no puede quitarse un bloqueo de la coach
grant update (nickname, rank_opt_in, level) on public.profiles to authenticated;

create or replace function public.weekly_ranking(weeks_ago int default 0)
returns table (rank int, nickname text, branch text, level int, points int, is_me boolean)
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
    select p.id, p.nickname, p.data->>'branch' as branch, p.level,
           (coalesce(t.n, 0) * 40 + coalesce(h.n, 0) * 15)::int as points
    from profiles p
    left join train t on t.user_id = p.id
    left join hab h on h.user_id = p.id
    where p.rank_opt_in and not p.rank_hidden and p.nickname is not null
  )
  select (rank() over (order by points desc))::int, nickname, branch, level, points, id = auth.uid()
  from pts
  where points > 0 or id = auth.uid()
  order by points desc, nickname
  limit 100;
$$;
grant execute on function public.weekly_ranking(int) to authenticated;

-- ---------- Denuncias ----------
create table if not exists public.rank_reports (
  id bigint generated always as identity primary key,
  reporter uuid not null default auth.uid() references auth.users on delete cascade,
  nickname text not null,
  reason text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.rank_reports enable row level security;
drop policy if exists "denunciar" on public.rank_reports;
create policy "denunciar" on public.rank_reports for insert to authenticated with check (reporter = auth.uid());
drop policy if exists "coach revisa" on public.rank_reports;
create policy "coach revisa" on public.rank_reports for select to authenticated using (public.is_coach());
drop policy if exists "coach resuelve" on public.rank_reports;
create policy "coach resuelve" on public.rank_reports for update to authenticated using (public.is_coach());

-- La coach quita a alguien del ranking y le borra el apodo para que elija otro
create or replace function public.hide_from_ranking(nick text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_coach() then raise exception 'Solo la coach puede hacer esto'; end if;
  update profiles set rank_hidden = true, nickname = null where lower(nickname) = lower(nick);
  update rank_reports set resolved = true where lower(nickname) = lower(nick);
end $$;
grant execute on function public.hide_from_ranking(text) to authenticated;
