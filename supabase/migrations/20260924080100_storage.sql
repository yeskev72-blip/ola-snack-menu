-- Stockage facultatif des photos de repas (désactivé par défaut côté Edge Function).
-- Bucket privé ; chaque utilisateur n'accède qu'à son dossier « <user_id>/... ».

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy "photos : lecture de son dossier"
on storage.objects for select to authenticated
using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "photos : suppression de son dossier"
on storage.objects for delete to authenticated
using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Pas de politique d'insertion : l'upload est fait par l'Edge Function (service role).
