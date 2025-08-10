-- Fix venue_secondary_images data type issue
-- This migration ensures the column can properly store array data

-- 1. First check current data type
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'venues' 
  AND column_name = 'venue_secondary_images';

-- 2. Backup existing data (just in case)
CREATE TEMP TABLE venue_images_backup AS
SELECT venue_id, venue_secondary_images
FROM venues
WHERE venue_secondary_images IS NOT NULL;

-- 3. If the column is TEXT or VARCHAR, convert it to proper array type
DO $$
BEGIN
    -- Check if column exists and needs conversion
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'venues' 
        AND column_name = 'venue_secondary_images'
        AND data_type NOT LIKE '%ARRAY%'
    ) THEN
        -- Add new column with correct type
        ALTER TABLE venues ADD COLUMN venue_secondary_images_new TEXT[];
        
        -- Copy data, handling different formats
        UPDATE venues
        SET venue_secondary_images_new = 
            CASE 
                WHEN venue_secondary_images IS NULL THEN NULL
                WHEN venue_secondary_images::text = '{}' THEN '{}'::TEXT[]
                WHEN venue_secondary_images::text LIKE '{%' THEN venue_secondary_images::TEXT[]
                WHEN venue_secondary_images::text LIKE '[%' THEN 
                    -- Handle JSON array format
                    ARRAY(SELECT jsonb_array_elements_text(venue_secondary_images::jsonb))
                ELSE ARRAY[venue_secondary_images::text] -- Single value
            END;
        
        -- Drop old column and rename new one
        ALTER TABLE venues DROP COLUMN venue_secondary_images;
        ALTER TABLE venues RENAME COLUMN venue_secondary_images_new TO venue_secondary_images;
    END IF;
END $$;

-- 4. Verify the change
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'venues' 
  AND column_name = 'venue_secondary_images';

-- 5. Check data after migration
SELECT 
    venue_id,
    venue_name,
    venue_secondary_images,
    array_length(venue_secondary_images, 1) as image_count
FROM venues
WHERE venue_secondary_images IS NOT NULL
LIMIT 5;