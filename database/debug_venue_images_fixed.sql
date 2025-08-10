-- Debug venue image loading issues (Fixed Version)
-- Run these queries to diagnose the venue image problems

-- 1. Check venue data and image URLs (fixed for text array)
SELECT 
    venue_id,
    venue_name,
    venue_profile_image,
    venue_secondary_images,
    CASE 
        WHEN venue_secondary_images IS NULL THEN 0
        WHEN venue_secondary_images = '{}' THEN 0
        ELSE COALESCE(jsonb_array_length(venue_secondary_images::jsonb), 0)
    END as secondary_image_count,
    created_at
FROM venues 
WHERE venue_profile_image IS NOT NULL 
   OR venue_secondary_images IS NOT NULL
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
  AND schemaname = 'storage'
  AND (policyname LIKE '%venue%' OR qual::text LIKE '%venue%');

-- 5. Test if venues table has proper image data types
SELECT 
    column_name,
    data_type,
    udt_name,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'venues' 
  AND column_name IN ('venue_profile_image', 'venue_secondary_images');

-- 6. Sample test to see what actual URLs look like
SELECT 
    venue_name,
    venue_profile_image,
    CASE 
        WHEN venue_secondary_images IS NULL THEN NULL
        WHEN venue_secondary_images = '{}' THEN NULL
        ELSE venue_secondary_images::jsonb->0
    END as first_secondary_image,
    CASE 
        WHEN venue_profile_image LIKE 'https://%' THEN 'Full URL'
        WHEN venue_profile_image LIKE '/%' THEN 'Relative path'
        WHEN venue_profile_image IS NULL THEN 'NULL'
        ELSE 'Other format'
    END as profile_image_format
FROM venues 
WHERE venue_profile_image IS NOT NULL
   OR venue_secondary_images IS NOT NULL
LIMIT 5;

-- 7. Check a specific venue's images in detail
-- Replace 'your-venue-id' with actual venue ID to debug specific venue
/*
SELECT 
    venue_id,
    venue_name,
    venue_profile_image,
    venue_secondary_images,
    jsonb_pretty(venue_secondary_images::jsonb) as secondary_images_formatted
FROM venues 
WHERE venue_id = 'your-venue-id';
*/

-- 8. Check if there are any venues with malformed secondary images
SELECT 
    venue_id,
    venue_name,
    venue_secondary_images,
    pg_typeof(venue_secondary_images) as data_type
FROM venues
WHERE venue_secondary_images IS NOT NULL
  AND venue_secondary_images::text NOT LIKE '{%'
LIMIT 10;