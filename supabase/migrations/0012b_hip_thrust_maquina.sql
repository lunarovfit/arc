-- ARC · ejercicio nuevo: hip thrust en máquina (vídeo de Luna)
insert into public.content_exercises (id, grp, name, muscle, equip, simple, tip, note, lift, unit, sort) values
  ('ARC-071', 'Glúteo y cadera', 'Hip thrust en máquina', 'Glúteo mayor', 'Máquina', 'Sentada con la espalda apoyada en el respaldo y el rodillo sobre la cadera, subes la cadera empujando con los talones hasta quedar en línea con el tronco.', 'Mete la barbilla y mira al frente: así la espalda no se arquea y el trabajo se lo lleva el glúteo. Aguanta 1 segundo arriba apretando.', '', '', '', 71)
on conflict (id) do nothing;
