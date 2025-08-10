-- Fix message routing to ensure all messages go to spotter recipients
-- but maintain the original recipient type for display purposes

-- First, let's add columns to track both intended sender and recipient
ALTER TABLE messages ADD COLUMN IF NOT EXISTS intended_recipient_type TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS intended_recipient_id UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS intended_sender_type TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS intended_sender_id UUID;

-- Update existing messages to populate the new columns
UPDATE messages 
SET 
  intended_recipient_type = recipient_type,
  intended_recipient_id = recipient_id,
  intended_sender_type = sender_type,
  intended_sender_id = sender_id
WHERE intended_recipient_type IS NULL;

-- Create a function to convert artist/venue recipients to their spotter accounts
CREATE OR REPLACE FUNCTION get_spotter_for_entity(
  entity_id UUID,
  entity_type TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  spotter_id UUID;
BEGIN
  CASE entity_type
    WHEN 'spotter' THEN
      RETURN entity_id;
    WHEN 'artist' THEN
      SELECT a.spotter_id INTO spotter_id
      FROM artists a
      WHERE a.artist_id = entity_id;
      RETURN spotter_id;
    WHEN 'venue' THEN
      SELECT v.spotter_id INTO spotter_id
      FROM venues v
      WHERE v.venue_id = entity_id;
      RETURN spotter_id;
    ELSE
      RETURN NULL;
  END CASE;
END;
$$;

-- Updated send_message function that routes to spotter but preserves intent
CREATE OR REPLACE FUNCTION send_message(
  sender_id_param UUID,
  sender_type_param TEXT,
  recipient_id_param UUID,
  recipient_type_param TEXT,
  message_content_param TEXT,
  message_type_param TEXT DEFAULT 'text'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id UUID;
  v_actual_sender_id UUID;
  v_actual_recipient_id UUID;
BEGIN
  -- Validate entity types
  IF sender_type_param NOT IN ('spotter', 'artist', 'venue') THEN
    RAISE EXCEPTION 'Invalid sender type: %', sender_type_param;
  END IF;
  
  IF recipient_type_param NOT IN ('spotter', 'artist', 'venue') THEN
    RAISE EXCEPTION 'Invalid recipient type: %', recipient_type_param;
  END IF;
  
  -- Validate message content
  IF message_content_param IS NULL OR TRIM(message_content_param) = '' THEN
    RAISE EXCEPTION 'Message content cannot be empty';
  END IF;
  
  -- Get the actual spotter IDs for both sender and recipient
  SELECT get_spotter_for_entity(sender_id_param, sender_type_param) INTO v_actual_sender_id;
  SELECT get_spotter_for_entity(recipient_id_param, recipient_type_param) INTO v_actual_recipient_id;
  
  IF v_actual_sender_id IS NULL THEN
    RAISE EXCEPTION 'Could not find spotter for sender: % %', sender_type_param, sender_id_param;
  END IF;
  
  IF v_actual_recipient_id IS NULL THEN
    RAISE EXCEPTION 'Could not find spotter for recipient: % %', recipient_type_param, recipient_id_param;
  END IF;
  
  -- Insert message with actual spotters but preserve intended identities
  INSERT INTO messages (
    sender_id,
    sender_type,
    recipient_id,
    recipient_type,
    intended_sender_id,
    intended_sender_type,
    intended_recipient_id,
    intended_recipient_type,
    message_content,
    message_type
  ) VALUES (
    v_actual_sender_id,
    'spotter',
    v_actual_recipient_id,
    'spotter',
    sender_id_param,
    sender_type_param,
    recipient_id_param,
    recipient_type_param,
    TRIM(message_content_param),
    message_type_param
  ) RETURNING message_id INTO v_message_id;
  
  RETURN v_message_id;
END;
$$;

-- Updated get_entity_conversations to work with the new routing
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
  SELECT get_spotter_for_entity(entity_id, entity_type) INTO v_spotter_id;
  
  IF v_spotter_id IS NULL THEN
    RAISE EXCEPTION 'Could not find spotter for entity: % %', entity_type, entity_id;
  END IF;

  RETURN QUERY
  WITH entity_conversations AS (
    SELECT DISTINCT
      CASE 
        -- Messages sent by this entity (spotter sending on behalf of entity)
        WHEN sender_id = v_spotter_id AND sender_type = 'spotter' AND
             intended_sender_id = entity_id AND intended_sender_type = entity_type
        THEN intended_recipient_id
        -- Messages received by this entity (spotter receiving for entity)
        WHEN recipient_id = v_spotter_id AND recipient_type = 'spotter' AND
             intended_recipient_id = entity_id AND intended_recipient_type = entity_type
        THEN intended_sender_id
      END as other_id,
      CASE 
        -- Messages sent by this entity
        WHEN sender_id = v_spotter_id AND sender_type = 'spotter' AND
             intended_sender_id = entity_id AND intended_sender_type = entity_type
        THEN intended_recipient_type
        -- Messages received by this entity
        WHEN recipient_id = v_spotter_id AND recipient_type = 'spotter' AND
             intended_recipient_id = entity_id AND intended_recipient_type = entity_type
        THEN intended_sender_type
      END as other_type
    FROM messages
    WHERE 
      -- Messages TO this entity (received by spotter for this entity)
      (recipient_id = v_spotter_id AND recipient_type = 'spotter' AND 
       intended_recipient_id = entity_id AND intended_recipient_type = entity_type) OR
      -- Messages FROM this entity (sent by spotter on behalf of this entity)
      (sender_id = v_spotter_id AND sender_type = 'spotter' AND
       intended_sender_id = entity_id AND intended_sender_type = entity_type)
  ),
  conversation_details AS (
    SELECT 
      ec.other_id,
      ec.other_type,
      (
        SELECT m.message_content
        FROM messages m
        WHERE (
          -- Messages sent by this entity to the other entity
          (m.sender_id = v_spotter_id AND m.sender_type = 'spotter' AND 
           m.intended_sender_id = entity_id AND m.intended_sender_type = entity_type AND
           m.intended_recipient_id = ec.other_id AND m.intended_recipient_type = ec.other_type) OR
          -- Messages received by this entity from the other entity
          (m.recipient_id = v_spotter_id AND m.recipient_type = 'spotter' AND 
           m.intended_recipient_id = entity_id AND m.intended_recipient_type = entity_type AND
           m.intended_sender_id = ec.other_id AND m.intended_sender_type = ec.other_type)
        )
        ORDER BY m.created_at DESC
        LIMIT 1
      ) as last_msg,
      (
        SELECT m.created_at
        FROM messages m
        WHERE (
          (m.sender_id = v_spotter_id AND m.sender_type = 'spotter' AND 
           m.intended_sender_id = entity_id AND m.intended_sender_type = entity_type AND
           m.intended_recipient_id = ec.other_id AND m.intended_recipient_type = ec.other_type) OR
          (m.recipient_id = v_spotter_id AND m.recipient_type = 'spotter' AND 
           m.intended_recipient_id = entity_id AND m.intended_recipient_type = entity_type AND
           m.intended_sender_id = ec.other_id AND m.intended_sender_type = ec.other_type)
        )
        ORDER BY m.created_at DESC
        LIMIT 1
      ) as last_msg_time,
      (
        SELECT m.intended_sender_id
        FROM messages m
        WHERE (
          (m.sender_id = v_spotter_id AND m.sender_type = 'spotter' AND 
           m.intended_sender_id = entity_id AND m.intended_sender_type = entity_type AND
           m.intended_recipient_id = ec.other_id AND m.intended_recipient_type = ec.other_type) OR
          (m.recipient_id = v_spotter_id AND m.recipient_type = 'spotter' AND 
           m.intended_recipient_id = entity_id AND m.intended_recipient_type = entity_type AND
           m.intended_sender_id = ec.other_id AND m.intended_sender_type = ec.other_type)
        )
        ORDER BY m.created_at DESC
        LIMIT 1
      ) as last_sender_id,
      (
        SELECT COUNT(*)
        FROM messages m
        WHERE m.recipient_id = v_spotter_id 
          AND m.recipient_type = 'spotter'
          AND m.intended_recipient_id = entity_id
          AND m.intended_recipient_type = entity_type
          AND m.intended_sender_id = ec.other_id
          AND m.intended_sender_type = ec.other_type
          AND m.is_read = FALSE
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

-- Updated get_conversation_messages to work with new routing
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
  SELECT get_spotter_for_entity(entity_1_id, entity_1_type) INTO v_entity_1_spotter_id;
  SELECT get_spotter_for_entity(entity_2_id, entity_2_type) INTO v_entity_2_spotter_id;
  
  RETURN QUERY
  SELECT 
    m.message_id,
    m.intended_sender_id as sender_id,
    m.intended_sender_type as sender_type,
    CASE 
      WHEN m.intended_sender_type = 'spotter' THEN 
        (SELECT full_name FROM spotters WHERE id = m.intended_sender_id)
      WHEN m.intended_sender_type = 'artist' THEN 
        (SELECT artist_name FROM artists WHERE artist_id = m.intended_sender_id)
      WHEN m.intended_sender_type = 'venue' THEN 
        (SELECT venue_name FROM venues WHERE venue_id = m.intended_sender_id)
    END as sender_name,
    CASE 
      WHEN m.intended_sender_type = 'spotter' THEN 
        (SELECT spotter_profile_picture FROM spotters WHERE id = m.intended_sender_id)
      WHEN m.intended_sender_type = 'artist' THEN 
        (SELECT artist_profile_image FROM artists WHERE artist_id = m.intended_sender_id)
      WHEN m.intended_sender_type = 'venue' THEN 
        (SELECT venue_profile_image FROM venues WHERE venue_id = m.intended_sender_id)
    END as sender_image,
    m.message_content,
    m.message_type,
    m.is_read,
    m.created_at,
    (m.intended_sender_id = entity_1_id AND m.intended_sender_type = entity_1_type) as is_own_message
  FROM messages m
  WHERE (
    -- Messages from entity_1 to entity_2 (sent by entity_1's spotter on behalf of entity_1)
    (m.sender_id = v_entity_1_spotter_id AND m.sender_type = 'spotter' AND 
     m.intended_sender_id = entity_1_id AND m.intended_sender_type = entity_1_type AND
     m.recipient_id = v_entity_2_spotter_id AND m.recipient_type = 'spotter' AND
     m.intended_recipient_id = entity_2_id AND m.intended_recipient_type = entity_2_type) OR
    -- Messages from entity_2 to entity_1 (sent by entity_2's spotter on behalf of entity_2)
    (m.sender_id = v_entity_2_spotter_id AND m.sender_type = 'spotter' AND 
     m.intended_sender_id = entity_2_id AND m.intended_sender_type = entity_2_type AND
     m.recipient_id = v_entity_1_spotter_id AND m.recipient_type = 'spotter' AND
     m.intended_recipient_id = entity_1_id AND m.intended_recipient_type = entity_1_type)
  )
  ORDER BY m.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;