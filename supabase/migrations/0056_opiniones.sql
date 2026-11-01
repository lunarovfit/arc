-- ARC · Opiniones de asesorad@s para la sección "Coaching con Luna" (las elige la coach desde las revisiones)
create table if not exists public.testimonials (
  id bigint generated always as identity primary key,
  text text not null check (length(trim(text)) between 3 and 600),
  who text not null default 'En asesoría con Luna',
  kind text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.testimonials enable row level security;
drop policy if exists "opiniones: leer" on public.testimonials;
create policy "opiniones: leer" on public.testimonials for select using (active or public.is_coach());
drop policy if exists "opiniones: coach" on public.testimonials;
create policy "opiniones: coach" on public.testimonials for all to authenticated using (public.is_coach()) with check (public.is_coach());
grant select on public.testimonials to anon, authenticated;
grant insert, update, delete on public.testimonials to authenticated;
