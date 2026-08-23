-- Bucket público para fotos de perfil. Córrelo en el SQL Editor de Supabase.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
drop policy if exists avatars_anon_insert on storage.objects;
drop policy if exists avatars_anon_update on storage.objects;
drop policy if exists avatars_anon_delete on storage.objects;

create policy avatars_public_read on storage.objects for select using (bucket_id = 'avatars');
create policy avatars_anon_insert on storage.objects for insert with check (bucket_id = 'avatars');
create policy avatars_anon_update on storage.objects for update using (bucket_id = 'avatars');
create policy avatars_anon_delete on storage.objects for delete using (bucket_id = 'avatars');
