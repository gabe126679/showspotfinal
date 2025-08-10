-- Debug venue image loading issues
-- Run these queries to diagnose the venue image problems

-- 1. Check venue data and image URLs
SELECT 
    venue_id,
    venue_name,
    venue_profile_image,
    venue_secondary_images,
    array_length(venue_secondary_images, 1) as secondary_image_count,
    created_at
FROM venues 
WHERE venue_profile_image IS NOT NULL 
   OR array_length(venue_secondary_images, 1) > 0
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check storage buckets
SELECT 
    id,
    name,
    public,
    created_at
FROM storage.buckets 
WHERE name LIKE '%venue%';

-- 3. Check storage objects in venue buckets
SELECT 
    bucket_id,
    name,
    created_at,
    updated_at,
    metadata->>'size' as file_size,
    metadata->>'mimetype' as mime_type
FROM storage.objects 
WHERE bucket_id IN ('venue-secondary-images', 'venue-profile-images')
ORDER BY created_at DESC
LIMIT 20;

-- 4. Check RLS policies on storage.objects
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage';

-- 5. Test if venues table has proper image data types
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'venues' 
  AND column_name IN ('venue_profile_image', 'venue_secondary_images');

-- 6. Sample test to see what actual URLs look like
SELECT 
    venue_name,
    venue_profile_image,
    venue_secondary_images[1] as first_secondary_image,
    CASE 
        WHEN venue_profile_image LIKE 'https://%' THEN 'Full URL'
        WHEN venue_profile_image LIKE '/%' THEN 'Relative path'
        ELSE 'Other format'
    END as profile_image_format
FROM venues 
WHERE venue_profile_image IS NOT NULL
LIMIT 5;