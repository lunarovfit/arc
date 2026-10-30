-- =====================================================================
-- ARC · Amigos: agregar gente, ver sus entrenos, "fuego", comentarios,
-- menciones con @, etiquetar en un entreno, avisos, bloquear y denunciar.
-- Pégalo en Supabase > SQL Editor y dale a Run. Se puede pegar dos veces.
-- =====================================================================

-- Qué ven tus amig@s de ti
alter table public.profiles add column if not exists share_feed boolean not null default true;   -- tus entrenos salen en su feed
alter table public.profiles add column if not exists feed_show_kg boolean not null default true; -- se ven tus kilos
grant update (share_feed, feed_show_kg) on public.profiles to authenticated;

-- ---------- Tablas (nadie las toca directamente: todo va por las funciones de abajo) ----------
create table if not exists public.friendships (
  requester uuid not null references auth.users on delete cascade,
  addressee uuid not null references auth.users on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee on public.friendships (addressee);

create table if not exists public.user_blocks (
  blocker uuid not null references auth.users on delete cascade,
  blocked uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

create table if not exists public.feed_likes (
  session_id uuid not null references public.workout_sessions on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create table if not exists public.feed_comments (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.workout_sessions on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  body text not null check (length(trim(body)) between 1 and 500),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists feed_comments_session on public.feed_comments (session_id, created_at);

create table if not exists public.session_tags (
  session_id uuid not null references public.workout_sessions on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  primary key (session_id, user_id)
);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,   -- quien lo recibe
  actor uuid references auth.users on delete cascade,              -- quien lo hace
  kind text not null check (kind in ('friend_req', 'friend_ok', 'like', 'comment', 'mention', 'tag')),
  session_id uuid references public.workout_sessions on delete cascade,
  comment_id bigint references public.feed_comments on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on public.notifications (user_id, created_at desc);

alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;
alter table public.feed_likes enable row level security;
alter table public.feed_comments enable row level security;
alter table public.session_tags enable row level security;
alter table public.notifications enable row level security;

-- ---------- Ayudantes ----------
create or replace function public._uid_of(nick text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where lower(nickname) = lower(trim(nick)) and not coalesce(rank_hidden, false) limit 1;
$$;

create or replace function public._blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

create or replace function public._are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships where status = 'accepted'
    and ((requester = a and addressee = b) or (requester = b and addressee = a)));
$$;

-- ¿Puedo ver este entreno? (es mío, o de un amig@ que comparte y no hay bloqueo)
create or replace function public._can_see_session(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from workout_sessions w join profiles p on p.id = w.user_id
    where w.id = sid and (w.user_id = auth.uid()
      or (p.share_feed and public._are_friends(auth.uid(), w.user_id) and not public._blocked_between(auth.uid(), w.user_id)))
  );
$$;

create or replace function public._notify(target uuid, k text, sid uuid default null, cid bigint default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if target is null or target = auth.uid() or public._blocked_between(target, auth.uid()) then return; end if;
  -- no repetir el mismo aviso de "fuego" o solicitud
  if k in ('like', 'friend_req', 'tag') and exists (
    select 1 from notifications where user_id = target and actor = auth.uid() and kind = k
      and session_id is not distinct from sid and created_at > now() - interval '1 day') then return; end if;
  insert into notifications (user_id, actor, kind, session_id, comment_id) values (target, auth.uid(), k, sid, cid);
end $$;

-- Apodo propio (para poder tener amig@s sin entrar al ranking)
create or replace function public.set_my_nickname(nick text) returns void
language plpgsql security definer set search_path = public as $$
declare n text := trim(nick);
begin
  if n !~ '^[A-Za-z0-9_.ÁÉÍÓÚáéíóúÑñÜü]{3,20}$' then raise exception 'Usa de 3 a 20 letras, números, punto o guion bajo'; end if;
  if exists (select 1 from profiles where lower(nickname) = lower(n) and id <> auth.uid()) then raise exception 'Ese apodo ya está cogido'; end if;
  update profiles set nickname = n where id = auth.uid();
end $$;

-- ---------- Buscar gente ----------
create or replace function public.search_people(q text)
returns table (nickname text, branch text, mode text, level int, avatar_url text, relation text)
language sql stable security definer set search_path = public as $$
  select p.nickname, p.data->>'branch', coalesce(p.data->>'mode', 'otaku'), p.level, p.avatar_url,
    case
      when public._are_friends(auth.uid(), p.id) then 'friend'
      when exists (select 1 from friendships f where f.requester = auth.uid() and f.addressee = p.id) then 'outgoing'
      when exists (select 1 from friendships f where f.requester = p.id and f.addressee = auth.uid()) then 'incoming'
      else 'none' end
  from profiles p
  where p.nickname is not null and not coalesce(p.rank_hidden, false) and p.id <> auth.uid()
    and not public._blocked_between(auth.uid(), p.id)
    and length(trim(q)) >= 2 and p.nickname ilike '%' || replace(replace(trim(q), '%', ''), '_', '\_') || '%'
  order by (lower(p.nickname) = lower(trim(q))) desc, length(p.nickname), p.nickname
  limit 20;
$$;

-- ---------- Amistades ----------
create or replace function public.friend_request(nick text) returns text
language plpgsql security definer set search_path = public as $$
declare other uuid := public._uid_of(nick);
begin
  if (select nickname from profiles where id = auth.uid()) is null then raise exception 'Ponte un apodo primero'; end if;
  if other is null or other = auth.uid() then raise exception 'No existe nadie con ese apodo'; end if;
  if public._blocked_between(auth.uid(), other) then raise exception 'No puedes agregar a esta persona'; end if;
  if public._are_friends(auth.uid(), other) then return 'friend'; end if;
  -- si esa persona ya me lo había pedido, quedamos como amig@s
  if exists (select 1 from friendships where requester = other and addressee = auth.uid()) then
    update friendships set status = 'accepted' where requester = other and addressee = auth.uid();
    perform public._notify(other, 'friend_ok');
    return 'friend';
  end if;
  insert into friendships (requester, addressee) values (auth.uid(), other) on conflict do nothing;
  perform public._notify(other, 'friend_req');
  return 'outgoing';
end $$;

create or replace function public.friend_respond(nick text, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare other uuid := public._uid_of(nick);
begin
  if accept then
    update friendships set status = 'accepted' where requester = other and addressee = auth.uid() and status = 'pending';
    if found then perform public._notify(other, 'friend_ok'); end if;
  else
    delete from friendships where requester = other and addressee = auth.uid() and status = 'pending';
  end if;
  delete from notifications where user_id = auth.uid() and actor = other and kind = 'friend_req';
end $$;

create or replace function public.friend_remove(nick text) returns void
language plpgsql security definer set search_path = public as $$
declare other uuid := public._uid_of(nick);
begin
  delete from friendships where (requester = auth.uid() and addressee = other) or (requester = other and addressee = auth.uid());
end $$;

create or replace function public.friends_list()
returns table (nickname text, branch text, mode text, level int, avatar_url text, relation text, last_at timestamptz, week_days int)
language sql stable security definer set search_path = public as $$
  select p.nickname, p.data->>'branch', coalesce(p.data->>'mode', 'otaku'), p.level, p.avatar_url,
    case when f.status = 'accepted' then 'friend' when f.requester = auth.uid() then 'outgoing' else 'incoming' end,
    case when f.status = 'accepted' and p.share_feed then (select max(performed_at) from workout_sessions w where w.user_id = p.id) end,
    case when f.status = 'accepted' and p.share_feed then (select count(distinct (w.performed_at at time zone 'Europe/Madrid')::date)::int from workout_sessions w
      where w.user_id = p.id and (w.performed_at at time zone 'Europe/Madrid')::date >= date_trunc('week', now() at time zone 'Europe/Madrid')::date) else 0 end
  from friendships f
  join profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where (f.requester = auth.uid() or f.addressee = auth.uid()) and p.nickname is not null
    and not public._blocked_between(auth.uid(), p.id)
  order by (f.status = 'pending' and f.addressee = auth.uid()) desc, p.nickname;
$$;

-- ---------- Bloquear ----------
create or replace function public.block_user(nick text) returns void
language plpgsql security definer set search_path = public as $$
declare other uuid := public._uid_of(nick);
begin
  if other is null or other = auth.uid() then return; end if;
  insert into user_blocks (blocker, blocked) values (auth.uid(), other) on conflict do nothing;
  delete from friendships where (requester = auth.uid() and addressee = other) or (requester = other and addressee = auth.uid());
  delete from notifications where user_id = auth.uid() and actor = other;
end $$;

create or replace function public.unblock_all() returns void
language sql security definer set search_path = public as $$
  delete from user_blocks where blocker = auth.uid();
$$;

-- ---------- Feed de entrenos ----------
create or replace function public.friends_feed(before timestamptz default null, lim int default 20)
returns table (id uuid, nickname text, avatar_url text, branch text, mode text, level int, is_me boolean,
  performed_at timestamptz, day_name text, duration_s int, volume_kg numeric, sets_done int, exercises jsonb,
  likes int, liked boolean, comments int, tags jsonb)
language sql stable security definer set search_path = public as $$
  select w.id, p.nickname, p.avatar_url, p.data->>'branch', coalesce(p.data->>'mode', 'otaku'), p.level, w.user_id = auth.uid(),
    w.performed_at, w.day_name, w.duration_s,
    case when p.feed_show_kg or w.user_id = auth.uid() then w.volume_kg end,
    w.sets_done,
    -- por ejercicio: series hechas y la mejor serie (sin kilos si la persona no los enseña)
    coalesce((
      select jsonb_agg(jsonb_build_object('exId', e->>'exId', 'n', x.n, 'kg', case when p.feed_show_kg or w.user_id = auth.uid() then x.kg end, 'reps', x.reps, 'note', nullif(e->>'note', '')))
      from jsonb_array_elements(w.exercises) e
      cross join lateral (
        select count(*)::int as n,
          (array_agg(nullif(s->>'kg', '') order by coalesce(nullif(s->>'kg', '')::numeric, 0) desc, coalesce(nullif(s->>'reps', '')::numeric, 0) desc))[1] as kg,
          (array_agg(nullif(s->>'reps', '') order by coalesce(nullif(s->>'kg', '')::numeric, 0) desc, coalesce(nullif(s->>'reps', '')::numeric, 0) desc))[1] as reps
        from jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) s
        where coalesce((s->>'done')::boolean, false) and coalesce(s->>'type', '') <> 'W'
      ) x
      where x.n > 0
    ), '[]'::jsonb),
    (select count(*)::int from feed_likes l where l.session_id = w.id),
    exists (select 1 from feed_likes l where l.session_id = w.id and l.user_id = auth.uid()),
    (select count(*)::int from feed_comments c where c.session_id = w.id and not c.hidden
      and not public._blocked_between(auth.uid(), c.user_id)),
    coalesce((select jsonb_agg(tp.nickname) from session_tags t join profiles tp on tp.id = t.user_id where t.session_id = w.id and tp.nickname is not null), '[]'::jsonb)
  from workout_sessions w
  join profiles p on p.id = w.user_id
  where p.nickname is not null
    and (w.user_id = auth.uid()
      or (p.share_feed and public._are_friends(auth.uid(), w.user_id) and not public._blocked_between(auth.uid(), w.user_id))
      or exists (select 1 from session_tags t where t.session_id = w.id and t.user_id = auth.uid()) and not public._blocked_between(auth.uid(), w.user_id))
    and (before is null or w.performed_at < before)
  order by w.performed_at desc
  limit least(greatest(lim, 1), 50);
$$;

-- "Fuego" (me gusta). Devuelve si ahora está puesto.
create or replace function public.toggle_like(sid uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public._can_see_session(sid) then raise exception 'No puedes ver este entreno'; end if;
  if exists (select 1 from feed_likes where session_id = sid and user_id = auth.uid()) then
    delete from feed_likes where session_id = sid and user_id = auth.uid();
    return false;
  end if;
  insert into feed_likes (session_id, user_id) values (sid, auth.uid());
  perform public._notify((select user_id from workout_sessions where id = sid), 'like', sid);
  return true;
end $$;

-- ---------- Comentarios ----------
create or replace function public.session_comments(sid uuid)
returns table (id bigint, nickname text, avatar_url text, branch text, mode text, level int, body text, created_at timestamptz, is_me boolean, can_delete boolean)
language sql stable security definer set search_path = public as $$
  select c.id, p.nickname, p.avatar_url, p.data->>'branch', coalesce(p.data->>'mode', 'otaku'), p.level, c.body, c.created_at,
    c.user_id = auth.uid(),
    c.user_id = auth.uid() or (select user_id from workout_sessions where id = sid) = auth.uid()
  from feed_comments c join profiles p on p.id = c.user_id
  where c.session_id = sid and not c.hidden and public._can_see_session(sid)
    and not public._blocked_between(auth.uid(), c.user_id)
  order by c.created_at;
$$;

create or replace function public.add_comment(sid uuid, txt text) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  cid bigint;
  owner uuid := (select user_id from workout_sessions where id = sid);
  m text;
  target uuid;
begin
  if (select nickname from profiles where id = auth.uid()) is null then raise exception 'Ponte un apodo primero'; end if;
  if not public._can_see_session(sid) then raise exception 'No puedes ver este entreno'; end if;
  if (select count(*) from feed_comments where user_id = auth.uid() and created_at > now() - interval '1 minute') >= 8 then
    raise exception 'Vas muy rápido. Espera un momento.';
  end if;
  insert into feed_comments (session_id, user_id, body) values (sid, auth.uid(), trim(txt)) returning id into cid;
  perform public._notify(owner, 'comment', sid, cid);
  -- menciones: @apodo de alguien que pueda ver el entreno
  for m in select distinct lower((regexp_matches(txt, '@([A-Za-z0-9_.ÁÉÍÓÚáéíóúÑñÜü]{3,20})', 'g'))[1]) loop
    target := public._uid_of(m);
    if target is not null and target <> owner and (public._are_friends(target, owner) or public._are_friends(target, auth.uid())) then
      perform public._notify(target, 'mention', sid, cid);
    end if;
  end loop;
  return cid;
end $$;

create or replace function public.delete_comment(cid bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from feed_comments c where c.id = cid
    and (c.user_id = auth.uid() or (select user_id from workout_sessions where id = c.session_id) = auth.uid() or public.is_coach());
end $$;

-- Denunciar un comentario: se oculta para quien denuncia y le llega a la coach
create or replace function public.report_comment(cid bigint, why text) returns void
language plpgsql security definer set search_path = public as $$
declare c feed_comments%rowtype; nick text;
begin
  select * into c from feed_comments where id = cid;
  if not found then return; end if;
  select nickname into nick from profiles where id = c.user_id;
  insert into rank_reports (reporter, nickname, reason) values (auth.uid(), coalesce(nick, '?'), '[comentario ' || cid || '] ' || left(c.body, 200) || ' · Motivo: ' || coalesce(nullif(trim(why), ''), 'sin motivo'));
end $$;

-- La coach oculta un comentario denunciado
create or replace function public.hide_comment(cid bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_coach() then raise exception 'Solo la coach puede hacer esto'; end if;
  update feed_comments set hidden = true where id = cid;
end $$;

-- ---------- Etiquetar amig@s en tu entreno ----------
create or replace function public.tag_session(sid uuid, nicks text[]) returns void
language plpgsql security definer set search_path = public as $$
declare n text; target uuid;
begin
  if (select user_id from workout_sessions where id = sid) <> auth.uid() then raise exception 'Solo puedes etiquetar en tus entrenos'; end if;
  delete from session_tags where session_id = sid;
  foreach n in array coalesce(nicks, '{}') loop
    target := public._uid_of(n);
    if target is not null and public._are_friends(auth.uid(), target) then
      insert into session_tags (session_id, user_id) values (sid, target) on conflict do nothing;
      perform public._notify(target, 'tag', sid);
    end if;
  end loop;
end $$;

-- ---------- Avisos ----------
create or replace function public.my_notifications(lim int default 40)
returns table (id bigint, kind text, nickname text, avatar_url text, branch text, mode text, level int, session_id uuid, day_name text, body text, read boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select n.id, n.kind, p.nickname, p.avatar_url, p.data->>'branch', coalesce(p.data->>'mode', 'otaku'), p.level, n.session_id,
    (select day_name from workout_sessions w where w.id = n.session_id),
    (select left(body, 120) from feed_comments c where c.id = n.comment_id and not c.hidden),
    n.read, n.created_at
  from notifications n left join profiles p on p.id = n.actor
  where n.user_id = auth.uid() and (n.actor is null or not public._blocked_between(auth.uid(), n.actor))
  order by n.created_at desc
  limit least(greatest(lim, 1), 100);
$$;

create or replace function public.unread_notifications() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from notifications where user_id = auth.uid() and not read;
$$;

create or replace function public.mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update notifications set read = true where user_id = auth.uid() and not read;
$$;

-- ---------- Perfil: tus amig@s lo ven aunque no salgan en el ranking ----------
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

-- ---------- Permisos ----------
do $$ declare f text; begin
  foreach f in array array[
    'set_my_nickname(text)', 'search_people(text)', 'friend_request(text)', 'friend_respond(text, boolean)', 'friend_remove(text)',
    'friends_list()', 'block_user(text)', 'unblock_all()', 'friends_feed(timestamptz, int)', 'toggle_like(uuid)',
    'session_comments(uuid)', 'add_comment(uuid, text)', 'delete_comment(bigint)', 'report_comment(bigint, text)', 'hide_comment(bigint)',
    'tag_session(uuid, text[])', 'my_notifications(int)', 'unread_notifications()', 'mark_notifications_read()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['_uid_of(text)', '_blocked_between(uuid, uuid)', '_are_friends(uuid, uuid)', '_can_see_session(uuid)', '_notify(uuid, text, uuid, bigint)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- Al borrar la cuenta, todo esto se borra solo (on delete cascade).
