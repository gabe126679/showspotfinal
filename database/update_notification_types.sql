-- Update notification_type check constraint to include show notification types
-- First, drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

-- Add the updated constraint with all notification types
ALTER TABLE notifications 
ADD CONSTRAINT notifications_notification_type_check 
CHECK (notification_type IN (
  'general',
  'band_invitation',
  'band_acceptance', 
  'band_rejection',
  'song_request',
  'song_approved',
  'song_rejected',
  'artist_show_invitation',
  'artist_show_acceptance',
  'band_member_show_invitation', 
  'band_show_acceptance',
  'venue_show_invitation',
  'venue_show_acceptance'
));

-- Add comment for documentation
COMMENT ON CONSTRAINT notifications_notification_type_check ON notifications IS 'Ensures notification_type is one of the allowed types including show notifications';