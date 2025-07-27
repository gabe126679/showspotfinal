-- Fix RLS policies for notifications table to allow band invitations
-- This script updates the policies to allow authenticated users to create notifications for other users

-- First, let's drop the existing insert policy that's too restrictive
DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;

-- Create a new insert policy that allows authenticated users to create notifications
-- This is needed for band invitations where the sender creates notifications for recipients
CREATE POLICY "Authenticated users can create notifications" 
ON notifications FOR INSERT 
TO authenticated 
WITH CHECK (
  -- Ensure the sender is authenticated
  auth.uid() IS NOT NULL
);

-- Update the select policy to ensure users can only see their own notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;

CREATE POLICY "Users can view their own notifications" 
ON notifications FOR SELECT 
TO authenticated 
USING (
  notification_recipient = auth.uid()
);

-- Update policy for users to update their own notifications (mark as read, etc.)
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

CREATE POLICY "Users can update their own notifications" 
ON notifications FOR UPDATE 
TO authenticated 
USING (
  notification_recipient = auth.uid()
)
WITH CHECK (
  notification_recipient = auth.uid()
);

-- Delete policy remains the same - users can only delete their own notifications
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

CREATE POLICY "Users can delete their own notifications" 
ON notifications FOR DELETE 
TO authenticated 
USING (
  notification_recipient = auth.uid()
);

-- Optional: Add a more specific policy for band-related notifications if you want extra security
-- This example shows how you could restrict band invitations to only band creators
/*
CREATE POLICY "Band creators can send band invitations" 
ON notifications FOR INSERT 
TO authenticated 
WITH CHECK (
  -- Only allow band_invitation type from authenticated users
  (notification_type = 'band_invitation' AND auth.uid() IS NOT NULL)
  OR
  -- Allow other notification types following different rules
  (notification_type != 'band_invitation' AND notification_recipient = auth.uid())
);
*/

-- Verify RLS is enabled on the notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated users
GRANT ALL ON notifications TO authenticated;
GRANT USAGE ON SEQUENCE notifications_notification_id_seq TO authenticated;