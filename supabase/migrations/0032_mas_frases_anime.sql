-- ARC · frases: fuera las exclamaciones sueltas, entran más frases de anime
update public.content_quotes set active = false where text in ('Ser ninja es saber aguantar.', 'Ve más allá. ¡Plus Ultra!', '¡Entregad vuestros corazones!', 'Tranquilo, soy el más fuerte.', '¡Voy a ser el Rey de los Piratas!', '¡Arde, corazón!', '¡Manda la lógica a paseo y haz lo imposible!');
insert into public.content_quotes (text, who, source, why, kind)
select 'Quien no es capaz de sacrificar nada, nunca podrá cambiar nada.', 'Armin Arlert', 'Attack on Titan', 'Cambiar tu cuerpo cuesta algo: horas, sueño, excusas. Elige qué das a cambio.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'Quien no es capaz de sacrificar nada, nunca podrá cambiar nada.');
insert into public.content_quotes (text, who, source, why, kind)
select 'El miedo no es malo. Te dice cuál es tu debilidad, y cuando la conoces, puedes volverte más fuerte.', 'Gildarts Clive', 'Fairy Tail', 'Ese ejercicio que evitas es justo el que más te va a hacer crecer.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'El miedo no es malo. Te dice cuál es tu debilidad, y cuando la conoces, puedes volverte más fuerte.');
insert into public.content_quotes (text, who, source, why, kind)
select 'Levántate y camina. Sigue adelante. Tienes dos buenas piernas.', 'Edward Elric', 'Fullmetal Alchemist: Brotherhood', 'Ed lo perdió casi todo y aun así se levantó. Tú también puedes con hoy.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'Levántate y camina. Sigue adelante. Tienes dos buenas piernas.');
insert into public.content_quotes (text, who, source, why, kind)
select 'Los sueños de las personas nunca se acaban.', 'Barbanegra', 'One Piece', 'Da igual cuánto tiempo lleves sin entrenar o cuántas veces lo hayas dejado. Siempre puedes volver.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'Los sueños de las personas nunca se acaban.');
insert into public.content_quotes (text, who, source, why, kind)
select 'No le des a nadie el poder de decidir tu destino.', 'Giyu Tomioka', 'Demon Slayer', 'Ni a quien te dice que no es para ti, ni a la voz de tu cabeza que lo repite.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'No le des a nadie el poder de decidir tu destino.');
insert into public.content_quotes (text, who, source, why, kind)
select 'Tu taladro es el que perforará los cielos.', 'Kamina', 'Gurren Lagann', 'Lo que tienes ahora, aunque te parezca poco, es justo con lo que vas a llegar.', 'cita'
where not exists (select 1 from public.content_quotes where text = 'Tu taladro es el que perforará los cielos.');
