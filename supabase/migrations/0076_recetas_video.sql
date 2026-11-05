-- ARC · Recetas de Luna con vídeo (bowl de hamburguesa y porridge post-gym)
-- El vídeo va en public/recetas/<id>.mp4 y sale en vez de la foto
insert into public.content_recipes (id, slot, mode, name, items, how, steps, plate, tupper, active, sort) values
  ('rl25', 'comida', 'sencilla', 'Bowl de hamburguesa', $arc$[["arroz", "c"], ["picadaVacuno", "p"], ["espinacas", 40], ["pepinillos", 25], ["verduras", 60], ["mozzarella", 20]]$arc$::jsonb,
   'Arroz, carne picada 99% vacuno a la sartén, espinacas baby, pepinillos, tomates cherry y mozzarella rallada, con especias por encima. Todo el sabor de una burger en un plato.',
   $arc$["Cuece el arroz (o usa uno de vasito para ir más rápido).", "Haz la carne picada en la sartén bien caliente, sin aceite, con sal y pimienta hasta que se dore.", "Monta el plato por zonas: arroz, carne, espinacas, una fila de pepinillos en rodajas y los tomates cherry partidos por la mitad.", "Mozzarella rallada por encima y termina con tu mezcla de especias favorita."]$arc$::jsonb,
   'Colócalo todo por filas, con los pepinillos y los cherrys en el centro: queda como una hamburguesa abierta.', true, true, 124),
  ('rl26', 'desayuno', 'sencilla', 'Porridge proteico post-gym', $arc$[["avena", "c"], ["proteina", "p"], ["platano", 60], ["arandanos", 50], ["yogurProt", 50]]$arc$::jsonb,
   'Avena con agua caliente y proteína en polvo, con plátano, arándanos y una cucharada de yogur. Lo que Luna se hace siempre después del gym.',
   $arc$["Pon la avena en un táper o bol y cúbrela con agua recién hervida. Deja 1-2 minutos.", "Añade la proteína en polvo y remueve hasta que quede cremoso (si se espesa mucho, un chorrito más de agua).", "Encima: arándanos (valen congelados), el plátano en rodajas y una cucharada de yogur. Si quieres, unas semillas de lino."]$arc$::jsonb,
   'En táper de cristal cuadrado, cada topping en su esquina: arándanos, plátano en fila y el yogur arriba.', true, true, 125)
on conflict (id) do update set slot = excluded.slot, mode = excluded.mode, name = excluded.name, items = excluded.items, how = excluded.how, steps = excluded.steps, plate = excluded.plate, tupper = excluded.tupper, active = excluded.active;
