-- ARC · alta de Cynthia y Ana Belén como asesoradas de Luna (presencial con Adán)
-- Se unen solas a su cuenta por el correo. La rutina se añade cuando esté su plan.
insert into public.coach_clients (coach_id, email, name)
select c.id, x.email, x.name
from (select id from public.profiles where role = 'coach' order by created_at nulls last limit 1) c
cross join (values ('cynthiatuset@gmail.com', 'Cynthia'), ('anabelen.hago@gmail.com', 'Ana Belén')) as x(email, name)
on conflict (coach_id, email) do update set name = excluded.name, updated_at = now();

-- Comprobación: deberían salir las dos; "unida" = sí si ya tienen cuenta en la app
select name, email, (client_id is not null) as unida from public.coach_clients
where email in ('cynthiatuset@gmail.com', 'anabelen.hago@gmail.com');
