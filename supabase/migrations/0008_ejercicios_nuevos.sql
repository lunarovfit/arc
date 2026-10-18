-- ARC · ejercicios nuevos (de los vídeos de Luna)
insert into public.content_exercises (id, grp, name, muscle, equip, simple, tip, note, lift, unit, sort) values
  ('ARC-069', 'Espalda', 'Remo en polea baja con barra', 'Dorsal, romboides', 'Polea', 'Sentada en la polea baja con los pies apoyados, tiras de la barra hacia el abdomen con las palmas mirando hacia abajo y la espalda recta.', 'Primero junta las escápulas y después dobla los codos. Llega con la barra al ombligo, no al pecho, y vuelve estirando los brazos sin encorvarte.', '', '', '', 69),
  ('ARC-070', 'Espalda', 'Jalón unilateral en polea', 'Dorsal ancho', 'Polea', 'Sentada de lado a la polea alta, tiras del agarre con un brazo llevando el codo hacia la cadera, y luego cambias de lado.', 'Piensa en meter el codo en el bolsillo del pantalón. Si giras el tronco para ayudarte, baja el peso.', '', '', '', 70)
on conflict (id) do nothing;
