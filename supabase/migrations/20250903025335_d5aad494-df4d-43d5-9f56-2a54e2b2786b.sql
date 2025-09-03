-- Create storage buckets for videos
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('original-videos', 'original-videos', false),
  ('edited-videos', 'edited-videos', false);

-- Create table for video uploads
CREATE TABLE public.uploadvideo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  original_filename TEXT NOT NULL,
  original_file_path TEXT NOT NULL,
  edited_file_path TEXT,
  file_size BIGINT,
  duration REAL,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'completed', 'failed')),
  blur_masks JSONB,
  start_time REAL DEFAULT 0,
  end_time REAL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.uploadvideo ENABLE ROW LEVEL SECURITY;

-- Create policies for video access
CREATE POLICY "Users can view their own videos" 
ON public.uploadvideo 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can upload their own videos" 
ON public.uploadvideo 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own videos" 
ON public.uploadvideo 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own videos" 
ON public.uploadvideo 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create storage policies for original videos
CREATE POLICY "Users can view their own original videos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'original-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own original videos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'original-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own original videos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'original-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage policies for edited videos
CREATE POLICY "Users can view their own edited videos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'edited-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own edited videos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'edited-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_uploadvideo_updated_at
BEFORE UPDATE ON public.uploadvideo
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();