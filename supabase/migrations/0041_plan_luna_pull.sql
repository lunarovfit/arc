-- ARC · plan de Luna, día "Jalón y abdomen": dominadas opcionales, remo en máquina sentado (en vez de polea) y reverse fly en máquina
update public.coach_clients
set routine = (
  select jsonb_agg(case when d->>'name' = 'Jalón y abdomen' then jsonb_set(d, '{ex}', $arc$[
    {"id": "ARC-007", "sets": 3, "reps": "máx. (opcional)", "rir": 1, "rest": 120},
    {"id": "ARC-009", "sets": 3, "reps": "1×6–8 / 2×8–12", "rir": 1, "rest": 150},
    {"id": "ARC-014", "sets": 3, "reps": "8–12", "rir": 1, "rest": 120},
    {"id": "ARC-015", "sets": 3, "reps": "10–12 por brazo", "rir": 1, "rest": 105},
    {"id": "ARC-020", "sets": 3, "reps": "12–15", "rir": 1, "rest": 90},
    {"id": "ARC-019", "sets": 3, "reps": "12–15", "rir": 1, "rest": 60},
    {"id": "ARC-029", "sets": 3, "reps": "10–12", "rir": 1, "rest": 90},
    {"id": "ARC-081", "sets": 3, "reps": "10–15", "rir": 1, "rest": 90}
  ]$arc$::jsonb) else d end order by i)
  from jsonb_array_elements(routine) with ordinality as t(d, i)
), updated_at = now()
where name = 'Luna (yo)';

-- Comprobación: el día de jalón debería tener 8 ejercicios
select d->>'name' as dia, jsonb_array_length(d->'ex') as ejercicios
from public.coach_clients, jsonb_array_elements(routine) d
where name = 'Luna (yo)';
