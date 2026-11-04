-- ARC · Mug cake: sugerencia de plátano por encima (la foto nueva va con la app)
update public.content_recipes
set steps = steps || '["Si te apetece, unas rodajas de plátano por encima: queda genial con el de vainilla."]'::jsonb
where name = 'Mug cake de chocolate o vainilla' and not (steps::text like '%rodajas de plátano%');
