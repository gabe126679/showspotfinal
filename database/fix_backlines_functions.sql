-- Fix missing backlines functions
-- This file contains the essential functions for the backlines system

-- Function to get backlines for a show with vote counts
CREATE OR REPLACE FUNCTION get_show_backlines(
  show_id UUID,
  user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  backline_artist UUID,
  backline_artist_type TEXT,
  backline_status TEXT,
  vote_count INTEGER,
  user_has_voted BOOLEAN,
  backline_consensus JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show_id UUID := show_id;
  v_user_id UUID := user_id;
  current_backlines JSONB[];
  backline_obj JSONB;
  voters JSONB;
BEGIN
  -- Get current backlines
  SELECT show_backlines INTO current_backlines
  FROM shows 
  WHERE shows.show_id = v_show_id;

  IF current_backlines IS NULL THEN
    RETURN;
  END IF;

  -- Process each backline
  FOR i IN 1..array_length(current_backlines, 1) LOOP
    backline_obj := current_backlines[i];
    voters := backline_obj->'backline_voters';
    
    RETURN QUERY SELECT
      (backline_obj->>'backline_artist')::UUID,
      backline_obj->>'backline_artist_type',
      backline_obj->>'backline_status',
      jsonb_array_length(voters),
      CASE 
        WHEN v_user_id IS NULL THEN FALSE
        ELSE voters ? v_user_id::text
      END,
      backline_obj->'backline_consensus';
  END LOOP;
END;
$$;

-- Function to check if user has voted for a specific backline
CREATE OR REPLACE FUNCTION user_has_voted_backline(
  show_id UUID,
  backline_artist UUID,
  user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show_id UUID := show_id;
  v_backline_artist UUID := backline_artist;
  v_user_id UUID := user_id;
  current_backlines JSONB[];
  backline_obj JSONB;
BEGIN
  SELECT show_backlines INTO current_backlines
  FROM shows 
  WHERE shows.show_id = v_show_id;

  IF current_backlines IS NULL THEN
    RETURN FALSE;
  END IF;

  FOR i IN 1..array_length(current_backlines, 1) LOOP
    backline_obj := current_backlines[i];
    
    IF (backline_obj->>'backline_artist')::UUID = v_backline_artist THEN
      RETURN (backline_obj->'backline_voters') ? v_user_id::text;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$$;

-- Function to add a backline application to a show
CREATE OR REPLACE FUNCTION add_backline_application(
  show_id UUID,
  backline_artist UUID,
  backline_artist_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show_id UUID := show_id;
  v_backline_artist UUID := backline_artist;
  v_backline_artist_type TEXT := backline_artist_type;
  current_backlines JSONB[];
  new_backline JSONB;
  band_members JSONB[];
  consensus_array JSONB[];
  member_obj JSONB;
BEGIN
  -- Validate artist type
  IF v_backline_artist_type NOT IN ('artist', 'band') THEN
    RAISE EXCEPTION 'Backline artist type must be artist or band';
  END IF;

  -- Check if this artist/band has already applied to backline this show
  SELECT show_backlines INTO current_backlines
  FROM shows 
  WHERE shows.show_id = v_show_id;

  -- Check for existing application
  IF current_backlines IS NOT NULL THEN
    FOR i IN 1..array_length(current_backlines, 1) LOOP
      IF (current_backlines[i]->>'backline_artist')::UUID = v_backline_artist THEN
        RETURN FALSE; -- Already applied
      END IF;
    END LOOP;
  END IF;

  -- Get band members if applying as a band (for consensus)
  IF v_backline_artist_type = 'band' THEN
    SELECT array_agg(
      jsonb_build_object(
        'backline_band_member', band_member,
        'backline_decision', false
      )
    ) INTO consensus_array
    FROM unnest((
      SELECT band_members 
      FROM bands 
      WHERE band_id = v_backline_artist
    )) AS band_member;
  END IF;

  -- Create new backline object
  new_backline := jsonb_build_object(
    'backline_artist', v_backline_artist,
    'backline_artist_type', v_backline_artist_type,
    'backline_status', CASE 
      WHEN v_backline_artist_type = 'artist' THEN 'active'
      ELSE 'pending'
    END,
    'backline_consensus', CASE 
      WHEN v_backline_artist_type = 'artist' THEN NULL
      ELSE consensus_array
    END,
    'backline_voters', '[]'::JSONB
  );

  -- Add to show_backlines array
  UPDATE shows 
  SET show_backlines = COALESCE(show_backlines, '{}') || ARRAY[new_backline]
  WHERE shows.show_id = v_show_id;

  RETURN TRUE;
END;
$$;

-- Function to vote for a backline
CREATE OR REPLACE FUNCTION vote_for_backline(
  show_id UUID,
  backline_artist UUID,
  voter_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show_id UUID := show_id;
  v_backline_artist UUID := backline_artist;
  v_voter_id UUID := voter_id;
  current_backlines JSONB[];
  updated_backlines JSONB[];
  backline_obj JSONB;
  current_voters JSONB;
BEGIN
  -- Get current backlines
  SELECT show_backlines INTO current_backlines
  FROM shows 
  WHERE shows.show_id = v_show_id;

  IF current_backlines IS NULL THEN
    RETURN FALSE; -- No backlines exist
  END IF;

  -- Find and update the specific backline
  updated_backlines := '{}';
  
  FOR i IN 1..array_length(current_backlines, 1) LOOP
    backline_obj := current_backlines[i];
    
    IF (backline_obj->>'backline_artist')::UUID = v_backline_artist THEN
      -- Check if user already voted
      current_voters := backline_obj->'backline_voters';
      
      -- Check if voter already exists
      IF current_voters ? v_voter_id::text THEN
        RETURN FALSE; -- Already voted
      END IF;
      
      -- Add voter to the array
      backline_obj := jsonb_set(
        backline_obj,
        '{backline_voters}',
        current_voters || jsonb_build_array(v_voter_id::text)
      );
    END IF;
    
    updated_backlines := updated_backlines || ARRAY[backline_obj];
  END LOOP;

  -- Update the show
  UPDATE shows 
  SET show_backlines = updated_backlines
  WHERE shows.show_id = v_show_id;

  RETURN TRUE;
END;
$$;

-- Function to update band consensus for backline
CREATE OR REPLACE FUNCTION update_backline_consensus(
  show_id UUID,
  backline_artist UUID,
  band_member_id UUID,
  decision BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show_id UUID := show_id;
  v_backline_artist UUID := backline_artist;
  v_band_member_id UUID := band_member_id;
  v_decision BOOLEAN := decision;
  current_backlines JSONB[];
  updated_backlines JSONB[];
  backline_obj JSONB;
  consensus_array JSONB[];
  updated_consensus JSONB[];
  consensus_obj JSONB;
  all_agreed BOOLEAN := TRUE;
BEGIN
  -- Get current backlines
  SELECT show_backlines INTO current_backlines
  FROM shows 
  WHERE shows.show_id = v_show_id;

  IF current_backlines IS NULL THEN
    RETURN FALSE;
  END IF;

  updated_backlines := '{}';
  
  FOR i IN 1..array_length(current_backlines, 1) LOOP
    backline_obj := current_backlines[i];
    
    IF (backline_obj->>'backline_artist')::UUID = v_backline_artist THEN
      -- Update consensus for this band member
      consensus_array := ARRAY(SELECT jsonb_array_elements(backline_obj->'backline_consensus'));
      updated_consensus := '{}';
      
      FOR j IN 1..array_length(consensus_array, 1) LOOP
        consensus_obj := consensus_array[j];
        
        IF (consensus_obj->>'backline_band_member')::UUID = v_band_member_id THEN
          consensus_obj := jsonb_set(consensus_obj, '{backline_decision}', to_jsonb(v_decision));
        END IF;
        
        updated_consensus := updated_consensus || ARRAY[consensus_obj];
        
        -- Check if this member disagreed
        IF NOT (consensus_obj->>'backline_decision')::BOOLEAN THEN
          all_agreed := FALSE;
        END IF;
      END LOOP;
      
      -- Update the backline object
      backline_obj := jsonb_set(backline_obj, '{backline_consensus}', to_jsonb(updated_consensus));
      
      -- If all agreed, set status to active
      IF all_agreed THEN
        backline_obj := jsonb_set(backline_obj, '{backline_status}', '"active"');
      END IF;
    END IF;
    
    updated_backlines := updated_backlines || ARRAY[backline_obj];
  END LOOP;

  -- Update the show
  UPDATE shows 
  SET show_backlines = updated_backlines
  WHERE shows.show_id = v_show_id;

  RETURN TRUE;
END;
$$;