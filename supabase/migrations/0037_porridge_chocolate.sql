-- ARC · porridge con proteína de chocolate en vez de cacao puro
update public.content_recipes
set items = (select jsonb_agg(e) from jsonb_array_elements(items) e where e->>0 <> 'cacao'),
    how = 'Avena con la leche 2 minutos al micro, mezcla la proteína de chocolate (te da el sabor sin tener que añadir cacao) y pon la crema de cacahuete encima.'
where name = 'Porridge proteico de cacao';
