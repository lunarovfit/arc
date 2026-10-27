-- ARC · guardar lo que comes cada día (recetas marcadas y tus cantidades)
alter table public.habits add column if not exists food jsonb;
