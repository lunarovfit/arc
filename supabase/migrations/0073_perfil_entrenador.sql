-- Perfil de entrenador/a personalizable: nombre, foto, bio, contacto, color, bienvenida,
-- frases al apuntar entrenos y modo por defecto. Sus clientes lo ven en su app.

alter table public.profiles add column if not exists coach_info jsonb not null default '{}'::jsonb;

-- Pasa el nombre que se guardó al hacerse entrenador/a (antes iba en data.coachName)
update public.profiles
set coach_info = coach_info || jsonb_build_object('name', data->>'coachName')
where coalesce(data->>'coachName', '') <> '' and coalesce(coach_info->>'name', '') = '';

-- Hacerse entrenador/a: el nombre va al perfil de entrenador (no se pisa con los datos de entreno)
create or replace function public.become_coach(name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set role = 'coach', coach_info = coalesce(coach_info, '{}'::jsonb) || jsonb_build_object('name', left(trim(name), 40))
  where id = auth.uid() and role = 'client';
end $$;

-- Invitaciones: nombre y foto del entrenador/a
drop function if exists public.my_coach_invites();
create or replace function public.my_coach_invites()
returns table (id uuid, coach_name text, coach_photo text, coach_bio text)
language sql stable security definer set search_path = public as $$
  select c.id,
         coalesce(nullif(p.coach_info->>'name', ''), nullif(p.data->>'coachName', ''), p.nickname, 'Un entrenador'),
         nullif(p.coach_info->>'photo', ''),
         nullif(p.coach_info->>'bio', '')
  from public.coach_clients c
  join public.profiles p on p.id = c.coach_id
  where c.client_id = auth.uid() and not c.accepted;
$$;

-- Tu entrenador/a: lo que ve el cliente (solo el perfil público del entrenador, nada más)
create or replace function public.my_coach()
returns jsonb
language sql stable security definer set search_path = public as $$
  select (p.coach_info - 'logMsgs') || jsonb_build_object(
           'name', coalesce(nullif(p.coach_info->>'name', ''), nullif(p.data->>'coachName', ''), p.nickname, 'Tu entrenador/a'),
           'admin', p.role = 'admin')
  from public.coach_clients c
  join public.profiles p on p.id = c.coach_id
  where c.client_id = auth.uid() and c.accepted
  order by c.updated_at desc nulls last
  limit 1;
$$;

-- Aviso al cliente cuando su entrenador/a le apunta un entreno: usa sus frases si las ha escrito
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
  propias text[];
begin
  if new.by_coach and new.user_id <> auth.uid() then
    select array(select x from jsonb_array_elements_text(coalesce(coach_info->'logMsgs', '[]'::jsonb)) x where trim(x) <> '')
      into propias from public.profiles where id = auth.uid();
    if coalesce(array_length(propias, 1), 0) > 0 then frases := propias; end if;
    insert into public.notifications (user_id, actor, kind, session_id, msg)
    values (new.user_id, auth.uid(), 'coach_log', new.id, frases[1 + floor(random() * array_length(frases, 1))::int]);
  end if;
  return new;
end $$;

grant execute on function public.become_coach(text), public.my_coach_invites(), public.my_coach() to authenticated;
