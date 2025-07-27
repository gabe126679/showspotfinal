// Quick test script to verify notification system
// This can be run manually to test the notification functionality

import { supabase } from './lib/supabase.ts';

async function testNotificationSystem() {
  console.log('🧪 Testing notification system...');
  
  try {
    // Get current user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      return;
    }
    
    if (!session?.user) {
      console.error('❌ No authenticated user found');
      return;
    }
    
    console.log('👤 Current user:', session.user.id);
    
    // Test creating a notification
    const testNotification = {
      notification_recipient: session.user.id,
      notification_sender: session.user.id,
      notification_title: 'Test Notification',
      notification_message: 'This is a test notification to verify the system works!',
      notification_data: { test: true },
      is_read: false,
      action_required: false,
    };
    
    console.log('📝 Creating test notification...');
    
    const { data, error } = await supabase
      .from('notifications')
      .insert([testNotification])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating notification:', error);
      return;
    }
    
    console.log('✅ Test notification created:', data);
    
    // Test fetching notifications
    console.log('📥 Fetching notifications...');
    
    const { data: notifications, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('notification_recipient', session.user.id)
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      console.error('❌ Error fetching notifications:', fetchError);
      return;
    }
    
    console.log('✅ Notifications fetched:', notifications);
    
    // Test marking as read
    if (data?.notification_id) {
      console.log('📖 Marking notification as read...');
      
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('notification_id', data.notification_id);
      
      if (updateError) {
        console.error('❌ Error marking as read:', updateError);
        return;
      }
      
      console.log('✅ Notification marked as read');
    }
    
    console.log('🎉 All tests passed! Notification system is working.');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Uncomment the line below to run the test
// testNotificationSystem();