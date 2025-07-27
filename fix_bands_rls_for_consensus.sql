-- Fix bands table RLS policies to allow band members to update band_consensus
-- This allows band members to accept/reject invitations

-- First, let's see what policies exist on the bands table
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'bands'
ORDER BY cmd, policyname;

-- Update the bands table UPDATE policy to allow band members to update band_consensus
-- We need to allow updates where the current user is either:
-- 1. The band creator (existing permission)
-- 2. A band member trying to update only the band_consensus field

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Band creators can update their bands" ON bands;
DROP POLICY IF EXISTS "Users can update their own bands" ON bands;
DROP POLICY IF EXISTS "band_creators_can_update" ON bands;

-- Create new update policy that allows:
-- 1. Band creators to update everything
-- 2. Band members to update only band_consensus
CREATE POLICY "band_update_policy" 
ON bands 
FOR UPDATE 
TO authenticated 
USING (
  -- User is the band creator (can update anything)
  band_creator = auth.uid()
  OR
  -- User is a band member (for updating consensus only)
  auth.uid() IN (
    SELECT artist.spotter_id 
    FROM artists artist 
    WHERE artist.artist_id = ANY(band_members)
  )
) 
WITH CHECK (
  -- User is the band creator (can update anything)
  band_creator = auth.uid()
  OR
  -- User is a band member (for updating consensus only)
  auth.uid() IN (
    SELECT artist.spotter_id 
    FROM artists artist 
    WHERE artist.artist_id = ANY(band_members)
  )
);

-- Verify the new policy
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'bands'
ORDER BY cmd, policyname;