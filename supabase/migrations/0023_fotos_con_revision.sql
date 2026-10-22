-- =====================================================================
-- ARC · las fotos de perfil no se ven hasta que la coach las aprueba
-- (Apple pide filtrar el contenido que suben los usuarios antes de que lo vean los demás)
-- =====================================================================

alter table public.profiles add column if not exists avatar_pending text;

-- La usuaria ya no puede poner su foto pública directamente: sube una "pendiente"
revoke update (avatar_url) on public.profiles from authenticated;
grant update (avatar_pending, profile_public) on public.profiles to authenticated;

-- Quitar mi foto (la pública y la pendiente)
create or replace function public.clear_my_avatar()
returns void language plpgsql security definer set search_path = public as $$
begin
  update profiles set avatar_url = null, avatar_pending = null where id = auth.uid();
end $$;
grant execute on function public.clear_my_avatar() to authenticated;

-- Coach: fotos esperando revisión
create or replace function public.pending_avatars()
returns table (nickname text, avatar_pending text)
language sql stable security definer set search_path = public as $$
  select nickname, avatar_pending from profiles
  where public.is_coach() and avatar_pending is not null and nickname is not null and not rank_hidden
  order by updated_at desc nulls last;
$$;
grant execute on function public.pending_avatars() to authenticated;

-- Coach: aprobar (pasa a ser la foto pública) o rechazar
create or replace function public.review_avatar(nick text, ok boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_coach() then raise exception 'Solo la coach puede hacer esto'; end if;
  if ok then
    update profiles set avatar_url = avatar_pending, avatar_pending = null where lower(nickname) = lower(nick) and avatar_pending is not null;
  else
    update profiles set avatar_pending = null where lower(nickname) = lower(nick);
  end if;
end $$;
grant execute on function public.review_avatar(text, boolean) to authenticated;

-- Quitar una foto denunciada también borra la pendiente
create or replace function public.clear_avatar(nick text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_coach() then raise exception 'Solo la coach puede hacer esto'; end if;
  update profiles set avatar_url = null, avatar_pending = null where lower(nickname) = lower(nick);
  update rank_reports set resolved = true where lower(nickname) = lower(nick);
end $$;
grant execute on function public.clear_avatar(text) to authenticated;
