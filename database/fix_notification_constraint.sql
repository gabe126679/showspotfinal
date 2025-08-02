-- Check current notification types and constraint
SELECT DISTINCT notification_type, COUNT(*) as count
FROM notifications 
GROUP BY notification_type
ORDER BY notification_type;

-- Check existing constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'notifications_notification_type_check' 
  AND conrelid = 'notifications'::regclass;

-- Drop the existing constraint (use IF EXISTS to avoid error)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

-- Create the updated constraint with all notification types including show types
ALTER TABLE notifications 
ADD CONSTRAINT notifications_notification_type_check 
CHECK (notification_type IN (
    'general',
    'band_invitation',
    'band_acceptance', 
    'band_rejected',
    'band_activated',
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

-- Verify the new constraint is in place
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'notifications_notification_type_check' 
  AND conrelid = 'notifications'::regclass;