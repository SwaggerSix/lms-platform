-- Public bucket for course cover art (marketing imagery shown on storefront,
-- catalog, and class cards). Mirrors the existing public 'nudge-images' bucket.
-- Cover images populate courses.thumbnail_url, which is consumed as a direct,
-- non-expiring URL across the storefront, embeds, class cards, and catalog.
insert into storage.buckets (id, name, public)
values ('course-images', 'course-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can view course images" on storage.objects;
create policy "Anyone can view course images"
  on storage.objects for select
  to public
  using (bucket_id = 'course-images');

drop policy if exists "Authenticated users can upload course images" on storage.objects;
create policy "Authenticated users can upload course images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'course-images');

drop policy if exists "Authenticated users can update course images" on storage.objects;
create policy "Authenticated users can update course images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'course-images')
  with check (bucket_id = 'course-images');

drop policy if exists "Authenticated users can delete course images" on storage.objects;
create policy "Authenticated users can delete course images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'course-images');
