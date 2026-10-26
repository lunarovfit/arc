-- ARC · extensión de tríceps tumbada con mancuernas
insert into public.content_exercises (id, grp, name, muscle, equip, simple, tip, note, lift, unit, sort) values
  ('ARC-087', 'Tríceps', 'Extensión de tríceps tumbada con mancuernas', 'Tríceps', 'Mancuernas + banco', 'Tumbada en un banco con una mancuerna en cada mano y los brazos estirados, doblas solo los codos bajando las mancuernas junto a la cabeza y vuelves a estirar.', 'Los codos apuntan al techo y no se abren: solo se mueve el antebrazo. Baja despacio y controla el peso cerca de la cabeza.', '', '', '', 87)
on conflict (id) do update set name = excluded.name, grp = excluded.grp, muscle = excluded.muscle, equip = excluded.equip, simple = excluded.simple, tip = excluded.tip;
