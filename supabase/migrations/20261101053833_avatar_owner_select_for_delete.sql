create policy "Users can list their own MOVEIT avatars"
on storage.objects for select to authenticated
using (
  bucket_id = 'moveit-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);