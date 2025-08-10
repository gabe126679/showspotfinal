-- Quick fix for venue image loading issues
-- Run this in Supabase SQL editor to ensure images can be accessed

-- 1. Make venue-secondary-images bucket public (if it exists)
UPDATE storage.buckets 
SET public = true 
WHERE id = 'venue-secondary-images';

-- 2. Create a simple public read policy
-- First drop any conflicting policies
DO $$ 
BEGIN
    -- Drop policies if they exist
    DROP POLICY IF EXISTS "Anyone can view venue images" ON storage.objects;
    DROP POLICY IF EXISTS "venue_images_public" ON storage.objects;
    DROP POLICY IF EXISTS "Public venue images" ON storage.objects;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Create a simple public read policy for venue images
CREATE POLICY "Anyone can view venue images" ON storage.objects
FOR SELECT 
USING (bucket_id = 'venue-secondary-images');

-- 3. Test query to see venue images
SELECT 
    v.venue_id,
    v.venue_name,
    v.venue_profile_image,
    v.venue_secondary_images,
    CASE 
        WHEN v.venue_profile_image IS NOT NULL THEN 'Has profile image'
        ELSE 'No profile image'
    END as profile_status,
    CASE 
        WHEN v.venue_secondary_images IS NULL THEN 'No secondary images'
        WHEN v.venue_secondary_images::text = '{}' THEN 'Empty array'
        ELSE 'Has secondary images'
    END as secondary_status
FROM venues v
ORDER BY v.created_at DESC
LIMIT 10;

-- 4. If you see URLs in the results above, test if they're accessible by checking one:
-- Look for patterns like:
-- https://your-project.supabase.co/storage/v1/object/public/venue-secondary-images/...
-- If URLs are missing '/storage/v1/object/public/', that's the problem

-- 5. Optional: Update any malformed URLs (uncomment and modify if needed)
/*
UPDATE venues
SET venue_profile_image = REPLACE(venue_profile_image, 
    'your-project.supabase.co/', 
    'your-project.supabase.co/storage/v1/object/public/')
WHERE venue_profile_image NOT LIKE '%/storage/v1/object/public/%'
  AND venue_profile_image IS NOT NULL;
*/