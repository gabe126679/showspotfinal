-- Fix storage policies for venue images (Supabase Dashboard Safe Version)
-- Run this in the Supabase SQL editor

-- 1. First, let's check/create the storage buckets
-- Note: If buckets already exist, these will fail safely
INSERT INTO storage.buckets (id, name, public) 
VALUES ('venue-secondary-images', 'venue-secondary-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('venue-profile-images', 'venue-profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Make sure buckets are public
UPDATE storage.buckets 
SET public = true 
WHERE id IN ('venue-secondary-images', 'venue-profile-images');

-- 3. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Public read access for venue images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can insert venue images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own venue images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own venue images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for venue profile images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can insert venue profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own venue profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own venue profile images" ON storage.objects;

-- 4. Create new policies for venue-secondary-images
CREATE POLICY "venue_secondary_images_public_read" ON storage.objects
FOR SELECT USING (bucket_id = 'venue-secondary-images');

CREATE POLICY "venue_secondary_images_auth_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'venue-secondary-images');

CREATE POLICY "venue_secondary_images_user_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'venue-secondary-images' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'venue-secondary-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "venue_secondary_images_user_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'venue-secondary-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 5. Create policies for venue-profile-images  
CREATE POLICY "venue_profile_images_public_read" ON storage.objects
FOR SELECT USING (bucket_id = 'venue-profile-images');

CREATE POLICY "venue_profile_images_auth_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'venue-profile-images');

CREATE POLICY "venue_profile_images_user_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'venue-profile-images' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'venue-profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "venue_profile_images_user_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'venue-profile-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 6. Verify the policies were created
SELECT 
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE 'venue_%';