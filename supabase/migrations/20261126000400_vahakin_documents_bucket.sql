-- Ensure the VahakIN private documents bucket exists on previously migrated databases.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('vahakin-documents','vahakin-documents',false,5242880,array['application/pdf','image/jpeg','image/png'])
 on conflict(id) do nothing;
commit;
