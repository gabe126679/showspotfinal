-- Simple fix for get_conversation_messages function to work with current schema
-- This version works with the existing messages table structure

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
DECLARE
  v_entity_1_spotter_id UUID;
  v_entity_2_spotter_id UUID;
BEGIN
  -- Get spotter IDs for both entities
  CASE entity_1_type
    WHEN 'spotter' THEN
      v_entity_1_spotter_id := entity_1_id;
    WHEN 'artist' THEN
      SELECT a.spotter_id INTO v_entity_1_spotter_id
      FROM artists a
      WHERE a.artist_id = entity_1_id;
    WHEN 'venue' THEN
      SELECT v.spotter_id INTO v_entity_1_spotter_id
      FROM venues v
      WHERE v.venue_id = entity_1_id;
  END CASE;

  CASE entity_2_type
    WHEN 'spotter' THEN
      v_entity_2_spotter_id := entity_2_id;
    WHEN 'artist' THEN
      SELECT a.spotter_id INTO v_entity_2_spotter_id
      FROM artists a
      WHERE a.artist_id = entity_2_id;
    WHEN 'venue' THEN
      SELECT v.spotter_id INTO v_entity_2_spotter_id
      FROM venues v
      WHERE v.venue_id = entity_2_id;
  END CASE;

  -- Return messages between the two spotter accounts
  -- Always show spotter names and images regardless of original entity type
  RETURN QUERY
  SELECT 
    m.message_id,
    m.sender_id,
    'spotter'::TEXT as sender_type,
    (SELECT full_name FROM spotters WHERE id = m.sender_id) as sender_name,
    (SELECT spotter_profile_picture FROM spotters WHERE id = m.sender_id) as sender_image,
    m.message_content,
    m.message_type,
    m.is_read,
    m.created_at,
    (m.sender_id = v_entity_1_spotter_id) as is_own_message
  FROM messages m
  WHERE (
    -- Messages from entity_1 to entity_2
    (m.sender_id = v_entity_1_spotter_id AND m.recipient_id = v_entity_2_spotter_id) OR
    -- Messages from entity_2 to entity_1
    (m.sender_id = v_entity_2_spotter_id AND m.recipient_id = v_entity_1_spotter_id)
  )
  ORDER BY m.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;