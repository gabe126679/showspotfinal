-- Safely fix notification type constraint by checking existing data first

-- Step 1: Check what notification types currently exist in the table
SELECT DISTINCT notification_type, COUNT(*) as count
FROM notifications 
GROUP BY notification_type
ORDER BY notification_type;

-- Step 2: Show current constraint definition
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname LIKE '%notification_type%' 
  AND conrelid = 'notifications'::regclass;

-- Step 3: Drop the existing constraint (this allows us to see what's currently in the table)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

-- Step 4: Check for any invalid notification types that might exist
SELECT notification_type, COUNT(*) as count
FROM notifications 
WHERE notification_type NOT IN (
    'band_invitation',
    'band_accepted', 
    'band_rejected',
    'band_activated',
    'song_request',
    'song_approved',
    'song_rejected'
)
GROUP BY notification_type;

-- Step 5: Update any invalid notification types or delete them
-- (Uncomment the appropriate line below after seeing what exists)

-- Option A: Delete invalid notifications
-- DELETE FROM notifications 
-- WHERE notification_type NOT IN (
--     'band_invitation',
--     'band_accepted', 
--     'band_rejected',
--     'band_activated',
--     'song_request',
--     'song_approved',
--     'song_rejected'
-- );

-- Option B: Update specific invalid types (example)
-- UPDATE notifications SET notification_type = 'band_invitation' WHERE notification_type = 'some_invalid_type';

-- Step 6: Create the new constraint (run this after cleaning up invalid data)
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

-- Step 7: Verify the constraint is working
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'notifications_notification_type_check' 
  AND conrelid = 'notifications'::regclass;