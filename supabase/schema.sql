-- "다시 함께" Supabase schema. Run in the SQL editor of a new project.
-- Also enable Authentication > Providers > "Anonymous sign-ins".
-- STATUS: written but NOT yet executed against a live Supabase project.

create table public.memorials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pet_name text not null check (char_length(pet_name) between 1 and 20),
  species text not null default '기타' check (char_length(species) <= 12),
  birth_date date,
  passed_date date,
  message text not null default '' check (char_length(message) <= 300),
  photo_path text check (photo_path is null or photo_path like owner_id::text || '/%'),
  visibility text not null default 'public' check (visibility in ('public','private')),
  slot int not null unique check (slot between 0 and 20),
  created_at timestamptz not null default now()
);
alter table public.memorials enable row level security;

create policy "read public or own" on public.memorials for select
  using (visibility = 'public' or owner_id = auth.uid());
create policy "insert own" on public.memorials for insert
  with check (owner_id = auth.uid() and (select count(*) from public.memorials m where m.owner_id = auth.uid()) < 5);
create policy "update own" on public.memorials for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own" on public.memorials for delete using (owner_id = auth.uid());

create table public.tributes (
  id uuid primary key default gen_random_uuid(),
  memorial_id uuid not null references public.memorials(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('flowers','candle','letter')),
  body text not null default '' check (char_length(body) <= 500),
  created_at timestamptz not null default now()
);
alter table public.tributes enable row level security;
create index on public.tributes (memorial_id);

-- Flowers and candles are visible wherever the memorial is visible; letters only to the memorial's owner and the author.
create policy "read tributes" on public.tributes for select using (
  exists (select 1 from public.memorials m where m.id = memorial_id)   -- RLS of memorials applies here
  and (kind in ('flowers','candle') or author_id = auth.uid()
       or exists (select 1 from public.memorials m where m.id = memorial_id and m.owner_id = auth.uid()))
);
create policy "add tributes" on public.tributes for insert with check (
  author_id = auth.uid() and exists (select 1 from public.memorials m where m.id = memorial_id)
);
create policy "delete tributes" on public.tributes for delete using (
  author_id = auth.uid() or exists (select 1 from public.memorials m where m.id = memorial_id and m.owner_id = auth.uid())
);

-- Aggregate used for the flower counts on shrines (respects RLS of the caller).
create view public.tribute_flower_counts with (security_invoker = true) as
  select memorial_id, count(*)::int as n from public.tributes where kind = 'flowers' group by memorial_id;

-- A candle burns for one day (Korea time): one per visitor per memorial per day, and it goes out at midnight.
create unique index one_candle_per_day on public.tributes (memorial_id, author_id, ((created_at at time zone 'Asia/Seoul')::date)) where kind = 'candle';
create view public.tribute_candle_counts with (security_invoker = true) as
  select memorial_id, count(*)::int as n from public.tributes
  where kind = 'candle' and (created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date
  group by memorial_id;

-- Private photo bucket: 5 MB, images only. Photos are served through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pet-photos', 'pet-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read public or own photos" on storage.objects for select to authenticated
  using (bucket_id = 'pet-photos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.memorials m where m.photo_path = name and m.visibility = 'public')
  ));
create policy "delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'pet-photos' and (storage.foldername(name))[1] = auth.uid()::text);
