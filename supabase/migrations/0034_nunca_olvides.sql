-- ARC · la frase más importante
insert into public.content_quotes (text, who, source, why, kind)
select 'Nunca olvides por qué empezaste.', 'Luna', 'ARC',
       'El día que no te apetezca, acuérdate de cómo te sentías cuando decidiste cambiar. Ese motivo sigue ahí.', 'leccion'
where not exists (select 1 from public.content_quotes where text = 'Nunca olvides por qué empezaste.');
