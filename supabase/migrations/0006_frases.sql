-- =====================================================================
-- ARC by Lunarovx · limpieza de frases
-- Quita las frases raras o sin gancho y añade frases de gym que motivan.
-- Pégalo en Supabase > SQL Editor y dale a Run.
-- =====================================================================

delete from public.content_quotes where text in (
  'Nada… No ha pasado nada.',
  'Soy infantil y odio perder.',
  'Vas a comer rayos y vas a cagar truenos.',
  'Cualquiera puede cocinar.',
  'Pies, ¿para qué os quiero si tengo alas para volar?',
  'Un verdadero guerrero no necesita espada.',
  'Huir de lo que te hace daño no tiene nada de malo.',
  'Si vas a golpear algo, golpéalo hasta romperlo.',
  'El esfuerzo no vale nada si no crees en ti misma.',
  'Levántate.',
  'Eres fuerte, así que ayuda a los demás.',
  'Nada en la vida debe ser temido, solo comprendido.',
  'Ningún ser humano es libre si no es dueño de sí mismo.'
);

insert into public.content_quotes (id, text, who, source, why, kind, active) values
  ('q-gym-01', '¡Peso ligero, baby!', 'Ronnie Coleman', 'Culturismo', 'Lo gritaba moviendo más de 300 kilos. Dilo antes de tu serie más pesada.', 'cita', true),
  ('q-gym-02', 'Todo el mundo quiere ser culturista, pero nadie quiere levantar los pesos pesados.', 'Ronnie Coleman', 'Culturismo', 'Querer el resultado es fácil. Hoy toca la parte que nadie ve.', 'cita', true),
  ('q-gym-03', 'Las últimas tres o cuatro repeticiones son las que hacen crecer el músculo.', 'Arnold Schwarzenegger', 'Culturismo', 'Las que arden son las que cuentan. No las regales.', 'cita', true),
  ('q-gym-04', 'No cuento mis abdominales. Solo empiezo a contar cuando empieza a doler.', 'Muhammad Ali', 'Boxeo', 'Las repeticiones fáciles son el calentamiento.', 'cita', true),
  ('q-gym-05', 'No hay límites. Solo hay mesetas, y no debes quedarte en ellas: tienes que ir más allá.', 'Bruce Lee', 'Artes marciales', 'Si llevas semanas sin subir peso, estás en una meseta. Tu techo está más arriba.', 'cita', true),
  ('q-gym-06', 'Cien flexiones, cien abdominales, cien sentadillas y diez kilómetros corriendo. Todos los días.', 'Saitama', 'One Punch Man', 'El héroe más fuerte del anime tenía una rutina y la cumplía. Cumple hoy la tuya.', 'cita', true),
  ('q-gym-07', 'Mantente duro.', 'David Goggins', 'Ultrafondo', 'Para cuando quieras cortar la serie antes de tiempo.', 'cita', true),
  ('q-gym-08', 'Si te topas con un muro, no te des la vuelta. Descubre cómo escalarlo, atravesarlo o rodearlo.', 'Michael Jordan', 'Baloncesto', 'Una máquina ocupada o una molestia no son el final del entreno.', 'cita', true),
  ('q-gym-09', 'Prefiero arrepentirme de los riesgos que no salieron bien que de las oportunidades que no aproveché.', 'Simone Biles', 'Gimnasia', 'Ese peso nuevo da respeto. Pruébalo con buena técnica.', 'cita', true)
on conflict (id) do nothing;
