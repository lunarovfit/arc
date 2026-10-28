-- ARC · panes y productos del Mercadona (valores por 100 g de la etiqueta) y tostadas de centeno de Luna
insert into public.content_foods (id, name, p, c, f, tags) values
  ('panCenteno', 'Pan de centeno 82% con masa madre (Hacendado)', 5.5, 41, 1.3, '{gluten}'),
  ('panIntegralHorno', 'Pan 100% integral (El Horno de Mercadona)', 9.1, 38, 2.5, '{gluten}'),
  ('panMasaMadre', 'Pan de masa madre integral o de centeno (panadería)', 9, 44, 1.5, '{gluten}'),
  ('tortitasLegumbres', 'Tortitas de legumbres (Hacendado)', 25, 55, 3.1, '{}'),
  ('tomateUntar', 'Tomate para untar con AOVE (Hacendado)', 0.9, 3.7, 4.8, '{}'),
  ('guisantes', 'Guisantes congelados (Hacendado)', 6, 11, 0.4, '{}'),
  ('aguaCoco', 'Agua de coco (Hacendado)', 0, 5, 0, '{}'),
  ('uvas', 'Uvas', 0.7, 17, 0.2, '{}')
on conflict (id) do nothing;
update public.content_foods set tags = '{gluten}' where id = 'panSemillas';

insert into public.content_recipes (id, slot, mode, name, items, how, steps, plate, tupper, active, sort) values
  ('rl18', 'desayuno', 'sencilla', 'Tostadas de centeno con tomate y jamón',
   '[["panCenteno", "c"], ["tomateUntar", 30], ["jamon", 40], ["yogurProt", "p"], ["uvas", 80]]'::jsonb,
   'Tuesta el pan de centeno, unta el tomate (el de bote ya lleva su aceite) y pon el jamón encima. Quítale la grasa blanca si quieres. De postre, un puñado de uvas, y un yogur proteico al lado para llegar a tu proteína.',
   '[]'::jsonb, '', false, true, 117)
on conflict (id) do nothing;
