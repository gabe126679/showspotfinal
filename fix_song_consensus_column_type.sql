-- Fix song_consensus column type from boolean to JSONB
-- This allows storing the consensus array for band songs

-- First, check the current column type
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'songs' 
  AND column_name = 'song_consensus';

-- Backup existing boolean values before changing column type
-- For existing songs, convert boolean to appropriate structure
ALTER TABLE songs 
ALTER COLUMN song_consensus 
SET DATA TYPE JSONB 
USING CASE 
  WHEN song_consensus = true THEN 'true'::jsonb
  WHEN song_consensus = false THEN 'false'::jsonb
  ELSE '[]'::jsonb
END;

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'songs' 
  AND column_name = 'song_consensus';

-- Update existing artist songs (non-band songs) to have proper consensus
UPDATE songs 
SET song_consensus = 'true'::jsonb
WHERE band_id IS NULL 
  AND song_consensus = 'true'::jsonb;

-- Show a few sample rows to verify
SELECT song_id, song_title, band_id, song_consensus, song_approved 
FROM songs 
LIMIT 5;