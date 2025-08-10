-- Enhanced search function that handles duplicate names by showing entity types
-- This helps users distinguish between spotters, artists, and venues with the same name

CREATE OR REPLACE FUNCTION search_messageable_entities(
  search_query TEXT,
  searcher_id UUID,
  searcher_type TEXT,
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
  -- Search spotters
  SELECT 
    s.id as entity_id,
    'spotter'::TEXT as entity_type,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM artists a WHERE LOWER(a.artist_name) = LOWER(s.full_name)
        UNION
        SELECT 1 FROM venues v WHERE LOWER(v.venue_name) = LOWER(s.full_name)
      ) THEN s.full_name || ' (Spotter)'
      ELSE s.full_name
    END as entity_name,
    s.spotter_profile_picture as entity_image,
    NULL as entity_location
  FROM spotters s
  WHERE 
    LOWER(s.full_name) LIKE LOWER('%' || search_query || '%') AND
    NOT (s.id = searcher_id AND searcher_type = 'spotter')
  
  UNION ALL
  
  -- Search artists
  SELECT 
    a.artist_id as entity_id,
    'artist'::TEXT as entity_type,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM spotters s WHERE LOWER(s.full_name) = LOWER(a.artist_name)
        UNION
        SELECT 1 FROM venues v WHERE LOWER(v.venue_name) = LOWER(a.artist_name)
      ) THEN a.artist_name || ' (Artist)'
      ELSE a.artist_name
    END as entity_name,
    a.artist_profile_image as entity_image,
    NULL as entity_location
  FROM artists a
  WHERE 
    LOWER(a.artist_name) LIKE LOWER('%' || search_query || '%') AND
    NOT (a.artist_id = searcher_id AND searcher_type = 'artist')
  
  UNION ALL
  
  -- Search venues
  SELECT 
    v.venue_id as entity_id,
    'venue'::TEXT as entity_type,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM spotters s WHERE LOWER(s.full_name) = LOWER(v.venue_name)
        UNION
        SELECT 1 FROM artists a WHERE LOWER(a.artist_name) = LOWER(v.venue_name)
      ) THEN v.venue_name || ' (Venue)'
      ELSE v.venue_name
    END as entity_name,
    v.venue_profile_image as entity_image,
    CASE 
      WHEN v.venue_address IS NOT NULL THEN 
        COALESCE(v.venue_address->>'address', 'Venue Location')
      ELSE NULL 
    END as entity_location
  FROM venues v
  WHERE 
    LOWER(v.venue_name) LIKE LOWER('%' || search_query || '%') AND
    NOT (v.venue_id = searcher_id AND searcher_type = 'venue')
  
  ORDER BY 
    -- Sort by entity type (column 2): spotters first, then artists, then venues  
    2,
    -- Then sort alphabetically by entity name (column 3)
    3
  LIMIT limit_count;
END;
$$;