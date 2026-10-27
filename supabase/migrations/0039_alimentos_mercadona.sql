-- ARC · cremas y verduras congeladas del Mercadona (valores por 100 g de la etiqueta)
insert into public.content_foods (id, name, p, c, f) values
  ('cremaLentejas', 'Crema de lentejas (Hacendado)', 4.6, 6.1, 2.2),
  ('cremaCalabaza', 'Crema de calabaza y zanahoria (Hacendado)', 0.9, 4.2, 2.8),
  ('parrilladaVerduras', 'Parrillada de verduras congelada (Hacendado)', 2.2, 10, 0),
  ('pimientoCongelado', 'Pimiento troceado congelado (Hacendado)', 0.9, 4.5, 0.4)
on conflict (id) do nothing;
