-- Final Rating Functions with Proper Namespacing
-- Fixed all ambiguous column references

-- 1. Function to check if a user has rated a specific entity
CREATE OR REPLACE FUNCTION user_has_rated_entity(
  p_entity_id UUID,
  p_entity_type TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM individual_ratings ir
    WHERE ir.entity_id = p_entity_id 
    AND ir.entity_type = p_entity_type
    AND ir.rater_id = p_user_id
  );
END;
$$;

-- 2. Function to get the current rating for an entity
CREATE OR REPLACE FUNCTION get_entity_rating(
  p_entity_id UUID,
  p_entity_type TEXT
)
RETURNS TABLE(
  current_rating DECIMAL,
  total_raters INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(r.current_rating, 5.00) as current_rating,
    COALESCE(r.total_raters, 0) as total_raters
  FROM ratings r
  WHERE r.entity_id = p_entity_id 
  AND r.entity_type = p_entity_type;
  
  -- If no record exists, return default values
  IF NOT FOUND THEN
    RETURN QUERY SELECT 5.00::DECIMAL as current_rating, 0 as total_raters;
  END IF;
END;
$$;

-- 3. Function to get a user's rating for an entity
CREATE OR REPLACE FUNCTION get_user_rating(
  p_entity_id UUID,
  p_entity_type TEXT,
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_rating INTEGER;
BEGIN
  SELECT ir.rating_value
  INTO user_rating
  FROM individual_ratings ir
  WHERE ir.entity_id = p_entity_id 
  AND ir.entity_type = p_entity_type
  AND ir.rater_id = p_user_id;
  
  RETURN COALESCE(user_rating, 0);
END;
$$;

-- 4. Function to submit a rating (with duplicate prevention and average calculation)
CREATE OR REPLACE FUNCTION rate_entity(
  p_entity_id UUID,
  p_entity_type TEXT,
  p_user_id UUID,
  p_rating_value INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  already_rated BOOLEAN;
  new_average DECIMAL;
  new_count INTEGER;
BEGIN
  -- Validate rating value
  IF p_rating_value < 1 OR p_rating_value > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  -- Check if user has already rated this entity
  SELECT user_has_rated_entity(p_entity_id, p_entity_type, p_user_id)
  INTO already_rated;
  
  IF already_rated THEN
    RETURN FALSE; -- User has already rated
  END IF;

  -- Insert individual rating
  INSERT INTO individual_ratings (entity_id, entity_type, rater_id, rating_value)
  VALUES (p_entity_id, p_entity_type, p_user_id, p_rating_value);

  -- Calculate new average and count
  SELECT 
    AVG(ir.rating_value)::DECIMAL(3,2),
    COUNT(*)::INTEGER
  INTO new_average, new_count
  FROM individual_ratings ir
  WHERE ir.entity_id = p_entity_id 
  AND ir.entity_type = p_entity_type;

  -- Insert or update the ratings table
  INSERT INTO ratings (entity_id, entity_type, current_rating, total_raters)
  VALUES (p_entity_id, p_entity_type, new_average, new_count)
  ON CONFLICT (entity_id, entity_type)
  DO UPDATE SET
    current_rating = new_average,
    total_raters = new_count,
    updated_at = NOW();

  RETURN TRUE;
END;
$$;