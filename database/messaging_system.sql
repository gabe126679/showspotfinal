-- Messaging System
-- Allows any entity (spotter, artist, venue) to message any other entity

-- 1. Create messages table
CREATE TABLE IF NOT EXISTS messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('spotter', 'artist', 'venue')),
  recipient_id UUID NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('spotter', 'artist', 'venue')),
  message_content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'notification')),
  is_read BOOLEAN DEFAULT FALSE,
  is_deleted_by_sender BOOLEAN DEFAULT FALSE,
  is_deleted_by_recipient BOOLEAN DEFAULT FALSE,
  parent_message_id UUID REFERENCES messages(message_id), -- For message threads/replies
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Ensure sender and recipient are different
  CONSTRAINT check_not_self_message CHECK (
    NOT (sender_id = recipient_id AND sender_type = recipient_type)
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, sender_type);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, recipient_type);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(
  LEAST(sender_id, recipient_id), 
  GREATEST(sender_id, recipient_id),
  LEAST(sender_type, recipient_type),
  GREATEST(sender_type, recipient_type)
);

-- 2. Create conversations view for easier querying
CREATE OR REPLACE VIEW conversations AS
WITH message_pairs AS (
  SELECT 
    LEAST(m.sender_id, m.recipient_id) as entity_1_id,
    GREATEST(m.sender_id, m.recipient_id) as entity_2_id,
    CASE 
      WHEN m.sender_id < m.recipient_id THEN m.sender_type 
      ELSE m.recipient_type 
    END as entity_1_type,
    CASE 
      WHEN m.sender_id < m.recipient_id THEN m.recipient_type 
      ELSE m.sender_type 
    END as entity_2_type,
    MAX(m.created_at) as last_message_at,
    COUNT(*) FILTER (WHERE m.is_read = FALSE AND m.recipient_id = LEAST(m.sender_id, m.recipient_id)) as unread_count_1,
    COUNT(*) FILTER (WHERE m.is_read = FALSE AND m.recipient_id = GREATEST(m.sender_id, m.recipient_id)) as unread_count_2
  FROM messages m
  WHERE m.is_deleted_by_sender = FALSE 
    AND m.is_deleted_by_recipient = FALSE
  GROUP BY 
    LEAST(m.sender_id, m.recipient_id),
    GREATEST(m.sender_id, m.recipient_id),
    CASE WHEN m.sender_id < m.recipient_id THEN m.sender_type ELSE m.recipient_type END,
    CASE WHEN m.sender_id < m.recipient_id THEN m.recipient_type ELSE m.sender_type END
)
SELECT * FROM message_pairs;

-- 3. Function to send a message
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
  
  -- Insert message
  INSERT INTO messages (
    sender_id,
    sender_type,
    recipient_id,
    recipient_type,
    message_content,
    message_type
  ) VALUES (
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

-- 4. Function to get conversations for an entity
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
        (SELECT spotter_name FROM spotters WHERE spotter_id = cd.other_id)
      WHEN cd.other_type = 'artist' THEN 
        (SELECT artist_name FROM artists WHERE artist_id = cd.other_id)
      WHEN cd.other_type = 'venue' THEN 
        (SELECT venue_name FROM venues WHERE venue_id = cd.other_id)
    END as other_entity_name,
    CASE 
      WHEN cd.other_type = 'spotter' THEN 
        (SELECT spotter_profile_image FROM spotters WHERE spotter_id = cd.other_id)
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

-- 5. Function to get messages in a conversation
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
        (SELECT spotter_name FROM spotters WHERE spotter_id = m.sender_id)
      WHEN m.sender_type = 'artist' THEN 
        (SELECT artist_name FROM artists WHERE artist_id = m.sender_id)
      WHEN m.sender_type = 'venue' THEN 
        (SELECT venue_name FROM venues WHERE venue_id = m.sender_id)
    END as sender_name,
    CASE 
      WHEN m.sender_type = 'spotter' THEN 
        (SELECT spotter_profile_image FROM spotters WHERE spotter_id = m.sender_id)
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

-- 6. Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_as_read(
  reader_id UUID,
  reader_type TEXT,
  sender_id UUID,
  sender_type TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE messages
  SET 
    is_read = TRUE,
    read_at = NOW()
  WHERE 
    recipient_id = reader_id AND
    recipient_type = reader_type AND
    messages.sender_id = sender_id AND
    messages.sender_type = sender_type AND
    is_read = FALSE;
    
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count;
END;
$$;

-- 7. Function to get unread message count for an entity
CREATE OR REPLACE FUNCTION get_unread_message_count(
  entity_id UUID,
  entity_type TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM messages
  WHERE 
    recipient_id = entity_id AND
    recipient_type = entity_type AND
    is_read = FALSE AND
    is_deleted_by_recipient = FALSE;
    
  RETURN COALESCE(v_count, 0);
END;
$$;

-- 8. Function to search for entities to message
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
    s.spotter_id as entity_id,
    'spotter'::TEXT as entity_type,
    s.spotter_name as entity_name,
    s.spotter_profile_image as entity_image,
    s.spotter_location as entity_location
  FROM spotters s
  WHERE 
    LOWER(s.spotter_name) LIKE LOWER('%' || search_query || '%') AND
    NOT (s.spotter_id = searcher_id AND searcher_type = 'spotter')
  
  UNION ALL
  
  -- Search artists
  SELECT 
    a.artist_id as entity_id,
    'artist'::TEXT as entity_type,
    a.artist_name as entity_name,
    a.artist_profile_image as entity_image,
    a.artist_location as entity_location
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
    v.venue_location as entity_location
  FROM venues v
  WHERE 
    LOWER(v.venue_name) LIKE LOWER('%' || search_query || '%') AND
    NOT (v.venue_id = searcher_id AND searcher_type = 'venue')
  
  ORDER BY entity_name
  LIMIT limit_count;
END;
$$;