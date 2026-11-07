-- ARC · Test "¿Qué personaje eres?" de la web
-- 1) Las imágenes de los personajes se pueden ver sin cuenta (ya son públicas en el almacenamiento).
drop policy if exists "media: personajes publicos" on public.media;
create policy "media: personajes publicos" on public.media for select to anon
  using (key like 'lvl:%' or key like 'classic:%');

-- 2) Cuántas personas hacen el test y desde qué cartel/QR vienen (?src=gym, ?src=uni...).
--    Desde la web solo se puede añadir; leerlo solo lo puedes tú desde Supabase.
create table if not exists public.web_events (
  id bigserial primary key,
  event text not null check (event in ('test_visita', 'test_resultado', 'test_descarga', 'test_app_store')),
  src text check (char_length(src) <= 40),
  sex text check (sex in ('female', 'male')),
  level int check (level between 0 and 11),
  created_at timestamptz not null default now()
);
alter table public.web_events enable row level security;
drop policy if exists "web: anotar" on public.web_events;
create policy "web: anotar" on public.web_events for insert to anon, authenticated with check (true);
grant insert on public.web_events to anon, authenticated;
grant usage, select on sequence public.web_events_id_seq to anon, authenticated;

-- Para verlo: select src, event, count(*) from public.web_events group by 1, 2 order by 1, 2;
