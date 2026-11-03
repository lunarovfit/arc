-- ARC · Irene: niveles con número, sin personajes de anime
update public.coach_clients set mode = 'clasico', updated_at = now()
where lower(email) = 'irepraga_89@hotmail.com';

select name, email, mode from public.coach_clients where lower(email) = 'irepraga_89@hotmail.com';
