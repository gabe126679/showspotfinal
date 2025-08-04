-- FINAL WORKING Rating Functions
-- Using the actual constraint name from your database: ratings_entity_id_entity_type_key

-- Drop ALL existing functions first
DROP FUNCTION IF EXISTS user_has_rated_entity CASCADE;
DROP FUNCTION IF EXISTS get_entity_rating CASCADE;
DROP FUNCTION IF EXISTS get_user_rating CASCADE;
DROP FUNCTION IF EXISTS rate_entity CASCADE;

-- Clear any cached prepared statements
DISCARD ALL;

-- 1. Function to check if a user has rated a specific entity
CREATE FUNCTION user_has_rated_entity(
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
    FROM individual_ratings ir
    WHERE ir.entity_id = v_entity_id 
    AND ir.entity_type = v_entity_type
    AND ir.rater_id = v_user_id
  );
END;
$$;

-- 2. Function to get the current rating for an entity
CREATE FUNCTION get_entity_rating(
  entity_id UUID,
  entity_type TEXT
)
RETURNS TABLE(
  current_rating DECIMAL,
  total_raters INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entity_id UUID := entity_id;
  v_entity_type TEXT := entity_type;
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(r.current_rating, 5.00) as current_rating,
    COALESCE(r.total_raters, 0) as total_raters
  FROM ratings r
  WHERE r.entity_id = v_entity_id 
  AND r.entity_type = v_entity_type;
  
  -- If no record exists, return default values
  IF NOT FOUND THEN
    RETURN QUERY SELECT 5.00::DECIMAL as current_rating, 0 as total_raters;
  END IF;
END;
$$;

-- 3. Function to get a user's rating for an entity
CREATE FUNCTION get_user_rating(
  entity_id UUID,
  entity_type TEXT,
  user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entity_id UUID := entity_id;
  v_entity_type TEXT := entity_type;
  v_user_id UUID := user_id;
  user_rating INTEGER;
BEGIN
  SELECT ir.rating_value
  INTO user_rating
  FROM individual_ratings ir
  WHERE ir.entity_id = v_entity_id 
  AND ir.entity_type = v_entity_type
  AND ir.rater_id = v_user_id;
  
  RETURN COALESCE(user_rating, 0);
END;
$$;

-- 4. Function to submit a rating - FIXED WITH PROPER CONSTRAINT HANDLING
CREATE FUNCTION rate_entity(
  entity_id UUID,
  entity_type TEXT,
  rating_value INTEGER,
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
  v_rating_value INTEGER := rating_value;
  already_rated BOOLEAN;
  new_average DECIMAL;
  new_count INTEGER;
BEGIN
  -- Validate rating value
  IF v_rating_value < 1 OR v_rating_value > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  -- Check if user has already rated this entity
  SELECT user_has_rated_entity(v_entity_id, v_entity_type, v_user_id)
  INTO already_rated;
  
  IF already_rated THEN
    RETURN FALSE; -- User has already rated
  END IF;

  -- Insert individual rating
  INSERT INTO individual_ratings (entity_id, entity_type, rater_id, rating_value)
  VALUES (v_entity_id, v_entity_type, v_user_id, v_rating_value);

  -- Calculate new average and count
  SELECT 
    AVG(ir.rating_value)::DECIMAL(3,2),
    COUNT(*)::INTEGER
  INTO new_average, new_count
  FROM individual_ratings ir
  WHERE ir.entity_id = v_entity_id 
  AND ir.entity_type = v_entity_type;

  -- FIXED: Use the actual constraint name from your database
  INSERT INTO ratings (entity_id, entity_type, current_rating, total_raters)
  VALUES (v_entity_id, v_entity_type, new_average, new_count)
  ON CONFLICT ON CONSTRAINT ratings_entity_id_entity_type_key
  DO UPDATE SET
    current_rating = EXCLUDED.current_rating,
    total_raters = EXCLUDED.total_raters,
    updated_at = NOW();

  RETURN TRUE;
END;
$$;