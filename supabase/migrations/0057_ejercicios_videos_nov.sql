-- ARC · ejercicios nuevos con vídeo (noviembre)
insert into public.content_exercises (id, grp, name, muscle, equip, simple, tip, unit, sort) values
  ('ARC-114', 'Bíceps', 'Curl de muñeca en polea alta', 'Antebrazo (flexores de la muñeca)', 'Polea', 'De lado a la polea alta con el agarre en una mano y el codo fijo a la altura de la cara, doblas solo la muñeca hacia ti y vuelves despacio.', 'Solo se mueve la muñeca: brazo y codo quietos. Peso ligero y recorrido completo, notando el antebrazo.', '', 846),
  ('ARC-115', 'Bíceps', 'Curl inverso en polea', 'Antebrazo, braquiorradial, bíceps', 'Polea', 'De pie frente a la polea baja con el agarre cogido por encima (palmas hacia abajo), subes doblando los codos y bajas despacio.', 'Muñecas rectas y codos pegados al cuerpo. Usa menos peso que en un curl normal: aquí manda el antebrazo.', '', 847)
on conflict (id) do update set grp = excluded.grp, name = excluded.name, muscle = excluded.muscle, equip = excluded.equip, simple = excluded.simple, tip = excluded.tip;

insert into public.content_exercises (id, grp, name, muscle, equip, simple, tip, unit, sort) values
  ('ARC-109', 'Tríceps', 'Extensión de tríceps sobre la cabeza en polea', 'Tríceps (porción larga)', 'Polea', 'De espaldas a la polea, con los codos apuntando al frente junto a la cabeza, estiras los brazos hacia delante y arriba.', 'Estira del todo y baja lento notando el estiramiento del tríceps.', '', 841)
on conflict (id) do nothing;

insert into public.content_exercises (id, grp, name, muscle, equip, simple, tip, unit, sort) values
  ('ARC-112', 'Bíceps', 'Curl martillo con mancuernas', 'Bíceps, braquial, antebrazo', 'Mancuernas', 'De pie con una mancuerna en cada mano y las palmas mirándose, subes una mancuerna doblando el codo, bajas despacio y alternas.', 'Codos pegados al cuerpo y sin balancearte; baja en 2-3 segundos.', '', 844)
on conflict (id) do nothing;

insert into public.content_exercises (id, grp, name, muscle, equip, simple, tip, unit, sort) values
  ('ARC-116', 'Pecho', 'Press inclinado en Smith', 'Pecho superior, hombro anterior, tríceps', 'Multipower / Smith', 'Tumbado en un banco inclinado dentro del Smith, bajas la barra guiada hasta la parte alta del pecho y empujas hacia arriba.', 'Banco a 30-45 grados, escápulas juntas y pies firmes. Baja controlado hasta rozar el pecho, sin rebotar.', '', 848),
  ('ARC-117', 'Pecho', 'Press banca en Smith', 'Pecho, hombro anterior, tríceps', 'Multipower / Smith', 'Tumbado en un banco plano dentro del Smith, bajas la barra guiada hasta la mitad del pecho y empujas hacia arriba.', 'Coloca el banco para que la barra caiga a la altura de los pezones. Codos a unos 45 grados del cuerpo, no abiertos del todo.', '', 849)
on conflict (id) do nothing;
