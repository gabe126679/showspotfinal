-- Update existing notification types to match expected values

-- Step 1: Show current notification types
SELECT DISTINCT notification_type, COUNT(*) as count
FROM notifications 
GROUP BY notification_type
ORDER BY notification_type;

-- Step 2: Update band_acceptance to band_accepted (correct naming)
UPDATE notifications 
SET notification_type = 'band_accepted'
WHERE notification_type = 'band_acceptance';

-- Step 3: Update general notifications - need to determine what these should be
-- Let's first see what these general notifications contain
SELECT notification_id, notification_title, notification_message, notification_data
FROM notifications 
WHERE notification_type = 'general'
LIMIT 5;

-- Step 4: Based on the content, update general notifications appropriately
-- For now, let's assume they should be band_invitation (you can adjust this)
UPDATE notifications 
SET notification_type = 'band_invitation'
WHERE notification_type = 'general';

-- Step 5: Verify the updates
SELECT DISTINCT notification_type, COUNT(*) as count
FROM notifications 
GROUP BY notification_type
ORDER BY notification_type;

-- Step 6: Now create the constraint with the correct types
ALTER TABLE notifications 
ADD CONSTRAINT notifications_notification_type_check 
CHECK (notification_type IN (
    'band_invitation',
    'band_accepted', 
    'band_rejected',
    'band_activated',
    'song_request',
    'song_approved',
    'song_rejected'
));

-- Step 7: Verify the constraint is in place
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'notifications_notification_type_check' 
  AND conrelid = 'notifications'::regclass;