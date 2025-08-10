-- Update get_entity_conversations to always show spotter names in conversation list
-- This ensures consistency between conversation list and chat view

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
DECLARE
  v_spotter_id UUID;
BEGIN
  -- Get the spotter ID for this entity
  CASE entity_type
    WHEN 'spotter' THEN
      v_spotter_id := entity_id;
    WHEN 'artist' THEN
      SELECT a.spotter_id INTO v_spotter_id
      FROM artists a
      WHERE a.artist_id = entity_id;
    WHEN 'venue' THEN
      SELECT v.spotter_id INTO v_spotter_id
      FROM venues v
      WHERE v.venue_id = entity_id;
  END CASE;
  
  IF v_spotter_id IS NULL THEN
    RAISE EXCEPTION 'Could not find spotter for entity: % %', entity_type, entity_id;
  END IF;

  RETURN QUERY
  WITH entity_conversations AS (
    SELECT DISTINCT
      CASE 
        WHEN m.sender_id = v_spotter_id THEN m.recipient_id
        WHEN m.recipient_id = v_spotter_id THEN m.sender_id
      END as other_spotter_id
    FROM messages m
    WHERE 
      (m.sender_id = v_spotter_id OR m.recipient_id = v_spotter_id)
  ),
  conversation_details AS (
    SELECT 
      ec.other_spotter_id,
      (
        SELECT m.message_content
        FROM messages m
        WHERE (
          (m.sender_id = v_spotter_id AND m.recipient_id = ec.other_spotter_id) OR
          (m.sender_id = ec.other_spotter_id AND m.recipient_id = v_spotter_id)
        )
        ORDER BY m.created_at DESC
        LIMIT 1
      ) as last_msg,
      (
        SELECT m.created_at
        FROM messages m
        WHERE (
          (m.sender_id = v_spotter_id AND m.recipient_id = ec.other_spotter_id) OR
          (m.sender_id = ec.other_spotter_id AND m.recipient_id = v_spotter_id)
        )
        ORDER BY m.created_at DESC
        LIMIT 1
      ) as last_msg_time,
      (
        SELECT m.sender_id
        FROM messages m
        WHERE (
          (m.sender_id = v_spotter_id AND m.recipient_id = ec.other_spotter_id) OR
          (m.sender_id = ec.other_spotter_id AND m.recipient_id = v_spotter_id)
        )
        ORDER BY m.created_at DESC
        LIMIT 1
      ) as last_sender_id,
      (
        SELECT COUNT(*)
        FROM messages m
        WHERE m.recipient_id = v_spotter_id 
          AND m.sender_id = ec.other_spotter_id
          AND m.is_read = FALSE
      ) as unread_cnt
    FROM entity_conversations ec
    WHERE ec.other_spotter_id IS NOT NULL
  )
  SELECT 
    cd.other_spotter_id::TEXT as conversation_id,
    cd.other_spotter_id as other_entity_id,
    'spotter'::TEXT as other_entity_type,
    (SELECT full_name FROM spotters WHERE id = cd.other_spotter_id) as other_entity_name,
    (SELECT spotter_profile_picture FROM spotters WHERE id = cd.other_spotter_id) as other_entity_image,
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