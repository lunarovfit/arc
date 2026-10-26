-- ARC · fuera las frases que no eran frases, entran frases de verdad
update public.content_quotes set active = false where text in ('Nada ha pasado.', 'Cien flexiones, cien abdominales, cien sentadillas y diez kilómetros corriendo. Todos los días.', 'No tengo enemigos.', '¿¡Quién demonios te crees que soy!?', 'Luffy… ayúdame.', '¡Quiero vivir!');
insert into public.content_quotes (text, who, source, why, kind)
select 'Las cicatrices en la espalda son la vergüenza de un espadachín.', 'Roronoa Zoro', 'One Piece', 'Zoro nunca le da la espalda a un rival, ni aunque vaya a perder. Tú tampoco a la serie que te da miedo.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'Las cicatrices en la espalda son la vergüenza de un espadachín.');
insert into public.content_quotes (text, who, source, why, kind)
select 'El trabajo duro no sirve de nada si no crees en ti mismo.', 'Naruto Uzumaki', 'Naruto', 'Puedes entrenar perfecto, pero si vas pensando que no puedes, el peso pesa el doble.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'El trabajo duro no sirve de nada si no crees en ti mismo.');
insert into public.content_quotes (text, who, source, why, kind)
select 'Ser ninja es saber aguantar.', 'Jiraiya', 'Naruto', 'Los resultados llegan a quien aguanta las semanas en las que no se nota nada.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'Ser ninja es saber aguantar.');
insert into public.content_quotes (text, who, source, why, kind)
select 'Por muy débil o inútil que te sientas, enciende tu corazón, aprieta los dientes y sigue adelante.', 'Kyojuro Rengoku', 'Demon Slayer', 'Para los días en que todo pesa más de la cuenta. Hoy también cuenta.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'Por muy débil o inútil que te sientas, enciende tu corazón, aprieta los dientes y sigue adelante.');
insert into public.content_quotes (text, who, source, why, kind)
select 'No rendirme, esa es mi magia.', 'Asta', 'Black Clover', 'Asta nació sin una gota de magia y aun así se plantó frente a todos. Tu talento es no dejarlo.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'No rendirme, esa es mi magia.');
insert into public.content_quotes (text, who, source, why, kind)
select 'Este mundo es cruel, pero también es muy bonito.', 'Mikasa Ackerman', 'Attack on Titan', 'Hay entrenos que duelen y días que salen solos. Los dos forman parte del camino.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'Este mundo es cruel, pero también es muy bonito.');
