-- ARC · frases: fuera las que no pegan, entran frases de anime cortas y con fuerza
update public.content_quotes set active = false where who in ('Chris Gardner', 'Yoda', 'Thomas Wayne', 'Morfeo', 'James J. Corbett', 'Michael Jordan', 'Eliud Kipchoge', 'Bruce Lee', 'Serena Williams', 'Simone Biles', 'Carolina Marín', 'Haruki Murakami', 'Will Durant, sobre Aristóteles', 'Marco Aurelio', 'Séneca', 'Jim Rohn', 'James Clear', 'Eleanor Roosevelt', 'Arnold Schwarzenegger');
update public.content_quotes set active = false where text in ('Cuando tu mente te dice que has terminado, solo vas por el 40%.', 'Los campeones no se hacen en los gimnasios. Se hacen de algo que llevan dentro: un deseo, un sueño, una visión.');
insert into public.content_quotes (text, who, source, why, kind)
select 'Si ganas, vives. Si pierdes, mueres. Si no luchas, no puedes ganar.', 'Eren Jaeger', 'Attack on Titan', 'No hace falta ganar hoy. Hace falta presentarse a la pelea.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'Si ganas, vives. Si pierdes, mueres. Si no luchas, no puedes ganar.');
insert into public.content_quotes (text, who, source, why, kind)
select 'Nada ha pasado.', 'Roronoa Zoro', 'One Piece', 'Lo dice lleno de heridas después de cargar él solo con todo el dolor de Luffy. Hay días que se aguantan en silencio y se sigue.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'Nada ha pasado.');
insert into public.content_quotes (text, who, source, why, kind)
select 'Cien flexiones, cien abdominales, cien sentadillas y diez kilómetros corriendo. Todos los días.', 'Saitama', 'One Punch Man', 'Su secreto era aburrido: hacerlo cada día. El tuyo también.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'Cien flexiones, cien abdominales, cien sentadillas y diez kilómetros corriendo. Todos los días.');
insert into public.content_quotes (text, who, source, why, kind)
select 'Quiero saber qué significa ser fuerte.', 'Ippo Makunouchi', 'Hajime no Ippo', 'Ippo no sabía ni dar un puñetazo. Le movía la pregunta, no el talento.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'Quiero saber qué significa ser fuerte.');
insert into public.content_quotes (text, who, source, why, kind)
select 'No tengo enemigos.', 'Thorfinn', 'Vinland Saga', 'En el gym no compites contra nadie. Solo contra quien eras ayer.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'No tengo enemigos.');
insert into public.content_quotes (text, who, source, why, kind)
select '¿¡Quién demonios te crees que soy!?', 'Kamina', 'Gurren Lagann', 'Para cuando dudes de si puedes con ese peso.', 'cita'
where not exists (select 1 from public.content_quotes where text = '¿¡Quién demonios te crees que soy!?');
insert into public.content_quotes (text, who, source, why, kind)
select 'Luffy… ayúdame.', 'Nami', 'One Piece', 'Después de años cargando sola con todo, pidió ayuda. Eso también es ser fuerte.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'Luffy… ayúdame.');
insert into public.content_quotes (text, who, source, why, kind)
select '¡Quiero vivir!', 'Nico Robin', 'One Piece', 'Se pasó la vida huyendo hasta que se atrevió a decir lo que quería. Dilo tú también.', 'cita'
where not exists (select 1 from public.content_quotes where text = '¡Quiero vivir!');
insert into public.content_quotes (text, who, source, why, kind)
select 'Un fracasado puede vencer a un genio a base de trabajo duro.', 'Rock Lee', 'Naruto', 'Lee no podía usar ni ninjutsu ni genjutsu. Se hizo fuerte con lo único que le quedaba: entrenar.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'Un fracasado puede vencer a un genio a base de trabajo duro.');
