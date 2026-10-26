-- ARC · frases nuevas de Luna (sin autor, firmadas como ARC) y la de Rock Lee
insert into public.content_quotes (text, who, source, why, kind)
select 'Pequeñas acciones con disciplina, repetidas cada día, crean resultados extraordinarios.', '', 'ARC', 'Una serie, un vaso de agua, un paseo. Por separado no parecen nada; sumados, te cambian.', 'leccion'
where not exists (select 1 from public.content_quotes where text = 'Pequeñas acciones con disciplina, repetidas cada día, crean resultados extraordinarios.');
insert into public.content_quotes (text, who, source, why, kind)
select 'Tu rutina escribe tus resultados.', '', 'ARC', 'No cuenta lo que haces un día, cuenta lo que haces casi todos.', 'leccion'
where not exists (select 1 from public.content_quotes where text = 'Tu rutina escribe tus resultados.');
insert into public.content_quotes (text, who, source, why, kind)
select 'Sigue apareciendo. A las oportunidades les encanta la repetición.', '', 'ARC', 'El progreso llega a quien vuelve, no a quien empieza más fuerte.', 'leccion'
where not exists (select 1 from public.content_quotes where text = 'Sigue apareciendo. A las oportunidades les encanta la repetición.');
insert into public.content_quotes (text, who, source, why, kind)
select 'Crecer exige aceptar que durante un tiempo vas a hacer el ridículo.', '', 'ARC', 'Todo el mundo empezó sin saber usar las máquinas. Nadie te mira tanto como crees.', 'leccion'
where not exists (select 1 from public.content_quotes where text = 'Crecer exige aceptar que durante un tiempo vas a hacer el ridículo.');
insert into public.content_quotes (text, who, source, why, kind)
select 'Tu mentalidad es un arma o una debilidad. Entrénala para que luche a tu favor, no en tu contra.', '', 'ARC', 'Cada vez que vas sin ganas, entrenas también la cabeza.', 'leccion'
where not exists (select 1 from public.content_quotes where text = 'Tu mentalidad es un arma o una debilidad. Entrénala para que luche a tu favor, no en tu contra.');
insert into public.content_quotes (text, who, source, why, kind)
select 'No lo llames meta si lo tratas como un deseo. Una meta tiene horario, coste y consecuencias. Si no tiene nada de eso, es solo una fantasía.', '', 'ARC', 'Ponle día y hora a tu entreno y deja de ser un deseo.', 'leccion'
where not exists (select 1 from public.content_quotes where text = 'No lo llames meta si lo tratas como un deseo. Una meta tiene horario, coste y consecuencias. Si no tiene nada de eso, es solo una fantasía.');
insert into public.content_quotes (text, who, source, why, kind)
select 'La disciplina pesa… pero el arrepentimiento siempre pesará más.', 'Rock Lee', 'Naruto', 'Lee entrenaba hasta caer. Le dolía menos eso que quedarse con las ganas.', 'leccion'
where not exists (select 1 from public.content_quotes where text = 'La disciplina pesa… pero el arrepentimiento siempre pesará más.');
