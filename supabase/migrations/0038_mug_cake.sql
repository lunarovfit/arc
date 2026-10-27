-- ARC · el mug cake sabe a la proteína que uses (chocolate o vainilla)
update public.content_recipes
set name = 'Mug cake de chocolate o vainilla',
    steps = '["Mezcla en una taza la avena molida, la proteína y una pizca de levadura. Sabrá a lo que sepa tu proteína: de chocolate o de vainilla.", "Si es de chocolate y lo quieres más intenso, añade el cacao. Si es de vainilla, no lo pongas.", "Añade las claras y un chorrito de agua hasta tener una masa espesa.", "Micro 60–90 segundos y pon la crema de cacahuete encima para que se funda."]'::jsonb
where name = 'Mug cake de chocolate';
