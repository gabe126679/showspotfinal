-- Fix the mark_messages_as_read function to avoid ambiguous column references
-- The issue is that the parameter names conflict with column names

-- Drop the existing function first
DROP FUNCTION IF EXISTS mark_messages_as_read(UUID, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION mark_messages_as_read(
  reader_id_param UUID,
  reader_type_param TEXT,
  sender_id_param UUID,
  sender_type_param TEXT
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
    recipient_id = reader_id_param AND
    recipient_type = reader_type_param AND
    sender_id = sender_id_param AND
    sender_type = sender_type_param AND
    is_read = FALSE;
    
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count;
END;
$$;