-- Update storage policies to use authenticated user IDs
-- Drop existing temp-user policies
DROP POLICY IF EXISTS "Allow uploads to temp-user folder in original-videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow viewing temp-user files in original-videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow uploads to temp-user folder in edited-videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow viewing temp-user files in edited-videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow updates to temp-user files in edited-videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow deleting temp-user files in both buckets" ON storage.objects;

-- Create user-specific storage policies
CREATE POLICY "Users can upload their own videos to original-videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'original-videos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own videos in original-videos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'original-videos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload their own videos to edited-videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'edited-videos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own videos in edited-videos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'edited-videos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own videos in edited-videos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'edited-videos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own videos"
ON storage.objects FOR DELETE
USING (
  (bucket_id = 'original-videos' OR bucket_id = 'edited-videos')
  AND (storage.foldername(name))[1] = auth.uid()::text
);