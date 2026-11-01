-- ARC · Revisión semanal completa en la app: más medidas, pasos de la semana, respuestas y permiso para stories
alter table public.client_checkins add column if not exists arm numeric;
alter table public.client_checkins add column if not exists thigh numeric;
alter table public.client_checkins add column if not exists shoulders numeric;
alter table public.client_checkins add column if not exists chest numeric;
alter table public.client_checkins add column if not exists steps int;
alter table public.client_checkins add column if not exists answers jsonb;
alter table public.client_checkins add column if not exists share text;
