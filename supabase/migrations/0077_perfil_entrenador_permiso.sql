-- El entrenador/a puede guardar su propio perfil (foto, bio, contacto, color...).
-- El plan y el rol siguen sin poder tocarse desde la app.
grant update (coach_info) on public.profiles to authenticated;
