-- ARC · chin up (dominada supina)
insert into public.content_exercises (id, grp, name, muscle, equip, simple, tip, note, lift, unit, sort) values
  ('ARC-088', 'Espalda', 'Chin up (dominada supina)', 'Dorsal ancho, bíceps', 'Barra', 'Colgada de la barra con las palmas mirando hacia ti y las manos a la anchura de los hombros, subes hasta pasar la barbilla por encima y bajas controlando.', 'Suele salir antes que la dominada normal porque ayuda más el bíceps. Baja hasta estirar los brazos del todo en cada repetición.', '', 'pull', '', 88)
on conflict (id) do update set name = excluded.name, grp = excluded.grp, muscle = excluded.muscle, equip = excluded.equip, simple = excluded.simple, tip = excluded.tip;
