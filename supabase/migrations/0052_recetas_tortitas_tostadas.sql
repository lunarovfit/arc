-- ARC · Tortitas proteicas de avena y zanahoria (receta de Luna) + zanahoria como alimento
insert into public.content_foods (id, name, p, c, f, tags) values
  ('zanahoria', 'Zanahoria', 0.9, 7.6, 0.2, '{}')
on conflict (id) do nothing;

insert into public.content_recipes (id, slot, mode, name, items, how, steps, plate, tupper, active, sort) values
  ('rl19', 'desayuno', 'sencilla', 'Tortitas proteicas de avena y zanahoria', $arc$[["avena", "c"], ["proteina", 20], ["claras", "p"], ["huevo", 60], ["zanahoria", 60], ["quesoBatido", 100], ["mermelada", 20], ["arandanos", 40]]$arc$::jsonb, 'Tritura o mezcla la avena, la proteína, las claras, el huevo y la zanahoria rallada fina con canela y una pizca de levadura. Deja reposar 5 min y haz tortitas pequeñas a fuego medio-bajo. Encima, queso batido con canela, mermelada y arándanos. Sin zanahoria: pon 15-20 g más de avena o harina de avena.', $arc$["Ralla la zanahoria muy fina y apriétala con las manos para quitarle el agua.", "Mezcla la avena (o harina de avena), la proteína, las claras, el huevo, la zanahoria, canela, una pizca de sal y media cucharadita de levadura química. Si no quieres zanahoria, pon 15-20 g más de avena.", "Deja reposar la masa 5 minutos: la avena absorbe líquido y las tortitas no se rompen. Tiene que quedar espesa, como un yogur. Si está muy líquida, una cucharada más de avena.", "Sartén antiadherente a fuego medio-bajo, untada con unas gotas de aceite con una servilleta. Echa un cucharón pequeño por tortita y tapa la sartén.", "Dales la vuelta cuando salgan burbujas y los bordes estén secos (2-3 min). Si se pegan, la sartén estaba fría o la diste la vuelta antes de tiempo.", "Monta con el queso batido con canela, la mermelada y los arándanos por encima."]$arc$::jsonb, null, false, true, 118)
on conflict (id) do update set items = excluded.items, how = excluded.how, steps = excluded.steps, name = excluded.name;

-- ARC · Tostadas de pavo y tomate: con arándanos al lado (como en la foto de Luna)
update public.content_recipes
set items = items || '[["arandanos", 60]]'::jsonb,
    how = 'Tuesta el pan, ralla tomate por encima, un chorrito de aceite y el pavo. El pavo, con un 90% de carne como mínimo. Un puñado de arándanos al lado.'
where name = 'Tostadas de pavo y tomate' and not items @> '[["arandanos", 60]]'::jsonb;
select id, name, items from public.content_recipes where name = 'Tostadas de pavo y tomate';
