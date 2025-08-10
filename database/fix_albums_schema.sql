-- Fix albums schema and foreign key relationships
-- This script ensures albums and album_purchases tables exist with proper relationships

-- 1. Create albums table if it doesn't exist
CREATE TABLE IF NOT EXISTS albums (
  album_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_title VARCHAR(255) NOT NULL,
  album_songs TEXT[] DEFAULT '{}',
  album_song_data JSONB DEFAULT '[]',
  album_image TEXT,
  album_price VARCHAR(50) DEFAULT '0',
  album_type VARCHAR(20) NOT NULL CHECK (album_type IN ('artist', 'band')),
  artist_id UUID,
  band_id UUID,
  album_status VARCHAR(20) DEFAULT 'pending' CHECK (album_status IN ('active', 'pending', 'inactive')),
  album_consensus JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create album_purchases table if it doesn't exist
CREATE TABLE IF NOT EXISTS album_purchases (
  purchase_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID NOT NULL,
  purchaser_id UUID NOT NULL,
  purchase_price VARCHAR(50) NOT NULL,
  purchase_date TIMESTAMPTZ DEFAULT NOW(),
  purchase_type VARCHAR(20) DEFAULT 'paid' CHECK (purchase_type IN ('paid', 'free')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add foreign key constraints if they don't exist
DO $$
BEGIN
  -- Add foreign key for albums.artist_id -> artists.artist_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'albums_artist_id_fkey'
  ) THEN
    ALTER TABLE albums ADD CONSTRAINT albums_artist_id_fkey 
    FOREIGN KEY (artist_id) REFERENCES artists(artist_id) ON DELETE CASCADE;
  END IF;

  -- Add foreign key for albums.band_id -> bands.band_id  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'albums_band_id_fkey'
  ) THEN
    ALTER TABLE albums ADD CONSTRAINT albums_band_id_fkey 
    FOREIGN KEY (band_id) REFERENCES bands(band_id) ON DELETE CASCADE;
  END IF;

  -- Add foreign key for album_purchases.album_id -> albums.album_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'album_purchases_album_id_fkey'
  ) THEN
    ALTER TABLE album_purchases ADD CONSTRAINT album_purchases_album_id_fkey 
    FOREIGN KEY (album_id) REFERENCES albums(album_id) ON DELETE CASCADE;
  END IF;

  -- Add foreign key for album_purchases.purchaser_id -> spotters.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'album_purchases_purchaser_id_fkey'
  ) THEN
    ALTER TABLE album_purchases ADD CONSTRAINT album_purchases_purchaser_id_fkey 
    FOREIGN KEY (purchaser_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_albums_artist_id ON albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_albums_band_id ON albums(band_id);
CREATE INDEX IF NOT EXISTS idx_albums_status ON albums(album_status);
CREATE INDEX IF NOT EXISTS idx_albums_type ON albums(album_type);
CREATE INDEX IF NOT EXISTS idx_album_purchases_album_id ON album_purchases(album_id);
CREATE INDEX IF NOT EXISTS idx_album_purchases_purchaser_id ON album_purchases(purchaser_id);
CREATE INDEX IF NOT EXISTS idx_album_purchases_date ON album_purchases(purchase_date);

-- 5. Enable RLS on albums table
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_purchases ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for albums
DROP POLICY IF EXISTS "Albums are viewable by everyone" ON albums;
CREATE POLICY "Albums are viewable by everyone" ON albums
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Artists can manage their own albums" ON albums;
CREATE POLICY "Artists can manage their own albums" ON albums
  FOR ALL USING (
    artist_id IN (
      SELECT artist_id FROM artists WHERE spotter_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Band members can manage band albums" ON albums;
CREATE POLICY "Band members can manage band albums" ON albums
  FOR ALL USING (
    album_type = 'band' AND
    band_id IN (
      SELECT b.band_id FROM bands b
      JOIN artists a ON a.artist_id = ANY(b.band_members)
      WHERE a.spotter_id = auth.uid()
    )
  );

-- 7. Create RLS policies for album_purchases
DROP POLICY IF EXISTS "Users can view their own purchases" ON album_purchases;
CREATE POLICY "Users can view their own purchases" ON album_purchases
  FOR SELECT USING (purchaser_id = auth.uid());

DROP POLICY IF EXISTS "Users can make purchases" ON album_purchases;
CREATE POLICY "Users can make purchases" ON album_purchases
  FOR INSERT WITH CHECK (purchaser_id = auth.uid());

-- 8. Create updated_at trigger for albums
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_albums_updated_at ON albums;
CREATE TRIGGER update_albums_updated_at
  BEFORE UPDATE ON albums
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Verify the schema
SELECT 
  'albums' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'albums'
ORDER BY ordinal_position;

SELECT 
  'album_purchases' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'album_purchases'
ORDER BY ordinal_position;

-- 10. Show foreign key relationships
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('albums', 'album_purchases')
ORDER BY tc.table_name, tc.constraint_name;