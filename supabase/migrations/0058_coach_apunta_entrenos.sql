-- ARC · la coach puede apuntar, corregir y borrar entrenos de sus asesorad@s
alter table public.workout_sessions add column if not exists by_coach boolean not null default false;

drop policy if exists "coach apunta entrenos" on public.workout_sessions;
create policy "coach apunta entrenos" on public.workout_sessions for insert
  with check (public.is_coach() and exists (select 1 from public.coach_clients c where c.client_id = workout_sessions.user_id));
drop policy if exists "coach corrige entrenos" on public.workout_sessions;
create policy "coach corrige entrenos" on public.workout_sessions for update
  using (public.is_coach() and exists (select 1 from public.coach_clients c where c.client_id = workout_sessions.user_id))
  with check (public.is_coach() and exists (select 1 from public.coach_clients c where c.client_id = workout_sessions.user_id));
drop policy if exists "coach borra entrenos" on public.workout_sessions;
create policy "coach borra entrenos" on public.workout_sessions for delete
  using (public.is_coach() and exists (select 1 from public.coach_clients c where c.client_id = workout_sessions.user_id));

-- Si lo apunta la coach, suma XP igual pero no le cierra el entreno que tenga abierto
create or replace function public.reward_session() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id = auth.uid() then
    update public.profiles set xp = xp + 40, gems = gems + 5, active_session = null, updated_at = now() where id = new.user_id;
  else
    update public.profiles set xp = xp + 40, gems = gems + 5, updated_at = now() where id = new.user_id;
  end if;
  return new;
end $$;
