-- ARC · frases de motivación nuevas (elegidas por Luna)
insert into public.content_quotes (id, text, who, source, why, kind, active) values
  ('q-mot-01', 'Cree en ti. No en el yo que cree en ti, ni en el tú que cree en mí. Cree en el tú que cree en ti.', 'Kamina', 'Gurren Lagann', 'Para los días en que no te ves capaz. Simon tampoco se lo creía.', 'cita', true),
  ('q-mot-02', '¡Manda la lógica a paseo y haz lo imposible!', 'Kamina', 'Gurren Lagann', 'Para esa serie que te da miedo intentar.', 'cita', true),
  ('q-mot-03', 'El talento es algo que haces florecer. El instinto es algo que pules.', 'Toru Oikawa', 'Haikyuu!!', 'Oikawa no era un genio y llegó arriba puliendo lo suyo cada día.', 'cita', true),
  ('q-mot-04', 'Una lección sin dolor no tiene sentido. Nadie gana nada sin sacrificar algo a cambio.', 'Edward Elric', 'Fullmetal Alchemist: Brotherhood', 'Las agujetas, el madrugón, el táper. Eso es lo que pagas a cambio.', 'cita', true),
  ('q-mot-05', 'La fuerza no viene de ganar. Viene de tus luchas: cuando pasas por algo duro y decides no rendirte, eso es fuerza.', 'Arnold Schwarzenegger', 'Culturismo', 'Los días malos también te están haciendo fuerte.', 'cita', true),
  ('q-mot-06', 'Los campeones no se hacen en los gimnasios. Se hacen de algo que llevan dentro: un deseo, un sueño, una visión.', 'Muhammad Ali', 'Boxeo', 'El gym es donde se nota. Lo de dentro lo traes tú.', 'cita', true),
  ('q-mot-07', 'Cuando tu mente te dice que has terminado, solo vas por el 40%.', 'David Goggins', 'Ultrafondo', 'Cuando creas que no puedes más, prueba una repetición más.', 'cita', true),
  ('q-mot-08', 'Pelea un asalto más. Cuando tus brazos estén tan cansados que apenas puedas levantar la guardia, pelea un asalto más.', 'James J. Corbett', 'Boxeo', 'La serie que haces cansada es la que te cambia.', 'cita', true)
on conflict (id) do nothing;
