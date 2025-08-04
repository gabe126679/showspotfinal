-- Show Voting Functions
-- These functions handle show voting functionality with duplicate prevention

-- 1. Function to check if a user has voted for a specific show
CREATE OR REPLACE FUNCTION user_has_voted_for_show(
  show_id UUID,
  user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM shows 
    WHERE shows.show_id = user_has_voted_for_show.show_id 
    AND user_has_voted_for_show.user_id::text = ANY(shows.show_voters)
  );
END;
$$;

-- 2. Function to get the vote count for a show
CREATE OR REPLACE FUNCTION get_show_vote_count(
  show_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  vote_count INTEGER;
BEGIN
  SELECT COALESCE(array_length(show_voters, 1), 0)
  INTO vote_count
  FROM shows
  WHERE shows.show_id = get_show_vote_count.show_id;
  
  RETURN COALESCE(vote_count, 0);
END;
$$;

-- 3. Function to add a vote for a show (with duplicate prevention)
CREATE OR REPLACE FUNCTION add_show_vote(
  show_id UUID,
  user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  already_voted BOOLEAN;
BEGIN
  -- Check if user has already voted
  SELECT user_has_voted_for_show(add_show_vote.show_id, add_show_vote.user_id)
  INTO already_voted;
  
  -- If user hasn't voted, add their vote
  IF NOT already_voted THEN
    UPDATE shows 
    SET show_voters = COALESCE(show_voters, '{}') || ARRAY[add_show_vote.user_id::text]
    WHERE shows.show_id = add_show_vote.show_id;
    
    RETURN TRUE;
  END IF;
  
  -- User has already voted
  RETURN FALSE;
END;
$$;

-- 4. Function to get comprehensive vote info for a show
CREATE OR REPLACE FUNCTION get_show_vote_info(
  show_id UUID,
  user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  vote_count INTEGER,
  user_has_voted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    get_show_vote_count(get_show_vote_info.show_id) as vote_count,
    CASE 
      WHEN get_show_vote_info.user_id IS NULL THEN FALSE
      ELSE user_has_voted_for_show(get_show_vote_info.show_id, get_show_vote_info.user_id)
    END as user_has_voted;
END;
$$;