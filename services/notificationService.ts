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

  // Create artist show invitation notification
  async createArtistShowInvitationNotification(
    promoterId: string,
    promoterName: string,
    recipientId: string,
    showId: string,
    showData: any
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'artist_show_invitation',
      notification_recipient: recipientId,
      notification_sender: promoterId,
      notification_title: 'Show Invitation',
      notification_message: `${promoterName} has promoted you as a performer in a show! Click below to view the show bill:`,
      notification_data: {
        show_id: showId,
        venue_name: showData.venue_name,
        preferred_date: showData.preferred_date,
        preferred_time: showData.preferred_time,
        show_members: showData.show_members,
        member_position: showData.member_position
      },
      is_read: false,
      action_required: true,
    });
  }

  // Create band member show invitation notification
  async createBandMemberShowInvitationNotification(
    promoterId: string,
    promoterName: string,
    recipientId: string,
    bandName: string,
    showId: string,
    showData: any
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'band_member_show_invitation',
      notification_recipient: recipientId,
      notification_sender: promoterId,
      notification_title: 'Show Invitation',
      notification_message: `${promoterName} has promoted your band ${bandName} as a performer in a show! Click below to view the show bill:`,
      notification_data: {
        show_id: showId,
        band_name: bandName,
        venue_name: showData.venue_name,
        preferred_date: showData.preferred_date,
        preferred_time: showData.preferred_time,
        show_members: showData.show_members,
        member_position: showData.member_position
      },
      is_read: false,
      action_required: true,
    });
  }

  // Create artist show acceptance notification
  async createArtistShowAcceptanceNotification(
    acceptingArtistId: string,
    acceptingArtistName: string,
    recipientId: string,
    showId: string,
    showData: any
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'artist_show_acceptance',
      notification_recipient: recipientId,
      notification_sender: acceptingArtistId,
      notification_title: 'Artist Show Acceptance',
      notification_message: `${acceptingArtistName} has accepted an invitation to a show! Click below to view the show bill:`,
      notification_data: {
        show_id: showId,
        venue_name: showData.venue_name,
        preferred_date: showData.preferred_date,
        preferred_time: showData.preferred_time
      },
      is_read: false,
      action_required: false,
    });
  }

  // Create band show acceptance notification
  async createBandShowAcceptanceNotification(
    promoterId: string,
    bandName: string,
    recipientId: string,
    showId: string,
    showData: any
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'band_show_acceptance',
      notification_recipient: recipientId,
      notification_sender: promoterId,
      notification_title: 'Band Show Acceptance',
      notification_message: `${bandName} have accepted an invitation to a show! Click below to view the show bill:`,
      notification_data: {
        show_id: showId,
        band_name: bandName,
        venue_name: showData.venue_name,
        preferred_date: showData.preferred_date,
        preferred_time: showData.preferred_time
      },
      is_read: false,
      action_required: false,
    });
  }

  // Create venue show invitation notification
  async createVenueShowInvitationNotification(
    promoterId: string,
    promoterName: string,
    venueSpotterId: string,
    venueName: string,
    showId: string,
    showData: any
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'venue_show_invitation',
      notification_recipient: venueSpotterId,
      notification_sender: promoterId,
      notification_title: 'Show Invitation',
      notification_message: `${promoterName} has promoted you to host a show! Click below to view the show bill:`,
      notification_data: {
        show_id: showId,
        venue_name: venueName,
        venue_id: showData.venue_id,
        preferred_date: showData.preferred_date,
        preferred_time: showData.preferred_time,
        show_members: showData.show_members
      },
      is_read: false,
      action_required: true,
    });
  }

  // Create venue show acceptance notification
  async createVenueShowAcceptanceNotification(
    venueId: string,
    venueName: string,
    recipientId: string,
    showId: string,
    showData: any
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'venue_show_acceptance',
      notification_recipient: recipientId,
      notification_sender: venueId,
      notification_title: 'Venue Show Acceptance',
      notification_message: `${venueName} has accepted an invitation to a show! Click below to view the show bill:`,
      notification_data: {
        show_id: showId,
        venue_name: venueName,
        final_date: showData.final_date,
        final_time: showData.final_time,
        ticket_price: showData.ticket_price,
        venue_percentage: showData.venue_percentage,
        artist_percentage: showData.artist_percentage
      },
      is_read: false,
      action_required: false,
    });
  }

  // Send all show invitations after show creation
  async sendShowInvitations(
    showId: string,
    promoterId: string,
    promoterName: string,
    showMembers: any[],
    venueId: string,
    venueName: string,
    venueSpotterId: string,
    showData: any
  ): Promise<{ success: boolean; error?: string; results?: any[] }> {
    const results = [];

    // Send invitations to all show members
    for (const member of showMembers) {
      if (member.show_member_type === 'artist') {
        // Send artist invitation
        const result = await this.createArtistShowInvitationNotification(
          promoterId,
          promoterName,
          member.show_member_id,
          showId,
          {
            ...showData,
            member_position: member.show_member_position
          }
        );
        results.push({ member, result });
      } else if (member.show_member_type === 'band' && member.show_member_consensus) {
        // Send band member invitations
        for (const bandMember of member.show_member_consensus) {
          const result = await this.createBandMemberShowInvitationNotification(
            promoterId,
            promoterName,
            bandMember.show_band_member_id,
            member.show_member_name,
            showId,
            {
              ...showData,
              member_position: member.show_member_position
            }
          );
          results.push({ bandMember, result });
        }
      }
    }

    // Send venue invitation
    const venueResult = await this.createVenueShowInvitationNotification(
      promoterId,
      promoterName,
      venueSpotterId,
      venueName,
      showId,
      {
        ...showData,
        venue_id: venueId
      }
    );
    results.push({ venue: { venueId, venueName }, result: venueResult });

    const allSuccess = results.every(r => r.result.success);
    return {
      success: allSuccess,
      error: allSuccess ? undefined : 'Some invitations failed to send',
      results
    };
  }

  // Send notification (simplified method for venue acceptance wizard)
  async sendNotification(
    recipientId: string,
    type: string,
    data: any
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    let title = '';
    let message = '';
    
    switch (type) {
      case 'venue_acceptance':
      case 'venue_show_acceptance':
        title = 'Show Confirmed!';
        message = `${data.venue_name} has confirmed your show for ${data.show_date} at ${data.show_time}. Your guarantee is $${data.artist_guarantee?.toFixed(2)} if sold out. Tap to view show bill.`;
        break;
      default:
        title = 'Notification';
        message = 'You have a new notification.';
    }

    return this.createNotification({
      notification_type: type,
      notification_recipient: recipientId,
      notification_sender: null,
      notification_title: title,
      notification_message: message,
      notification_data: data,
      is_read: false,
      action_required: false,
    });
  }

  // Check if show should be activated and update status
  async checkAndActivateShow(showId: string): Promise<{ activated: boolean; error?: string }> {
    try {
      console.log('🎭 Checking if show should be activated:', showId);
      
      // Get current show data
      const { data: show, error: showError } = await supabase
        .from('shows')
        .select('*')
        .eq('show_id', showId)
        .single();

      if (showError || !show) {
        console.error('❌ Error fetching show for activation check:', showError);
        return { activated: false, error: 'Failed to fetch show data' };
      }

      // Check if venue has accepted
      if (!show.venue_decision) {
        console.log('⏳ Venue has not accepted yet');
        return { activated: false };
      }

      // Check if all show members have accepted
      let allMembersAccepted = true;
      const pendingMembers: string[] = [];

      for (const member of show.show_members || []) {
        if (member.show_member_type === 'artist') {
          if (!member.show_member_decision) {
            allMembersAccepted = false;
            pendingMembers.push(member.show_member_name || 'Artist');
          }
        } else if (member.show_member_type === 'band') {
          if (!member.show_member_decision) {
            allMembersAccepted = false;
            pendingMembers.push(member.show_member_name || 'Band');
          }
        }
      }

      console.log('🎭 All members accepted:', allMembersAccepted);
      if (pendingMembers.length > 0) {
        console.log('⏳ Still pending:', pendingMembers);
      }

      // If show is already active, no need to update
      if (show.show_status === 'active') {
        console.log('✅ Show is already active');
        return { activated: false };
      }

      // If all conditions are met, activate the show
      if (allMembersAccepted && show.venue_decision) {
        console.log('🎉 Activating show!');
        
        const { error: updateError } = await supabase
          .from('shows')
          .update({ show_status: 'active' })
          .eq('show_id', showId);

        if (updateError) {
          console.error('❌ Error activating show:', updateError);
          return { activated: false, error: 'Failed to update show status' };
        }

        // Send show_activated notifications
        await this.sendShowActivatedNotifications(show);
        
        return { activated: true };
      }

      return { activated: false };
    } catch (error: any) {
      console.error('❌ Error in checkAndActivateShow:', error);
      return { activated: false, error: error.message };
    }
  }

  // Send show activated notifications to all participants
  async sendShowActivatedNotifications(showData: any): Promise<void> {
    try {
      console.log('📢 Sending show activated notifications');
      
      const notifications = [];

      // Notify all show members
      for (const member of showData.show_members || []) {
        if (member.show_member_type === 'artist') {
          notifications.push(
            this.createNotification({
              notification_type: 'general',
              notification_recipient: member.show_member_id,
              notification_sender: null,
              notification_title: 'Show is Now Active!',
              notification_message: `Great news! The show at ${showData.venue_name || 'venue'} is now confirmed and active. All performers and venue have accepted!`,
              notification_data: {
                show_id: showData.show_id,
                venue_name: showData.venue_name,
                show_date: showData.show_date || showData.show_preferred_date,
                show_time: showData.show_time || showData.show_preferred_time,
                notification_subtype: 'show_activated'
              },
              is_read: false,
              action_required: false,
            })
          );
        } else if (member.show_member_type === 'band' && member.show_member_consensus) {
          // Notify all band members
          for (const bandMember of member.show_member_consensus) {
            notifications.push(
              this.createNotification({
                notification_type: 'general',
                notification_recipient: bandMember.show_band_member_id,
                notification_sender: null,
                notification_title: 'Show is Now Active!',
                notification_message: `Great news! The show at ${showData.venue_name || 'venue'} is now confirmed and active. All performers and venue have accepted!`,
                notification_data: {
                  show_id: showData.show_id,
                  venue_name: showData.venue_name,
                  show_date: showData.show_date || showData.show_preferred_date,
                  show_time: showData.show_time || showData.show_preferred_time,
                  notification_subtype: 'show_activated'
                },
                is_read: false,
                action_required: false,
              })
            );
          }
        }
      }

      // Notify venue
      if (showData.show_venue) {
        // Get venue spotter ID
        const { data: venue } = await supabase
          .from('venues')
          .select('spotter_id')
          .eq('venue_id', showData.show_venue)
          .single();

        if (venue?.spotter_id) {
          notifications.push(
            this.createNotification({
              notification_type: 'general',
              notification_recipient: venue.spotter_id,
              notification_sender: null,
              notification_title: 'Show is Now Active!',
              notification_message: `Great news! Your show is now confirmed and active. All performers have accepted!`,
              notification_data: {
                show_id: showData.show_id,
                venue_name: showData.venue_name,
                show_date: showData.show_date || showData.show_preferred_date,
                show_time: showData.show_time || showData.show_preferred_time,
                notification_subtype: 'show_activated'
              },
              is_read: false,
              action_required: false,
            })
          );
        }
      }

      // Notify promoter
      notifications.push(
        this.createNotification({
          notification_type: 'general',
          notification_recipient: showData.show_promoter,
          notification_sender: null,
          notification_title: 'Show is Now Active!',
          notification_message: `Congratulations! Your promoted show is now confirmed and active. All performers and venue have accepted!`,
          notification_data: {
            show_id: showData.show_id,
            venue_name: showData.venue_name,
            show_date: showData.show_date || showData.show_preferred_date,
            show_time: showData.show_time || showData.show_preferred_time,
            notification_subtype: 'show_activated'
          },
          is_read: false,
          action_required: false,
        })
      );

      // Send all notifications
      await Promise.all(notifications);
      console.log('✅ Show activated notifications sent');
      
    } catch (error) {
      console.error('❌ Error sending show activated notifications:', error);
    }
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

  // ===== ALBUM CONSENSUS NOTIFICATIONS =====

  // Create band album consensus notification for all band members
  async createBandAlbumConsensusNotification(
    uploaderId: string,
    uploaderName: string,
    bandId: string,
    bandName: string,
    albumId: string,
    albumTitle: string,
    albumData: any
  ): Promise<{ success: boolean; error?: string; notifications: any[] }> {
    try {
      // Get band members
      const { data: bandData, error: bandError } = await supabase
        .from('bands')
        .select('band_members')
        .eq('band_id', bandId)
        .single();

      if (bandError) {
        throw new Error(`Failed to fetch band members: ${bandError.message}`);
      }

      // Get artist IDs from band_members and find their spotter_ids
      const notifications: any[] = [];
      const results: any[] = [];

      for (const artistId of (bandData.band_members || [])) {
        // Don't notify the uploader (uploaderId is the artist_id of the uploader)
        if (artistId === uploaderId) {
          continue; // Skip the uploader
        }
        
        const { data: artistData } = await supabase
          .from('artists')
          .select('spotter_id, artist_name')
          .eq('artist_id', artistId)
          .single();

        if (artistData) {
          const result = await this.createBandAlbumInvitationNotification(
            uploaderId,
            uploaderName,
            artistData.spotter_id,
            artistData.artist_name,
            bandName,
            albumId,
            albumTitle,
            albumData,
            artistId // Pass the artist_id for consensus updates
          );
          results.push({ artistId, artistName: artistData.artist_name, result });
        }
      }

      const allSuccess = results.every(r => r.result.success);

      return {
        success: allSuccess,
        error: allSuccess ? undefined : 'Some notifications failed to send',
        notifications: results
      };
    } catch (error) {
      console.error('Error creating band album consensus notifications:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        notifications: []
      };
    }
  }

  // Create individual band member album invitation notification
  async createBandAlbumInvitationNotification(
    uploaderId: string,
    uploaderName: string,
    recipientId: string,
    recipientName: string,
    bandName: string,
    albumId: string,
    albumTitle: string,
    albumData: any,
    recipientArtistId: string // Add artist_id parameter
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'general',
      notification_recipient: recipientId,
      notification_sender: uploaderId,
      notification_title: 'New Band Album for Approval',
      notification_message: `${uploaderName} has created a new album "${albumTitle}" for your band ${bandName}. Please review and approve or reject this album.`,
      notification_data: {
        notification_subtype: 'band_album_consensus',
        album_id: albumId,
        album_title: albumTitle,
        band_name: bandName,
        band_id: albumData.band_id,
        uploader_name: uploaderName,
        album_type: 'band',
        album_song_count: albumData.album_song_data?.length || 0,
        album_price: albumData.album_price || '0',
        recipient_artist_id: recipientArtistId // Add this for consensus updates
      },
      is_read: false,
      action_required: true,
    });
  }

  // Create notification when band album is approved (goes active)
  async createBandAlbumApprovedNotifications(
    albumId: string,
    albumTitle: string,
    bandId: string,
    bandName: string
  ): Promise<{ success: boolean; error?: string; notifications: any[] }> {
    try {
      // Get band members
      const { data: bandData, error: bandError } = await supabase
        .from('bands')
        .select('band_members')
        .eq('band_id', bandId)
        .single();

      if (bandError) {
        throw new Error(`Failed to fetch band members: ${bandError.message}`);
      }

      const notifications: any[] = [];
      const results: any[] = [];

      // Notify all band members that the album is now active
      for (const artistId of (bandData.band_members || [])) {
        const { data: artistData } = await supabase
          .from('artists')
          .select('spotter_id, artist_name')
          .eq('artist_id', artistId)
          .single();

        if (artistData) {
          const result = await this.createNotification({
            notification_type: 'general',
            notification_recipient: artistData.spotter_id,
            notification_sender: null,
            notification_title: 'Album is Now Active!',
            notification_message: `Great news! The album "${albumTitle}" by ${bandName} has been approved by all band members and is now live!`,
            notification_data: {
              album_id: albumId,
              album_title: albumTitle,
              band_name: bandName,
              band_id: bandId,
              notification_subtype: 'album_activated'
            },
            is_read: false,
            action_required: false,
          });
          results.push({ artistId, artistName: artistData.artist_name, result });
        }
      }

      const allSuccess = results.every(r => r.result.success);

      return {
        success: allSuccess,
        error: allSuccess ? undefined : 'Some notifications failed to send',
        notifications: results
      };
    } catch (error) {
      console.error('Error creating band album approved notifications:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        notifications: []
      };
    }
  }

  // Create notification when band album is rejected
  async createBandAlbumRejectedNotification(
    rejectorId: string,
    rejectorName: string,
    uploaderId: string,
    albumTitle: string,
    bandName: string
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'general',
      notification_recipient: uploaderId,
      notification_sender: rejectorId,
      notification_title: 'Album Rejected',
      notification_message: `${rejectorName} has rejected the album "${albumTitle}" for ${bandName}. You can edit the album and resubmit it for approval.`,
      notification_data: {
        album_title: albumTitle,
        band_name: bandName,
        rejector_name: rejectorName,
        notification_subtype: 'album_rejected'
      },
      is_read: false,
      action_required: false,
    });
  }

  // Create album approval notification (for other band members)
  async createAlbumApprovalNotification(
    approverId: string,
    approverName: string,
    recipientId: string,
    albumId: string,
    albumTitle: string,
    bandId: string,
    bandName: string
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'general',
      notification_recipient: recipientId,
      notification_sender: approverId,
      notification_title: 'Album Approved by Band Member',
      notification_message: `${approverName} approved the album "${albumTitle}" for ${bandName}.`,
      notification_data: { 
        album_id: albumId,
        album_title: albumTitle,
        band_id: bandId, 
        band_name: bandName,
        notification_subtype: 'album_member_approved'
      },
      is_read: false,
      action_required: false,
    });
  }

  // Create album rejection notification (for other band members)
  async createAlbumRejectionNotification(
    rejecterId: string,
    rejecterName: string,
    recipientId: string,
    albumId: string,
    albumTitle: string,
    bandId: string,
    bandName: string
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'general',
      notification_recipient: recipientId,
      notification_sender: rejecterId,
      notification_title: 'Album Rejected by Band Member',
      notification_message: `${rejecterName} rejected the album "${albumTitle}" for ${bandName}.`,
      notification_data: { 
        album_id: albumId,
        album_title: albumTitle,
        band_id: bandId, 
        band_name: bandName,
        notification_subtype: 'album_member_rejected'
      },
      is_read: false,
      action_required: false,
    });
  }

  // ===== BACKLINE CONSENSUS NOTIFICATIONS =====

  // Create band backline consensus notification for all band members
  async createBandBacklineConsensusNotification(
    requesterId: string,
    requesterName: string,
    bandId: string,
    bandName: string,
    showId: string,
    showData: any
  ): Promise<{ success: boolean; error?: string; notifications: any[] }> {
    try {
      // Get band members
      const { data: bandData, error: bandError } = await supabase
        .from('bands')
        .select('band_members')
        .eq('band_id', bandId)
        .single();

      if (bandError) {
        throw new Error(`Failed to fetch band members: ${bandError.message}`);
      }

      // Get artist IDs from band_members and find their spotter_ids
      const notifications: any[] = [];
      const results: any[] = [];

      for (const artistId of (bandData.band_members || [])) {
        // Don't notify the requester
        if (artistId === requesterId) {
          continue; // Skip the requester
        }
        
        const { data: artistData } = await supabase
          .from('artists')
          .select('spotter_id, artist_name')
          .eq('artist_id', artistId)
          .single();

        if (artistData) {
          const result = await this.createBandBacklineInvitationNotification(
            requesterId,
            requesterName,
            artistData.spotter_id,
            artistData.artist_name,
            bandName,
            showId,
            showData,
            artistId
          );

          results.push(result);
          if (result.success) {
            notifications.push(result.data);
          }
        }
      }

      return {
        success: true,
        notifications,
        error: results.some(r => !r.success) ? 'Some notifications failed' : undefined
      };
    } catch (error) {
      console.error('Error creating band backline consensus notifications:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        notifications: []
      };
    }
  }

  // Create individual backline invitation notification
  async createBandBacklineInvitationNotification(
    requesterId: string,
    requesterName: string,
    recipientId: string,
    recipientName: string,
    bandName: string,
    showId: string,
    showData: any,
    recipientArtistId: string
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'general',
      notification_recipient: recipientId,
      notification_sender: requesterId,
      notification_title: 'Backline Request for Band',
      notification_message: `${requesterName} wants ${bandName} to backline for a show. Do you approve?`,
      notification_data: { 
        show_id: showId,
        band_id: showData.band_id,
        band_name: bandName,
        venue_name: showData.venue_name || 'Venue',
        show_date: showData.show_date || showData.show_preferred_date,
        show_time: showData.show_time || showData.show_preferred_time,
        recipient_artist_id: recipientArtistId,
        notification_subtype: 'band_backline_consensus'
      },
      is_read: false,
      action_required: true,
    });
  }

  // Create backline approved notification
  async createBandBacklineApprovedNotifications(
    showId: string,
    bandId: string,
    bandName: string,
    showData: any
  ): Promise<{ success: boolean; error?: string; notifications: any[] }> {
    try {
      // Get all band members
      const { data: bandData, error: bandError } = await supabase
        .from('bands')
        .select('band_members')
        .eq('band_id', bandId)
        .single();

      if (bandError) {
        throw new Error(`Failed to fetch band members: ${bandError.message}`);
      }

      const notifications: any[] = [];
      const results: any[] = [];

      for (const artistId of (bandData.band_members || [])) {
        const { data: artistData } = await supabase
          .from('artists')
          .select('spotter_id, artist_name')
          .eq('artist_id', artistId)
          .single();

        if (artistData) {
          const result = await this.createNotification({
            notification_type: 'general',
            notification_recipient: artistData.spotter_id,
            notification_sender: null,
            notification_title: 'Band Approved for Backline',
            notification_message: `${bandName} has been approved to backline for the show!`,
            notification_data: { 
              show_id: showId,
              band_id: bandId,
              band_name: bandName,
              venue_name: showData.venue_name || 'Venue',
              show_date: showData.show_date || showData.show_preferred_date,
              show_time: showData.show_time || showData.show_preferred_time,
              notification_subtype: 'band_backline_approved'
            },
            is_read: false,
            action_required: false,
          });

          results.push(result);
          if (result.success) {
            notifications.push(result.data);
          }
        }
      }

      return {
        success: true,
        notifications,
        error: results.some(r => !r.success) ? 'Some notifications failed' : undefined
      };
    } catch (error) {
      console.error('Error creating band backline approved notifications:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        notifications: []
      };
    }
  }

  // Create backline rejected notification  
  async createBandBacklineMemberRejectedNotification(
    rejecterId: string,
    rejecterName: string,
    recipientId: string,
    bandId: string,
    bandName: string,
    showId: string
  ): Promise<{ success: boolean; error?: string; data?: any }> {
    return this.createNotification({
      notification_type: 'general',
      notification_recipient: recipientId,
      notification_sender: rejecterId,
      notification_title: 'Backline Rejected by Band Member',
      notification_message: `${rejecterName} rejected the backline request for ${bandName}.`,
      notification_data: { 
        show_id: showId,
        band_id: bandId,
        band_name: bandName,
        notification_subtype: 'backline_member_rejected'
      },
      is_read: false,
      action_required: false,
    });
  }
}

export const notificationService = new NotificationService();