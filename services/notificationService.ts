import { supabase } from '../lib/supabase';

export interface NotificationData {
  notification_type: string;
  notification_recipient: string;
  notification_sender?: string;
  notification_title: string;
  notification_message: string;
  notification_data?: any;
  is_read?: boolean;
  action_required?: boolean;
  expires_at?: string;
}

export interface Notification {
  notification_id: string;
  notification_sender: string | null;
  notification_title: string;
  notification_message: string;
  notification_data: any;
  is_read: boolean;
  action_required: boolean;
  expires_at: string | null;
  created_at: string;
  notification_recipient: string;
}

class NotificationService {
  // Create a new notification
  async createNotification(data: NotificationData): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      const { data: notification, error } = await supabase
        .from('notifications')
        .insert([{
          notification_type: data.notification_type,
          notification_recipient: data.notification_recipient,
          notification_sender: data.notification_sender || null,
          notification_title: data.notification_title,
          notification_message: data.notification_message,
          notification_data: data.notification_data || null,
          is_read: data.is_read || false,
          action_required: data.action_required || false,
          expires_at: data.expires_at || null,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating notification:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: notification };
    } catch (error: any) {
      console.error('Unexpected error creating notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Get notifications for a specific user
  async getNotificationsForUser(userId: string): Promise<{ success: boolean; error?: string; data?: Notification[] }> {
    try {
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('notification_recipient', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: notifications || [] };
    } catch (error: any) {
      console.error('Unexpected error fetching notifications:', error);
      return { success: false, error: error.message };
    }
  }

  // Get unread notification count for a user
  async getUnreadCount(userId: string): Promise<{ success: boolean; error?: string; count?: number }> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('notification_recipient', userId)
        .eq('is_read', false);

      if (error) {
        console.error('Error getting unread count:', error);
        return { success: false, error: error.message };
      }

      return { success: true, count: count || 0 };
    } catch (error: any) {
      console.error('Unexpected error getting unread count:', error);
      return { success: false, error: error.message };
    }
  }

  // Mark a notification as read
  async markAsRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('notification_id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Unexpected error marking notification as read:', error);
      return { success: false, error: error.message };
    }
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('notification_recipient', userId)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Unexpected error marking all notifications as read:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete a notification
  async deleteNotification(notificationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('notification_id', notificationId);

      if (error) {
        console.error('Error deleting notification:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Unexpected error deleting notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Subscribe to real-time notifications for a user
  subscribeToNotifications(userId: string, callback: (notification: any) => void) {
    console.log('📡 Setting up Supabase real-time subscription for user:', userId);
    
    // Test basic real-time connection first
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'notifications',
          filter: `notification_recipient=eq.${userId}`,
        },
        (payload) => {
          console.log('📡 Supabase real-time event received:', payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to notifications!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error - Real-time may not be enabled at PROJECT level in Supabase Settings → API');
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ Subscription timed out - check your internet connection');
        } else if (status === 'CLOSED') {
          console.error('🔒 Subscription closed - this usually means authentication or permission issues');
        }
      });
    
    return channel;
  }

  // Unsubscribe from notifications
  unsubscribeFromNotifications(channel: any) {
    if (channel) {
      supabase.removeChannel(channel);
    }
  }

  // Create a test notification for testing purposes
  async createTestNotification(recipientId: string, recipientName: string): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'general',
      notification_recipient: recipientId,
      notification_sender: recipientId, // Self-sent for testing
      notification_title: 'Test Notification',
      notification_message: `Hey ${recipientName}! Your notification table is working!`,
      notification_data: null,
      is_read: false,
      action_required: false,
    });
  }

  // Create band invitation notifications
  async createBandInvitationNotification(
    senderId: string,
    senderName: string,
    recipientId: string,
    recipientName: string,
    bandId: string,
    bandName: string
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'band_invitation',
      notification_recipient: recipientId,
      notification_sender: senderId,
      notification_title: 'Band Join Request',
      notification_message: `Artist ${senderName} has invited you ${recipientName} to join a band called ${bandName}.`,
      notification_data: { band_id: bandId, band_name: bandName },
      is_read: false,
      action_required: true,
    });
  }

  // Create band acceptance notification
  async createBandAcceptanceNotification(
    acceptingArtistId: string,
    acceptingArtistName: string,
    recipientArtistId: string,
    bandId: string,
    bandName: string
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'band_acceptance',
      notification_recipient: recipientArtistId,
      notification_sender: acceptingArtistId,
      notification_title: 'Band Member Accepted',
      notification_message: `${acceptingArtistName} has accepted the invitation to join ${bandName}.`,
      notification_data: { band_id: bandId, band_name: bandName },
      is_read: false,
      action_required: false,
    });
  }

  // Create band rejection notification
  async createBandRejectionNotification(
    rejectingArtistId: string,
    rejectingArtistName: string,
    recipientArtistId: string,
    bandId: string,
    bandName: string
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'band_rejection',
      notification_recipient: recipientArtistId,
      notification_sender: rejectingArtistId,
      notification_title: 'Band Member Declined',
      notification_message: `${rejectingArtistName} has declined the invitation to join ${bandName}.`,
      notification_data: { band_id: bandId, band_name: bandName },
      is_read: false,
      action_required: false,
    });
  }

  // Send band invitations to all members
  async sendBandInvitations(
    creatorId: string,
    creatorName: string,
    bandId: string,
    bandName: string,
    members: Array<{ artist_id: string; artist_name: string }>
  ): Promise<{ success: boolean; error?: string; results?: any[] }> {
    const results = [];
    
    for (const member of members) {
      // Skip the creator
      if (member.artist_id === creatorId) continue;
      
      const result = await this.createBandInvitationNotification(
        creatorId,
        creatorName,
        member.artist_id,
        member.artist_name,
        bandId,
        bandName
      );
      
      results.push({ member, result });
    }
    
    const allSuccess = results.every(r => r.result.success);
    return {
      success: allSuccess,
      error: allSuccess ? undefined : 'Some invitations failed to send',
      results
    };
  }

  // Create song request notification
  async createSongRequestNotification(
    uploaderId: string,
    uploaderName: string,
    recipientId: string,
    songId: string,
    songTitle: string,
    bandId: string,
    bandName: string,
    songFilePath?: string,
    songImage?: string
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'song_request',
      notification_recipient: recipientId,
      notification_sender: uploaderId,
      notification_title: 'Song Approval Request',
      notification_message: `${uploaderName} uploaded "${songTitle}" to ${bandName}. Your approval is needed before the song goes live.`,
      notification_data: { 
        song_id: songId,
        song_title: songTitle,
        band_id: bandId, 
        band_name: bandName,
        song_file: songFilePath,
        song_image: songImage
      },
      is_read: false,
      action_required: true,
    });
  }

  // Send song request notifications to all band members
  async sendSongRequestNotifications(
    uploaderId: string,
    uploaderName: string,
    songId: string,
    songTitle: string,
    bandId: string,
    bandName: string,
    bandMembers: string[],
    songFilePath?: string,
    songImage?: string
  ): Promise<{ success: boolean; error?: string; results?: any[] }> {
    const results = [];
    
    for (const memberId of bandMembers) {
      // Skip the uploader
      if (memberId === uploaderId) continue;
      
      const result = await this.createSongRequestNotification(
        uploaderId,
        uploaderName,
        memberId,
        songId,
        songTitle,
        bandId,
        bandName,
        songFilePath,
        songImage
      );
      
      results.push({ memberId, result });
    }
    
    const allSuccess = results.every(r => r.result.success);
    return {
      success: allSuccess,
      error: allSuccess ? undefined : 'Some song requests failed to send',
      results
    };
  }

  // Create song approval notification
  async createSongApprovalNotification(
    approverId: string,
    approverName: string,
    recipientId: string,
    songId: string,
    songTitle: string,
    bandId: string,
    bandName: string
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'song_approved',
      notification_recipient: recipientId,
      notification_sender: approverId,
      notification_title: 'Song Approved',
      notification_message: `${approverName} approved "${songTitle}" for ${bandName}.`,
      notification_data: { 
        song_id: songId,
        song_title: songTitle,
        band_id: bandId, 
        band_name: bandName 
      },
      is_read: false,
      action_required: false,
    });
  }

  // Create song rejection notification
  async createSongRejectionNotification(
    rejecterId: string,
    rejecterName: string,
    recipientId: string,
    songId: string,
    songTitle: string,
    bandId: string,
    bandName: string
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'song_rejected',
      notification_recipient: recipientId,
      notification_sender: rejecterId,
      notification_title: 'Song Not Approved',
      notification_message: `${rejecterName} did not approve "${songTitle}" for ${bandName}.`,
      notification_data: { 
        song_id: songId,
        song_title: songTitle,
        band_id: bandId, 
        band_name: bandName 
      },
      is_read: false,
      action_required: false,
    });
  }

  // Get user's full name (helper function)
  async getUserFullName(userId: string): Promise<string> {
    try {
      // Try auth user metadata first
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!authError && user && user.id === userId) {
        if (user.user_metadata?.full_name) {
          return user.user_metadata.full_name;
        }
        if (user.email) {
          return user.email.split('@')[0]; // Use email username as fallback
        }
      }

      // Try multiple table possibilities for user data
      const tableQueries = [
        { table: 'spotters', idField: 'id', nameFields: ['full_name', 'email'] },
        { table: 'artists', idField: 'artist_id', nameFields: ['full_name', 'artist_name'] },
        { table: 'venues', idField: 'venue_id', nameFields: ['full_name', 'venue_name'] },
        { table: 'users', idField: 'user_id', nameFields: ['full_name', 'name'] },
        { table: 'profiles', idField: 'user_id', nameFields: ['full_name', 'name'] },
      ];
      
      for (const query of tableQueries) {
        try {
          const { data, error } = await supabase
            .from(query.table)
            .select(query.nameFields.join(', '))
            .eq(query.idField, userId)
            .single();

          if (!error && data) {
            for (const field of query.nameFields) {
              if (data[field]) {
                return data[field];
              }
            }
          }
        } catch (e) {
          // Continue to next table if this one doesn't exist or doesn't have the user
          continue;
        }
      }

      // Fallback to user ID substring if no name found
      return `User ${userId.substring(0, 8)}`;
    } catch (error) {
      console.error('Error getting user full name:', error);
      return 'Unknown User';
    }
  }
}

export const notificationService = new NotificationService();