-- ARC · limpieza de ejercicios, hip thrust en máquina, rumano con barra y dominadas
-- Fuera los que no quiere Luna (en el historial se ven como su sustituto)
delete from public.content_exercises where id in ('ARC-017','ARC-018','ARC-030','ARC-053','ARC-057','ARC-058','ARC-059','ARC-071');

-- El hip thrust pasa a ser en máquina (y si subiste el vídeo al ARC-071, se mueve aquí)
update public.content_exercises set name = 'Hip thrust en máquina', equip = 'Máquina',
  simple = 'Sentada con la espalda apoyada en el respaldo y el rodillo sobre la cadera, subes la cadera empujando con los talones hasta quedar en línea con el tronco.',
  tip = 'Mete la barbilla y mira al frente: así la espalda no se arquea y el trabajo se lo lleva el glúteo. Aguanta 1 segundo arriba apretando.'
where id = 'ARC-054';
update public.media set key = 'ex:ARC-054' where key = 'ex:ARC-071' and not exists (select 1 from public.media where key = 'ex:ARC-054');
delete from public.media where key = 'ex:ARC-071';

update public.content_exercises set name = 'Dominada asistida en máquina', equip = 'Máquina',
  simple = 'Te apoyas de rodillas en la plataforma de la máquina, que te quita parte de tu peso, y haces la dominada completa.'
where id = 'ARC-008';

insert into public.content_exercises (id, grp, name, muscle, equip, simple, tip, note, lift, unit, sort) values
  ('ARC-072', 'Femoral', 'Peso muerto rumano con barra', 'Isquiotibiales, glúteo', 'Barra', 'De pie con la barra en las manos, bajas llevando la cadera hacia atrás con las rodillas un poco flexionadas, la barra pegada a las piernas, y subes apretando glúteo.', 'Baja hasta notar que tira el femoral, no hasta el suelo. Espalda recta y barra rozando las piernas todo el rato.', '', '', '', 72),
  ('ARC-073', 'Espalda', 'Dominada con banda elástica', 'Dorsal ancho, bíceps', 'Banda elástica', 'Enganchas una banda a la barra y metes la rodilla o el pie dentro: te ayuda en la parte más difícil de la subida.', 'Usa la banda que te deje hacer 6-8 buenas. Cuando te salgan fáciles, cambia a una más fina.', '', '', '', 73),
  ('ARC-074', 'Espalda', 'Dominada negativa', 'Dorsal ancho, bíceps', 'Peso corporal', 'Subes a la barra con un salto o un banco y bajas lo más despacio que puedas, unos 3-5 segundos, hasta estirar los brazos.', 'Es la mejor forma de conseguir tu primera dominada. Controla la bajada entera, sin dejarte caer al final.', '', '', '', 74)
on conflict (id) do update set name = excluded.name, grp = excluded.grp, muscle = excluded.muscle, equip = excluded.equip, simple = excluded.simple, tip = excluded.tip;
