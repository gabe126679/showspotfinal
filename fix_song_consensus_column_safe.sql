-- Safely fix song_consensus column type from boolean to JSONB
-- Handle default value constraint properly

-- First, check the current column type and constraints
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'songs' 
  AND column_name = 'song_consensus';

-- Step 1: Drop the default constraint first
ALTER TABLE songs ALTER COLUMN song_consensus DROP DEFAULT;

-- Step 2: Convert the column type with proper casting
ALTER TABLE songs 
ALTER COLUMN song_consensus 
SET DATA TYPE JSONB 
USING CASE 
  WHEN song_consensus = true THEN 'true'::jsonb
  WHEN song_consensus = false THEN 'false'::jsonb
  WHEN song_consensus IS NULL THEN 'null'::jsonb
  ELSE '[]'::jsonb
END;

-- Step 3: Set a new default value for JSONB (for artist songs)
ALTER TABLE songs ALTER COLUMN song_consensus SET DEFAULT 'true'::jsonb;

-- Verify the change
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'songs' 
  AND column_name = 'song_consensus';

-- Update existing artist songs (non-band songs) to have proper consensus
UPDATE songs 
SET song_consensus = 'true'::jsonb
WHERE band_id IS NULL 
  AND (song_consensus = 'false'::jsonb OR song_consensus = 'null'::jsonb);

-- Show a few sample rows to verify
SELECT song_id, song_title, band_id, song_consensus, song_approved, song_type
FROM songs 
ORDER BY created_at DESC
LIMIT 5;

-- Optional: Create index for better performance on JSONB queries
CREATE INDEX IF NOT EXISTS idx_songs_consensus_jsonb ON songs USING GIN(song_consensus);