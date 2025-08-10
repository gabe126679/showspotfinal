-- Test if we can get messages directly from the messages table
-- to bypass the function and see if messages exist

SELECT 
  message_id,
  sender_id,
  sender_type,
  recipient_id,
  recipient_type,
  intended_sender_id,
  intended_sender_type,
  intended_recipient_id,
  intended_recipient_type,
  message_content,
  created_at
FROM messages 
ORDER BY created_at DESC 
LIMIT 10;