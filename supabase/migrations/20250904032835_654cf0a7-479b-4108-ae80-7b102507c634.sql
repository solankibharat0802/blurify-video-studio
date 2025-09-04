-- Fix storage policies for video uploads
-- Allow temporary uploads with user folder structure

-- Policies for original-videos bucket
CREATE POLICY "Allow uploads to temp-user folder in original-videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'original-videos' 
  AND (storage.foldername(name))[1] = 'temp-user'
);

CREATE POLICY "Allow viewing temp-user files in original-videos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'original-videos' 
  AND (storage.foldername(name))[1] = 'temp-user'
);

-- Policies for edited-videos bucket
CREATE POLICY "Allow uploads to temp-user folder in edited-videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'edited-videos' 
  AND (storage.foldername(name))[1] = 'temp-user'
);

CREATE POLICY "Allow viewing temp-user files in edited-videos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'edited-videos' 
  AND (storage.foldername(name))[1] = 'temp-user'
);

CREATE POLICY "Allow updates to temp-user files in edited-videos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'edited-videos' 
  AND (storage.foldername(name))[1] = 'temp-user'
);

CREATE POLICY "Allow deleting temp-user files in both buckets"
ON storage.objects FOR DELETE
USING (
  (bucket_id = 'original-videos' OR bucket_id = 'edited-videos')
  AND (storage.foldername(name))[1] = 'temp-user'
);