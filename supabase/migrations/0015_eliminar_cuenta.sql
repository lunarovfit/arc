-- ARC · eliminar cuenta desde la app (Ajustes → Eliminar mi cuenta)
-- Borra al usuario que lo pide y, en cascada, todos sus datos.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'No autenticado'; end if;
  -- fotos de revisiones
  delete from storage.objects where bucket_id = 'checkins' and (storage.foldername(name))[1] = uid::text;
  -- la cuenta (perfil, entrenos, hábitos, ranking y revisiones se borran en cascada)
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
