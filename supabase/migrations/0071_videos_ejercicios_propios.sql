-- ARC · Cada usuari@ puede subir el vídeo o la foto de SUS ejercicios propios (carpeta propios/<su id>/)
drop policy if exists "media: sube lo suyo" on storage.objects;
create policy "media: sube lo suyo" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = 'propios' and (storage.foldername(name))[2] = auth.uid()::text);
drop policy if exists "media: cambia lo suyo" on storage.objects;
create policy "media: cambia lo suyo" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = 'propios' and (storage.foldername(name))[2] = auth.uid()::text);
drop policy if exists "media: borra lo suyo" on storage.objects;
create policy "media: borra lo suyo" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = 'propios' and (storage.foldername(name))[2] = auth.uid()::text);
