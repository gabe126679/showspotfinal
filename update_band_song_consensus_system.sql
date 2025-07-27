-- Update existing songs table for band song consensus system
-- Only add columns that don't already exist

-- Check what columns already exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'songs' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Add band_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'songs' AND column_name = 'band_id') THEN
        ALTER TABLE songs ADD COLUMN band_id UUID REFERENCES bands(band_id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add song_approved column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'songs' AND column_name = 'song_approved') THEN
        ALTER TABLE songs ADD COLUMN song_approved BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Add uploader_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'songs' AND column_name = 'uploader_id') THEN
        ALTER TABLE songs ADD COLUMN uploader_id UUID;
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_songs_band_id ON songs(band_id);
CREATE INDEX IF NOT EXISTS idx_songs_band_approved ON songs(band_id, song_approved);

-- Only create GIN index on song_consensus if the column exists and contains JSONB data
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'songs' AND column_name = 'song_consensus' AND data_type = 'jsonb') THEN
        CREATE INDEX IF NOT EXISTS idx_songs_consensus ON songs USING GIN(song_consensus);
    END IF;
END $$;

-- Update existing artist songs to be approved by default (they don't need consensus)
UPDATE songs 
SET song_approved = true, uploader_id = artist_id::uuid 
WHERE band_id IS NULL AND (song_approved IS NULL OR song_approved = false);

-- Update existing songs that might have band_id but no approval status
UPDATE songs 
SET song_approved = CASE 
    WHEN band_id IS NULL THEN true 
    ELSE false 
END,
uploader_id = CASE 
    WHEN uploader_id IS NULL THEN artist_id::uuid 
    ELSE uploader_id 
END
WHERE song_approved IS NULL;

-- Drop existing RLS policies if they exist
DROP POLICY IF EXISTS "Users can view songs" ON songs;
DROP POLICY IF EXISTS "users_can_view_songs" ON songs;
DROP POLICY IF EXISTS "users_can_insert_songs" ON songs;
DROP POLICY IF EXISTS "users_can_update_songs" ON songs;

-- Create comprehensive RLS policies with proper type casting
CREATE POLICY "users_can_view_songs" 
ON songs 
FOR SELECT 
TO authenticated 
USING (
  -- User can see their own artist songs
  artist_id::uuid IN (
    SELECT artist_id FROM artists WHERE spotter_id = auth.uid()
  )
  OR
  -- User can see approved band songs from bands they're members of
  (band_id IS NOT NULL AND (
    song_approved = true 
    OR 
    band_id IN (
      SELECT b.band_id FROM bands b
      WHERE auth.uid() IN (
        SELECT a.spotter_id FROM artists a 
        WHERE a.artist_id = ANY(b.band_members)
      )
    )
  ))
  OR
  -- Public songs (if song_status is active and approved)
  (song_status = 'active' AND song_approved = true)
);

-- Users can insert songs (both artist and band songs)
CREATE POLICY "users_can_insert_songs" 
ON songs 
FOR INSERT 
TO authenticated 
WITH CHECK (
  -- User can upload as their artist
  artist_id::uuid IN (
    SELECT artist_id FROM artists WHERE spotter_id = auth.uid()
  )
);

-- Users can update songs they uploaded or songs in bands they're members of
CREATE POLICY "users_can_update_songs" 
ON songs 
FOR UPDATE 
TO authenticated 
USING (
  -- User uploaded this song
  uploader_id IN (
    SELECT artist_id FROM artists WHERE spotter_id = auth.uid()
  )
  OR
  -- User is a member of the band (for consensus updates)
  band_id IN (
    SELECT b.band_id FROM bands b
    WHERE auth.uid() IN (
      SELECT a.spotter_id FROM artists a 
      WHERE a.artist_id = ANY(b.band_members)
    )
  )
);

-- Show the updated table structure
\d songs;