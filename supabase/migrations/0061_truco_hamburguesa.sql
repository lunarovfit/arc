-- ARC · truco de la hamburguesa de pollo casera
update public.content_recipes
set steps = '["Truco: pica tú la pechuga con una picadora manual de cuerda (o la picadora de cocina), salpimienta y dale forma con las manos. Así sabes que solo lleva pollo, sin rellenos ni aditivos de las de bandeja."]'::jsonb || steps
where name = 'Hamburguesa de pollo completa' and not (steps::text like '%picadora manual%');
