-- Fix storage policies for venue images
-- This should resolve the venue secondary images not loading issue

-- 1. Check if storage bucket exists and create if needed
INSERT INTO storage.buckets (id, name, public) 
VALUES ('venue-secondary-images', 'venue-secondary-images', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Create permissive RLS policies for venue-secondary-images bucket
-- Allow public read access to all venue images
CREATE POLICY "Public read access for venue images" ON storage.objects
FOR SELECT USING (bucket_id = 'venue-secondary-images');

-- Allow authenticated users to insert their own venue images
CREATE POLICY "Authenticated users can insert venue images" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'venue-secondary-images' 
    AND auth.role() = 'authenticated'
);

-- Allow users to update their own venue images
CREATE POLICY "Users can update their own venue images" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'venue-secondary-images' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own venue images
CREATE POLICY "Users can delete their own venue images" ON storage.objects
FOR DELETE USING (
    bucket_id = 'venue-secondary-images' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Also ensure the main venue profile images bucket has correct policies
INSERT INTO storage.buckets (id, name, public) 
VALUES ('venue-profile-images', 'venue-profile-images', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read access for venue profile images
CREATE POLICY "Public read access for venue profile images" ON storage.objects
FOR SELECT USING (bucket_id = 'venue-profile-images');

-- Allow authenticated users to manage their venue profile images
CREATE POLICY "Authenticated users can insert venue profile images" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'venue-profile-images' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own venue profile images" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'venue-profile-images' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own venue profile images" ON storage.objects
FOR DELETE USING (
    bucket_id = 'venue-profile-images' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;