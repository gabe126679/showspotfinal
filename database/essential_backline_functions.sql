-- Essential backline functions for immediate functionality
-- Run this in your Supabase SQL Editor

-- Function to add a backline application to a show
CREATE OR REPLACE FUNCTION add_backline_application(
  show_id UUID,
  backline_artist UUID,
  backline_artist_type TEXT,
  requesting_member UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_show_id UUID := show_id;
  v_backline_artist UUID := backline_artist;
  v_backline_artist_type TEXT := backline_artist_type;
  v_requesting_member UUID := requesting_member;
  current_backlines JSONB;
  new_backline JSONB;
  consensus_array JSONB;
  i INTEGER;
BEGIN
  -- Validate artist type
  IF v_backline_artist_type NOT IN ('artist', 'band') THEN
    RAISE EXCEPTION 'Backline artist type must be artist or band';
  END IF;

  -- Get current backlines
  SELECT COALESCE(show_backlines, '[]'::jsonb) INTO current_backlines
  FROM shows 
  WHERE shows.show_id = v_show_id;

  -- Ensure it's a proper array
  IF jsonb_typeof(current_backlines) != 'array' THEN
    current_backlines := '[]'::jsonb;
  END IF;

  -- Check for existing application
  FOR i IN 0..(jsonb_array_length(current_backlines) - 1) LOOP
    IF (current_backlines->i->>'backline_artist')::UUID = v_backline_artist THEN
      RETURN FALSE; -- Already applied
    END IF;
  END LOOP;

  -- Get band members if applying as a band (for consensus)
  consensus_array := NULL;
  IF v_backline_artist_type = 'band' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'backline_band_member', band_member,
        'backline_decision', CASE 
          WHEN band_member::text = v_requesting_member::text THEN true
          ELSE false
        END
      )
    ) INTO consensus_array
    FROM (
      SELECT unnest(band_members) AS band_member
      FROM bands 
      WHERE band_id = v_backline_artist
    ) members;
  END IF;

  -- Create new backline object
  new_backline := jsonb_build_object(
    'backline_artist', v_backline_artist,
    'backline_artist_type', v_backline_artist_type,
    'backline_status', CASE 
      WHEN v_backline_artist_type = 'artist' THEN 'active'
      ELSE 'pending'
    END,
    'backline_consensus', consensus_array,
    'backline_voters', '[]'::JSONB,
    'backline_requester', COALESCE(v_requesting_member, v_backline_artist)
  );

  -- Add to show_backlines array
  UPDATE shows 
  SET show_backlines = current_backlines || new_backline
  WHERE shows.show_id = v_show_id;

  RETURN TRUE;
END;
$$;

-- Function to get show backlines
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
  current_backlines JSONB;
  backline_obj JSONB;
  voters JSONB;
  i INTEGER;
BEGIN
  -- Get current backlines as JSONB (not array)
  SELECT COALESCE(show_backlines, '[]'::jsonb) INTO current_backlines
  FROM shows 
  WHERE shows.show_id = v_show_id;

  -- Handle case where show doesn't exist
  IF current_backlines IS NULL THEN
    RETURN;
  END IF;

  -- Ensure it's a proper array
  IF jsonb_typeof(current_backlines) != 'array' THEN
    RETURN;
  END IF;

  -- Process each backline in the JSONB array
  FOR i IN 0..(jsonb_array_length(current_backlines) - 1) LOOP
    backline_obj := current_backlines->i;
    voters := COALESCE(backline_obj->'backline_voters', '[]'::jsonb);
    
    -- Ensure voters is an array
    IF jsonb_typeof(voters) != 'array' THEN
      voters := '[]'::jsonb;
    END IF;
    
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
  current_backlines JSONB;
  updated_backlines JSONB := '[]'::jsonb;
  backline_obj JSONB;
  consensus_array JSONB;
  updated_consensus JSONB := '[]'::jsonb;
  consensus_obj JSONB;
  all_agreed BOOLEAN := TRUE;
  i INTEGER;
  j INTEGER;
BEGIN
  -- Get current backlines
  SELECT COALESCE(show_backlines, '[]'::jsonb) INTO current_backlines
  FROM shows 
  WHERE shows.show_id = v_show_id;

  IF jsonb_typeof(current_backlines) != 'array' THEN
    RETURN FALSE;
  END IF;

  -- Process each backline
  FOR i IN 0..(jsonb_array_length(current_backlines) - 1) LOOP
    backline_obj := current_backlines->i;
    
    IF (backline_obj->>'backline_artist')::UUID = v_backline_artist THEN
      -- Update consensus for this band member
      consensus_array := COALESCE(backline_obj->'backline_consensus', '[]'::jsonb);
      updated_consensus := '[]'::jsonb;
      
      IF jsonb_typeof(consensus_array) = 'array' THEN
        FOR j IN 0..(jsonb_array_length(consensus_array) - 1) LOOP
          consensus_obj := consensus_array->j;
          
          IF (consensus_obj->>'backline_band_member')::UUID = v_band_member_id THEN
            consensus_obj := jsonb_set(consensus_obj, '{backline_decision}', to_jsonb(v_decision));
          END IF;
          
          updated_consensus := updated_consensus || consensus_obj;
          
          -- Check if this member disagreed
          IF NOT (consensus_obj->>'backline_decision')::BOOLEAN THEN
            all_agreed := FALSE;
          END IF;
        END LOOP;
      END IF;
      
      -- Update the backline object
      backline_obj := jsonb_set(backline_obj, '{backline_consensus}', updated_consensus);
      
      -- If all agreed, set status to active
      IF all_agreed THEN
        backline_obj := jsonb_set(backline_obj, '{backline_status}', '"active"');
      END IF;
    END IF;
    
    updated_backlines := updated_backlines || backline_obj;
  END LOOP;

  -- Update the show
  UPDATE shows 
  SET show_backlines = updated_backlines
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
  current_backlines JSONB;
  updated_backlines JSONB := '[]'::jsonb;
  backline_obj JSONB;
  current_voters JSONB;
  i INTEGER;
BEGIN
  -- Get current backlines
  SELECT COALESCE(show_backlines, '[]'::jsonb) INTO current_backlines
  FROM shows 
  WHERE shows.show_id = v_show_id;

  IF jsonb_typeof(current_backlines) != 'array' OR jsonb_array_length(current_backlines) = 0 THEN
    RETURN FALSE; -- No backlines exist
  END IF;

  -- Process each backline
  FOR i IN 0..(jsonb_array_length(current_backlines) - 1) LOOP
    backline_obj := current_backlines->i;
    
    IF (backline_obj->>'backline_artist')::UUID = v_backline_artist THEN
      -- Check if user already voted
      current_voters := COALESCE(backline_obj->'backline_voters', '[]'::jsonb);
      
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
    
    updated_backlines := updated_backlines || backline_obj;
  END LOOP;

  -- Update the show
  UPDATE shows 
  SET show_backlines = updated_backlines
  WHERE shows.show_id = v_show_id;

  RETURN TRUE;
END;
$$;