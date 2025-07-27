-- Fix notification type check constraint to allow song_request
-- First, check what constraint exists

-- View current constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname LIKE '%notification_type%' 
  AND conrelid = 'notifications'::regclass;

-- Check current allowed values by looking at the constraint definition
SELECT 
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'notifications'
  AND tc.constraint_type = 'CHECK'
  AND tc.constraint_name LIKE '%notification_type%';

-- Drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;

-- Create new constraint that includes song_request
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

-- Verify the new constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'notifications_notification_type_check' 
  AND conrelid = 'notifications'::regclass;