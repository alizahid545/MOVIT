alter table public.profiles
  add column avatar_object_path text,
  add constraint profiles_avatar_object_path_owner check (
    avatar_object_path is null
    or avatar_object_path ~ (
      '^' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
    )
  );

grant insert (id, username, display_name, bio, city)
  on public.profiles to authenticated;
grant update (avatar_object_path, avatar_url)
  on public.profiles to authenticated;

create policy "Users can create their own profile"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'moveit-avatars',
  'moveit-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload their own MOVEIT avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'moveit-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.filename(name)) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
);

create policy "Users can delete their own MOVEIT avatars"
on storage.objects for delete to authenticated
using (
  bucket_id = 'moveit-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);