-- Update existing songs to have proper song_type values
-- This ensures all songs work correctly with the band name display

-- First, check what songs exist without song_type
SELECT song_id, song_title, band_id, song_type, artist_id
FROM songs 
WHERE song_type IS NULL
ORDER BY created_at DESC;

-- Update songs that have band_id to be song_type = 'band'
UPDATE songs 
SET song_type = 'band'
WHERE band_id IS NOT NULL 
  AND (song_type IS NULL OR song_type != 'band');

-- Update songs that don't have band_id to be song_type = 'artist'  
UPDATE songs 
SET song_type = 'artist'
WHERE band_id IS NULL 
  AND (song_type IS NULL OR song_type != 'artist');

-- Verify the updates
SELECT 
  song_type,
  COUNT(*) as count,
  COUNT(CASE WHEN band_id IS NOT NULL THEN 1 END) as with_band_id,
  COUNT(CASE WHEN band_id IS NULL THEN 1 END) as without_band_id
FROM songs 
GROUP BY song_type
ORDER BY song_type;

-- Show some sample records
SELECT song_id, song_title, song_type, 
       CASE WHEN band_id IS NOT NULL THEN 'HAS_BAND' ELSE 'NO_BAND' END as band_status
FROM songs 
ORDER BY created_at DESC 
LIMIT 10;