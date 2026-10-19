-- =====================================================================
-- ARC by Lunarovx · revisiones de asesoradas y modo de niveles elegido por la coach
-- Pégalo en Supabase > SQL Editor y dale a Run (después del de asesoradas).
-- =====================================================================

-- Modo que la coach impone: '' (lo elige ella), 'otaku', 'gymrat' o 'clasico' (sin personajes)
alter table public.coach_clients add column if not exists mode text not null default '';

-- Revisiones: fotos de progreso, peso, medidas y cómo ha ido
create table if not exists public.client_checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  weight numeric, waist numeric, hip numeric,
  feeling text,
  photos text[] not null default '{}'
);
alter table public.client_checkins enable row level security;
drop policy if exists "revisiones propias" on public.client_checkins;
create policy "revisiones propias" on public.client_checkins for all to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());
drop policy if exists "coach ve revisiones" on public.client_checkins;
create policy "coach ve revisiones" on public.client_checkins for select to authenticated using (public.is_coach());

-- Carpeta privada para las fotos (no es pública: solo la asesorada y la coach)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checkins', 'checkins', false, 15728640, array['image/*'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "checkins: sube la suya" on storage.objects;
create policy "checkins: sube la suya" on storage.objects for insert to authenticated
  with check (bucket_id = 'checkins' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "checkins: ve la suya o coach" on storage.objects;
create policy "checkins: ve la suya o coach" on storage.objects for select to authenticated
  using (bucket_id = 'checkins' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));
drop policy if exists "checkins: borra la suya" on storage.objects;
create policy "checkins: borra la suya" on storage.objects for delete to authenticated
  using (bucket_id = 'checkins' and (storage.foldername(name))[1] = auth.uid()::text);
