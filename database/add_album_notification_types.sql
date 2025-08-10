-- Add album notification types to the notifications table check constraint
-- This script adds support for band album consensus notifications

-- First, drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

-- Add the updated constraint with all notification types including album types
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
  'venue_show_acceptance',
  'band_album_consensus',
  'album_approved',
  'album_rejected'
));

-- Add comment for documentation
COMMENT ON CONSTRAINT notifications_notification_type_check ON notifications IS 'Ensures notification_type is one of the allowed types including show and album notifications';

-- Verify the constraint was updated
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'notifications_notification_type_check' 
  AND conrelid = 'notifications'::regclass;