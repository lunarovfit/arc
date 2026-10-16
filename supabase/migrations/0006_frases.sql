-- =====================================================================
-- ARC by Lunarovx · limpieza de frases
-- Quita las frases raras o sin gancho .
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

-- Por si se llegaron a meter las frases de gym, fuera también
delete from public.content_quotes where id like 'q-gym-%';
