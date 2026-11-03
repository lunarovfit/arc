-- ARC · Asesorad@s: entran directos a su rutina, sin cuestionario, y sin personajes de anime por defecto
-- (sus datos ya los tiene la coach en su Excel). Funciona con la app que ya tienen instalada.

alter table public.coach_clients add column if not exists profile jsonb; -- sexo, edad, altura, peso… (opcional)
alter table public.coach_clients alter column mode set default 'clasico';

-- Deja hecho el "cuestionario" de su cuenta con datos por defecto + los que ponga la coach
create or replace function public.coach_onboard(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from public.coach_clients where client_id = uid order by updated_at desc limit 1;
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

create or replace function public.coach_clients_onboard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.client_id is not null then perform public.coach_onboard(new.client_id); end if;
  return new;
end $$;
drop trigger if exists coach_clients_onboard on public.coach_clients;
create trigger coach_clients_onboard after insert or update of client_id, routine, mode, profile on public.coach_clients
  for each row execute function public.coach_clients_onboard();

-- Por si el perfil se crea después de unirse
create or replace function public.profiles_coach_onboard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.coach_onboard(new.id);
  return new;
end $$;
drop trigger if exists profiles_coach_onboard on public.profiles;
create trigger profiles_coach_onboard after insert on public.profiles
  for each row execute function public.profiles_coach_onboard();

-- Las que ya están registradas y aún no han pasado el cuestionario
select public.coach_onboard(client_id) from public.coach_clients where client_id is not null;
