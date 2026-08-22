insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'mission-proof-media',
  'mission-proof-media',
  true,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
where not exists (
  select 1
  from storage.buckets
  where id = 'mission-proof-media'
);

update storage.buckets
set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
where id = 'mission-proof-media';

drop policy if exists "Learners can add their own mission proof media" on storage.objects;
create policy "Learners can add their own mission proof media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'mission-proof-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Learners can read their own mission proof media" on storage.objects;
create policy "Learners can read their own mission proof media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'mission-proof-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
