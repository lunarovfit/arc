-- ARC · ejercicios nuevos con vídeo (noviembre)
insert into public.content_exercises (id, grp, name, muscle, equip, simple, tip, unit, sort) values
  ('ARC-114', 'Tríceps', 'Extensión de tríceps unilateral en polea', 'Tríceps', 'Polea', 'De pie de lado a la polea alta con un agarre en una mano, estiras el codo hacia abajo y vuelves despacio.', 'El codo pegado al costado y quieto: solo se mueve el antebrazo. Aprieta 1 segundo abajo y empieza por el brazo más débil.', '', 846),
  ('ARC-115', 'Bíceps', 'Curl martillo con cuerda en polea', 'Bíceps, braquial, antebrazo', 'Polea', 'De pie frente a la polea baja con la cuerda y las palmas mirándose, subes doblando los codos y bajas despacio.', 'Codos pegados al cuerpo y sin balancearte. Abre un poco la cuerda arriba y baja en 2-3 segundos.', '', 847)
on conflict (id) do nothing;

insert into public.content_exercises (id, grp, name, muscle, equip, simple, tip, unit, sort) values
  ('ARC-109', 'Tríceps', 'Extensión de tríceps sobre la cabeza en polea', 'Tríceps (porción larga)', 'Polea', 'De espaldas a la polea, con los codos apuntando al frente junto a la cabeza, estiras los brazos hacia delante y arriba.', 'Estira del todo y baja lento notando el estiramiento del tríceps.', '', 841)
on conflict (id) do nothing;
