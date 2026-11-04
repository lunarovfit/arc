-- ARC · Cuando la coach apunta un entreno de su asesorad@, le llega un aviso con un mensaje motivador
alter table public.notifications add column if not exists msg text;
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('friend_req', 'friend_ok', 'like', 'comment', 'mention', 'tag', 'coach_log'));

create or replace function public.notify_coach_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  frases text[] := array[
    'Hoy lo has dado todo. Cada kilo que subes es tuyo.',
    'Buen entreno. Lo que haces hoy se nota en unas semanas.',
    'Otro día más sumando. Así es como se cambia de verdad.',
    'Qué bien lo has hecho hoy. Descansa, come bien y a por el siguiente!',
    'Entreno guardado. La constancia te está llevando lejos.',
    'Hoy has entrenado como alguien que va en serio. Sigue así.',
    'Cada sesión cuenta, y esta ha sido de las buenas.',
    'Orgullosa de cómo estás entrenando. Mañana, a recuperar.'
  ];
begin
  if new.by_coach and new.user_id <> auth.uid() then
    insert into public.notifications (user_id, actor, kind, session_id, msg)
    values (new.user_id, auth.uid(), 'coach_log', new.id, frases[1 + floor(random() * array_length(frases, 1))::int]);
  end if;
  return new;
end $$;
drop trigger if exists on_coach_log on public.workout_sessions;
create trigger on_coach_log after insert on public.workout_sessions
  for each row execute function public.notify_coach_log();

-- El aviso muestra el mensaje (los comentarios siguen igual)
create or replace function public.my_notifications(lim int default 40)
returns table (id bigint, kind text, nickname text, avatar_url text, branch text, mode text, level int, session_id uuid, day_name text, body text, read boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select n.id, n.kind, p.nickname, p.avatar_url, p.data->>'branch', coalesce(p.data->>'mode', 'otaku'), p.level, n.session_id,
    (select day_name from workout_sessions w where w.id = n.session_id),
    coalesce(n.msg, (select left(body, 120) from feed_comments c where c.id = n.comment_id and not c.hidden)),
    n.read, n.created_at
  from notifications n left join profiles p on p.id = n.actor
  where n.user_id = auth.uid() and (n.actor is null or not public._blocked_between(auth.uid(), n.actor))
  order by n.created_at desc
  limit least(greatest(lim, 1), 100);
$$;
