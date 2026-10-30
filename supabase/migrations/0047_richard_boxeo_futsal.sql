-- ARC · Richard: boxeo y fútbol sala como días de entreno (cuentan para el personaje)
insert into public.content_exercises (id, grp, name, muscle, equip, simple, tip, unit, sort) values
  ('ARC-106', 'Cardio', 'Boxeo', 'Cuerpo entero, cardio', 'Sin material', 'Tu sesión de boxeo. Pon los minutos que has entrenado y marca el check.', 'Bebe antes, durante y después.', 'min', 830),
  ('ARC-107', 'Cardio', 'Fútbol sala', 'Piernas, cardio', 'Sin material', 'Tu partido o entreno de futsal. Pon los minutos que has jugado y marca el check.', 'La merienda de antes es tu combustible.', 'min', 831)
on conflict (id) do nothing;

update public.coach_clients
set routine = coalesce(routine, '[]'::jsonb) || $arc$[
  {"name": "Boxeo", "ex": [{"id": "ARC-106", "sets": 1, "reps": "60", "rir": 0, "rest": 0}]},
  {"name": "Fútbol sala", "ex": [{"id": "ARC-107", "sets": 1, "reps": "60", "rir": 0, "rest": 0}]}
]$arc$::jsonb
where (email ilike '%richard%' or name ilike 'richard%')
  and not (coalesce(routine, '[]'::jsonb) @> '[{"name": "Boxeo"}]'::jsonb);

-- comprobación: debe salir Richard con 6 días
select name, email, jsonb_array_length(routine) as dias from public.coach_clients where email ilike '%richard%' or name ilike 'richard%';
