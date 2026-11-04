-- ARC · Más frutas y toppings para poder cambiarlos en las recetas por cantidades equivalentes
insert into public.content_foods (id, name, p, c, f, tags) values
  ('manzana', 'Manzana', 0.3, 14, 0.2, '{}'),
  ('pera', 'Pera', 0.4, 15, 0.1, '{}'),
  ('naranja', 'Naranja', 0.9, 12, 0.1, '{}'),
  ('mango', 'Mango', 0.8, 15, 0.4, '{}'),
  ('melocoton', 'Melocotón', 0.9, 10, 0.3, '{}'),
  ('sandia', 'Sandía', 0.6, 8, 0.2, '{}'),
  ('melon', 'Melón', 0.8, 8, 0.2, '{}'),
  ('frambuesas', 'Frambuesas', 1.2, 12, 0.7, '{}'),
  ('chocolate85', 'Chocolate negro 85%', 11, 19, 46, '{}'),
  ('cocoRallado', 'Coco rallado', 6.9, 6.4, 64, '{}')
on conflict (id) do nothing;
