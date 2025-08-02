-- Check current RLS policies on shows table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'shows'
ORDER BY policyname;

-- Check if RLS is enabled on shows table
SELECT schemaname, tablename, rowsecurity, forcerowsecurity
FROM pg_tables 
WHERE tablename = 'shows';

-- Create policy to allow show members (artists and band members) to update shows they're part of
CREATE POLICY "show_members_can_update_shows" ON shows
FOR UPDATE USING (
  -- Allow show promoter to update
  show_promoter = auth.uid()
  OR
  -- Allow artists who are show members to update
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(show_members) AS member
    WHERE (member->>'show_member_type' = 'artist' AND member->>'show_member_id' = ANY(
      SELECT artist_id::text FROM artists WHERE spotter_id = auth.uid()
    ))
  )
  OR
  -- Allow band members who are in show member consensus to update
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(show_members) AS member
    CROSS JOIN jsonb_array_elements(member->'show_member_consensus') AS consensus
    WHERE member->>'show_member_type' = 'band' 
    AND consensus->>'show_band_member_id' = ANY(
      SELECT artist_id::text FROM artists WHERE spotter_id = auth.uid()
    )
  )
  OR
  -- Allow venue owners to update
  show_venue IN (
    SELECT venue_id FROM venues WHERE spotter_id = auth.uid()
  )
)
WITH CHECK (
  -- Same conditions for WITH CHECK
  show_promoter = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(show_members) AS member
    WHERE (member->>'show_member_type' = 'artist' AND member->>'show_member_id' = ANY(
      SELECT artist_id::text FROM artists WHERE spotter_id = auth.uid()
    ))
  )
  OR
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(show_members) AS member
    CROSS JOIN jsonb_array_elements(member->'show_member_consensus') AS consensus
    WHERE member->>'show_member_type' = 'band' 
    AND consensus->>'show_band_member_id' = ANY(
      SELECT artist_id::text FROM artists WHERE spotter_id = auth.uid()
    )
  )
  OR
  show_venue IN (
    SELECT venue_id FROM venues WHERE spotter_id = auth.uid()
  )
);

-- Also create a policy for SELECT if it doesn't exist
CREATE POLICY "show_members_can_view_shows" ON shows
FOR SELECT USING (
  -- Allow show promoter to view
  show_promoter = auth.uid()
  OR
  -- Allow artists who are show members to view
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(show_members) AS member
    WHERE (member->>'show_member_type' = 'artist' AND member->>'show_member_id' = ANY(
      SELECT artist_id::text FROM artists WHERE spotter_id = auth.uid()
    ))
  )
  OR
  -- Allow band members who are in show member consensus to view
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(show_members) AS member
    CROSS JOIN jsonb_array_elements(member->'show_member_consensus') AS consensus
    WHERE member->>'show_member_type' = 'band' 
    AND consensus->>'show_band_member_id' = ANY(
      SELECT artist_id::text FROM artists WHERE spotter_id = auth.uid()
    )
  )
  OR
  -- Allow venue owners to view
  show_venue IN (
    SELECT venue_id FROM venues WHERE spotter_id = auth.uid()
  )
);

-- Enable RLS on shows table if not already enabled
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;

-- Verify the new policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'shows'
ORDER BY policyname;