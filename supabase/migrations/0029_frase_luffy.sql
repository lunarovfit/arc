-- ARC · frase nueva de Luffy
insert into public.content_quotes (text, who, source, why, kind)
select 'Si muero intentándolo, al menos lo intenté.', 'Monkey D. Luffy', 'One Piece',
       'Luffy se mete en peleas que todos dan por perdidas. Lo que cuenta es plantarte, no tenerlo ganado de antemano. Hoy no hace falta el entreno perfecto, hace falta intentarlo.', 'leccion'
where not exists (select 1 from public.content_quotes where text = 'Si muero intentándolo, al menos lo intenté.');
