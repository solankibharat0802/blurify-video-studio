-- Create storage bucket for edited videos
INSERT INTO storage.buckets (id, name, public) VALUES ('edited-videos', 'edited-videos', false);

-- Create RLS policies for edited-videos bucket
CREATE POLICY "Users can view their own edited videos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'edited-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can download their own edited videos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'edited-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add processed_at column to uploadvideo table
ALTER TABLE uploadvideo ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;