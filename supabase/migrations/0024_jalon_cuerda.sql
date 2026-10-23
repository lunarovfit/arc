-- ARC · jalón con cuerda sentada en el suelo
insert into public.content_exercises (id, grp, name, muscle, equip, simple, tip, note, lift, unit, sort) values
  ('ARC-086', 'Espalda', 'Jalón con cuerda sentada en el suelo', 'Dorsal ancho, redondo mayor', 'Polea', 'Sentada en el suelo frente a la polea alta y con la cuerda en las manos, tiras hacia abajo llevando los codos hacia las costillas y vuelves estirando los brazos.', 'Pecho alto y sin balancearte hacia atrás. Piensa en bajar los codos, no en tirar con las manos.', '', '', '', 86)
on conflict (id) do update set name = excluded.name, grp = excluded.grp, muscle = excluded.muscle, equip = excluded.equip, simple = excluded.simple, tip = excluded.tip;
