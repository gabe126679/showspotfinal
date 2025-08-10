-- Fix messaging functions to use correct column names
-- This updates the functions to use 'full_name' and 'id' instead of 'spotter_name' and 'spotter_id'

-- 4. Function to get conversations for an entity (FIXED)
CREATE OR REPLACE FUNCTION get_entity_conversations(
  entity_id UUID,
  entity_type TEXT,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE(
  conversation_id TEXT,
  other_entity_id UUID,
  other_entity_type TEXT,
  other_entity_name TEXT,
  other_entity_image TEXT,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_message_sender_id UUID,
  unread_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH entity_conversations AS (
    SELECT DISTINCT
      CASE 
        WHEN sender_id = entity_id AND sender_type = entity_type 
        THEN recipient_id 
        ELSE sender_id 
      END as other_id,
      CASE 
        WHEN sender_id = entity_id AND sender_type = entity_type 
        THEN recipient_type 
        ELSE sender_type 
      END as other_type
    FROM messages
    WHERE (
      (sender_id = entity_id AND sender_type = entity_type AND is_deleted_by_sender = FALSE) OR
      (recipient_id = entity_id AND recipient_type = entity_type AND is_deleted_by_recipient = FALSE)
    )
  ),
  conversation_details AS (
    SELECT 
      ec.other_id,
      ec.other_type,
      (
        SELECT m.message_content
        FROM messages m
        WHERE (
          (m.sender_id = entity_id AND m.sender_type = entity_type AND 
           m.recipient_id = ec.other_id AND m.recipient_type = ec.other_type AND 
           m.is_deleted_by_sender = FALSE) OR
          (m.recipient_id = entity_id AND m.recipient_type = entity_type AND 
           m.sender_id = ec.other_id AND m.sender_type = ec.other_type AND 
           m.is_deleted_by_recipient = FALSE)
        )
        ORDER BY m.created_at DESC
        LIMIT 1
      ) as last_msg,
      (
        SELECT m.created_at
        FROM messages m
        WHERE (
          (m.sender_id = entity_id AND m.sender_type = entity_type AND 
           m.recipient_id = ec.other_id AND m.recipient_type = ec.other_type AND 
           m.is_deleted_by_sender = FALSE) OR
          (m.recipient_id = entity_id AND m.recipient_type = entity_type AND 
           m.sender_id = ec.other_id AND m.sender_type = ec.other_type AND 
           m.is_deleted_by_recipient = FALSE)
        )
        ORDER BY m.created_at DESC
        LIMIT 1
      ) as last_msg_time,
      (
        SELECT m.sender_id
        FROM messages m
        WHERE (
          (m.sender_id = entity_id AND m.sender_type = entity_type AND 
           m.recipient_id = ec.other_id AND m.recipient_type = ec.other_type AND 
           m.is_deleted_by_sender = FALSE) OR
          (m.recipient_id = entity_id AND m.recipient_type = entity_type AND 
           m.sender_id = ec.other_id AND m.sender_type = ec.other_type AND 
           m.is_deleted_by_recipient = FALSE)
        )
        ORDER BY m.created_at DESC
        LIMIT 1
      ) as last_sender_id,
      (
        SELECT COUNT(*)
        FROM messages m
        WHERE m.recipient_id = entity_id 
          AND m.recipient_type = entity_type
          AND m.sender_id = ec.other_id 
          AND m.sender_type = ec.other_type
          AND m.is_read = FALSE
          AND m.is_deleted_by_recipient = FALSE
      ) as unread_cnt
    FROM entity_conversations ec
  )
  SELECT 
    CONCAT(cd.other_id, '-', cd.other_type) as conversation_id,
    cd.other_id as other_entity_id,
    cd.other_type as other_entity_type,
    CASE 
      WHEN cd.other_type = 'spotter' THEN 
        (SELECT full_name FROM spotters WHERE id = cd.other_id)
      WHEN cd.other_type = 'artist' THEN 
        (SELECT artist_name FROM artists WHERE artist_id = cd.other_id)
      WHEN cd.other_type = 'venue' THEN 
        (SELECT venue_name FROM venues WHERE venue_id = cd.other_id)
    END as other_entity_name,
    CASE 
      WHEN cd.other_type = 'spotter' THEN 
        (SELECT spotter_profile_picture FROM spotters WHERE id = cd.other_id)
      WHEN cd.other_type = 'artist' THEN 
        (SELECT artist_profile_image FROM artists WHERE artist_id = cd.other_id)
      WHEN cd.other_type = 'venue' THEN 
        (SELECT venue_profile_image FROM venues WHERE venue_id = cd.other_id)
    END as other_entity_image,
    cd.last_msg as last_message,
    cd.last_msg_time as last_message_at,
    cd.last_sender_id as last_message_sender_id,
    cd.unread_cnt::INTEGER as unread_count
  FROM conversation_details cd
  WHERE cd.last_msg IS NOT NULL
  ORDER BY cd.last_msg_time DESC
  LIMIT limit_count;
END;
$$;

-- 5. Function to get messages in a conversation (FIXED)
CREATE OR REPLACE FUNCTION get_conversation_messages(
  entity_1_id UUID,
  entity_1_type TEXT,
  entity_2_id UUID,
  entity_2_type TEXT,
  limit_count INTEGER DEFAULT 100,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
  message_id UUID,
  sender_id UUID,
  sender_type TEXT,
  sender_name TEXT,
  sender_image TEXT,
  message_content TEXT,
  message_type TEXT,
  is_read BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  is_own_message BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.message_id,
    m.sender_id,
    m.sender_type,
    CASE 
      WHEN m.sender_type = 'spotter' THEN 
        (SELECT full_name FROM spotters WHERE id = m.sender_id)
      WHEN m.sender_type = 'artist' THEN 
        (SELECT artist_name FROM artists WHERE artist_id = m.sender_id)
      WHEN m.sender_type = 'venue' THEN 
        (SELECT venue_name FROM venues WHERE venue_id = m.sender_id)
    END as sender_name,
    CASE 
      WHEN m.sender_type = 'spotter' THEN 
        (SELECT spotter_profile_picture FROM spotters WHERE id = m.sender_id)
      WHEN m.sender_type = 'artist' THEN 
        (SELECT artist_profile_image FROM artists WHERE artist_id = m.sender_id)
      WHEN m.sender_type = 'venue' THEN 
        (SELECT venue_profile_image FROM venues WHERE venue_id = m.sender_id)
    END as sender_image,
    m.message_content,
    m.message_type,
    m.is_read,
    m.created_at,
    (m.sender_id = entity_1_id AND m.sender_type = entity_1_type) as is_own_message
  FROM messages m
  WHERE (
    (m.sender_id = entity_1_id AND m.sender_type = entity_1_type AND 
     m.recipient_id = entity_2_id AND m.recipient_type = entity_2_type AND 
     m.is_deleted_by_sender = FALSE) OR
    (m.sender_id = entity_2_id AND m.sender_type = entity_2_type AND 
     m.recipient_id = entity_1_id AND m.recipient_type = entity_1_type AND 
     m.is_deleted_by_recipient = FALSE)
  )
  ORDER BY m.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- 8. Function to search for entities to message (FIXED)
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
    s.full_name as entity_name,
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
    a.artist_name as entity_name,
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
    v.venue_name as entity_name,
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
  
  ORDER BY entity_name
  LIMIT limit_count;
END;
$$;