-- Restrict messaging to spotter-to-spotter only
-- This creates a new search function that only returns spotters

CREATE OR REPLACE FUNCTION search_messageable_spotters(
  search_query TEXT,
  searcher_id UUID,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE(
  entity_id UUID,
  entity_type TEXT,
  entity_name TEXT,
  entity_image TEXT,
  entity_location TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- Search spotters only
  SELECT 
    s.id as entity_id,
    'spotter'::TEXT as entity_type,
    s.full_name as entity_name,
    s.spotter_profile_picture as entity_image,
    NULL as entity_location
  FROM spotters s
  WHERE 
    LOWER(s.full_name) LIKE LOWER('%' || search_query || '%') AND
    s.id != searcher_id  -- Don't include self in search results
  ORDER BY 
    s.full_name
  LIMIT limit_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_messageable_spotters TO authenticated;