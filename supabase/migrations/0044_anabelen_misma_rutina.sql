-- ARC · Ana Belén hace el mismo entreno que Cynthia (pégalo después del de Cynthia)
update public.coach_clients
set routine = (select routine from public.coach_clients where email = 'cynthiatuset@gmail.com' and routine is not null limit 1), updated_at = now()
where email = 'anabelen.hago@gmail.com';

select name, coalesce(jsonb_array_length(routine), 0) as dias, (client_id is not null) as unida
from public.coach_clients where email in ('cynthiatuset@gmail.com', 'anabelen.hago@gmail.com');
