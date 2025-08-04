-- Followers System
-- Creates a centralized followers table and functions for follow/unfollow functionality

-- 1. Create the followers table
CREATE TABLE IF NOT EXISTS followers (
  follower_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('artist', 'band', 'venue')),
  follower_count INTEGER DEFAULT 0,
  follower_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint to ensure one record per entity
ALTER TABLE followers 
ADD CONSTRAINT followers_entity_unique 
UNIQUE (entity_id, entity_type);

-- Create GIN index for efficient array operations on follower_ids
CREATE INDEX IF NOT EXISTS followers_follower_ids_gin 
ON followers USING GIN (follower_ids);

-- Create index for entity lookups
CREATE INDEX IF NOT EXISTS followers_entity_lookup 
ON followers (entity_type, entity_id);

-- Enable RLS
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

-- RLS policy: Anyone can read followers data
CREATE POLICY "Public read access for followers" ON followers
FOR SELECT USING (true);

-- RLS policy: Only authenticated users can modify followers
CREATE POLICY "Authenticated users can modify followers" ON followers
FOR ALL USING (auth.role() = 'authenticated');

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_followers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER followers_updated_at_trigger
  BEFORE UPDATE ON followers
  FOR EACH ROW
  EXECUTE FUNCTION update_followers_updated_at();

-- 2. Function to check if a user is following an entity
CREATE FUNCTION user_is_following_entity(
  entity_id UUID,
  entity_type TEXT,
  user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entity_id UUID := entity_id;
  v_entity_type TEXT := entity_type;
  v_user_id UUID := user_id;
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM followers f
    WHERE f.entity_id = v_entity_id 
    AND f.entity_type = v_entity_type
    AND v_user_id::text = ANY(f.follower_ids)
  );
END;
$$;

-- 3. Function to get follower info for an entity
CREATE FUNCTION get_follower_info(
  entity_id UUID,
  entity_type TEXT,
  user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  follower_count INTEGER,
  user_is_following BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entity_id UUID := entity_id;
  v_entity_type TEXT := entity_type;
  v_user_id UUID := user_id;
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(f.follower_count, 0) as follower_count,
    CASE 
      WHEN v_user_id IS NULL THEN FALSE
      ELSE user_is_following_entity(v_entity_id, v_entity_type, v_user_id)
    END as user_is_following
  FROM followers f
  WHERE f.entity_id = v_entity_id 
  AND f.entity_type = v_entity_type;
  
  -- If no record exists, return default values
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0 as follower_count, FALSE as user_is_following;
  END IF;
END;
$$;

-- 4. Function to follow/unfollow an entity
CREATE FUNCTION toggle_follow_entity(
  entity_id UUID,
  entity_type TEXT,
  user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entity_id UUID := entity_id;
  v_entity_type TEXT := entity_type;
  v_user_id UUID := user_id;
  is_following BOOLEAN;
  new_follower_count INTEGER;
  updated_follower_ids TEXT[];
BEGIN
  -- Validate entity type
  IF v_entity_type NOT IN ('artist', 'band', 'venue') THEN
    RAISE EXCEPTION 'Invalid entity type. Must be artist, band, or venue';
  END IF;

  -- Check if user is already following
  SELECT user_is_following_entity(v_entity_id, v_entity_type, v_user_id)
  INTO is_following;
  
  IF is_following THEN
    -- Unfollow: Remove user from follower_ids array
    UPDATE followers 
    SET 
      follower_ids = array_remove(follower_ids, v_user_id::text),
      follower_count = array_length(array_remove(follower_ids, v_user_id::text), 1)
    WHERE entity_id = v_entity_id 
    AND entity_type = v_entity_type;
    
    RETURN FALSE; -- Now unfollowing
  ELSE
    -- Follow: Add user to follower_ids array
    -- First ensure the record exists
    INSERT INTO followers (entity_id, entity_type, follower_count, follower_ids)
    VALUES (v_entity_id, v_entity_type, 1, ARRAY[v_user_id::text])
    ON CONFLICT ON CONSTRAINT followers_entity_unique
    DO UPDATE SET
      follower_ids = COALESCE(followers.follower_ids, '{}') || ARRAY[v_user_id::text],
      follower_count = array_length(COALESCE(followers.follower_ids, '{}') || ARRAY[v_user_id::text], 1);
    
    RETURN TRUE; -- Now following
  END IF;
END;
$$;

-- 5. Function to get follow counts for multiple entities (for profile displays)
CREATE FUNCTION get_entity_follower_counts(
  entity_ids UUID[],
  entity_types TEXT[]
)
RETURNS TABLE(
  entity_id UUID,
  entity_type TEXT,
  follower_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entity_ids UUID[] := entity_ids;
  v_entity_types TEXT[] := entity_types;
BEGIN
  RETURN QUERY
  SELECT 
    f.entity_id,
    f.entity_type,
    COALESCE(f.follower_count, 0) as follower_count
  FROM followers f
  WHERE f.entity_id = ANY(v_entity_ids)
  AND f.entity_type = ANY(v_entity_types);
END;
$$;

-- 6. Initialize follower records for existing entities (run once)
-- This creates initial follower records for all existing artists, bands, and venues

-- Insert initial records for artists
INSERT INTO followers (entity_id, entity_type, follower_count, follower_ids)
SELECT artist_id, 'artist', 0, '{}'
FROM artists
ON CONFLICT ON CONSTRAINT followers_entity_unique DO NOTHING;

-- Insert initial records for bands  
INSERT INTO followers (entity_id, entity_type, follower_count, follower_ids)
SELECT band_id, 'band', 0, '{}'
FROM bands
ON CONFLICT ON CONSTRAINT followers_entity_unique DO NOTHING;

-- Insert initial records for venues
INSERT INTO followers (entity_id, entity_type, follower_count, follower_ids)
SELECT venue_id, 'venue', 0, '{}'
FROM venues
ON CONFLICT ON CONSTRAINT followers_entity_unique DO NOTHING;