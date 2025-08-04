import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services/notificationService';
import { useMusicPlayer } from './player';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Notification {
  notification_id: string;
  notification_type: string;
  notification_sender: string | null;
  notification_title: string;
  notification_message: string;
  notification_data: any;
  is_read: boolean;
  action_required: boolean;
  expires_at: string | null;
  created_at: string;
  sender_name?: string;
}

interface NotificationsPageProps {
  onClose: () => void;
}

const NotificationsPage: React.FC<NotificationsPageProps> = ({ onClose }) => {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { playSong } = useMusicPlayer();

  useEffect(() => {
    getCurrentUser();
    fetchNotifications();
  }, []);

  const getCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        console.log('No authenticated user found');
        return;
      }

      // Get current user's artist_id(s) since notifications are sent to artist_id
      const { data: artistData } = await supabase
        .from('artists')
        .select('artist_id')
        .eq('spotter_id', session.user.id);
      
      const artistIds = artistData?.map(artist => artist.artist_id) || [];
      
      // Build query to fetch notifications
      let query = supabase
        .from('notifications')
        .select('*');
      
      if (artistIds.length > 0) {
        // User has artist profiles, check both spotter_id and artist_id(s)
        query = query.or(`notification_recipient.eq.${session.user.id},notification_recipient.in.(${artistIds.join(',')})`);
      } else {
        // User has no artist profiles, only check spotter_id
        query = query.eq('notification_recipient', session.user.id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      // Process notifications to include sender name
      const processedNotifications = await Promise.all((data || []).map(async (notification) => {
        let sender_name = 'Unknown User';
        
        if (notification.notification_sender) {
          // Try to get sender name from artists table first
          const { data: artistData } = await supabase
            .from('artists')
            .select('artist_name')
            .eq('artist_id', notification.notification_sender)
            .single();
          
          if (artistData?.artist_name) {
            sender_name = artistData.artist_name;
          } else {
            // If not found in artists, try spotters table
            const { data: spotterData } = await supabase
              .from('spotters')
              .select('full_name')
              .eq('id', notification.notification_sender)
              .single();
            
            if (spotterData?.full_name) {
              sender_name = spotterData.full_name;
            }
          }
        }
        
        return {
          ...notification,
          sender_name
        };
      }));

      setNotifications(processedNotifications);
    } catch (error) {
      console.error('Error in fetchNotifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('notification_id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }

      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.notification_id === notificationId 
            ? { ...notification, is_read: true }
            : notification
        )
      );
    } catch (error) {
      console.error('Error in markAsRead:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      if (!currentUser) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('notification_recipient', currentUser.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return;
      }

      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, is_read: true }))
      );
    } catch (error) {
      console.error('Error in markAllAsRead:', error);
    }
  };

  // Handle artist show invitation acceptance
  const handleArtistShowInvitationAccept = async (notification: Notification) => {
    try {
      if (!notification.notification_data?.show_id) {
        Alert.alert('Error', 'Invalid show invitation');
        return;
      }

      setLoading(true);

      // Get the show data
      const { data: showData, error: showError } = await supabase
        .from('shows')
        .select('*')
        .eq('show_id', notification.notification_data.show_id)
        .single();

      if (showError || !showData) {
        Alert.alert('Error', 'Could not find show information');
        return;
      }

      // Update show_members to accept
      const updatedMembers = showData.show_members.map((member: any) => {
        if (member.show_member_id === notification.notification_recipient && member.show_member_type === 'artist') {
          return { ...member, show_member_decision: true };
        }
        return member;
      });

      // Update the show
      const { error: updateError } = await supabase
        .from('shows')
        .update({ show_members: updatedMembers })
        .eq('show_id', notification.notification_data.show_id);

      if (updateError) {
        Alert.alert('Error', 'Could not update show status');
        return;
      }

      // Mark notification as handled
      await supabase
        .from('notifications')
        .update({ action_required: false, is_read: true })
        .eq('notification_id', notification.notification_id);

      // Get accepting artist's info
      const { data: artistData } = await supabase
        .from('artists')
        .select('artist_name')
        .eq('artist_id', notification.notification_recipient)
        .single();

      const artistName = artistData?.artist_name || 'Artist';

      // Send acceptance notification to promoter
      if (showData.show_promoter !== notification.notification_recipient) {
        await notificationService.createArtistShowAcceptanceNotification(
          notification.notification_recipient,
          artistName,
          showData.show_promoter,
          notification.notification_data.show_id,
          {
            venue_name: notification.notification_data.venue_name,
            preferred_date: notification.notification_data.preferred_date,
            preferred_time: notification.notification_data.preferred_time
          }
        );
      }

      // Check if show should be activated
      const activationResult = await notificationService.checkAndActivateShow(notification.notification_data.show_id);
      if (activationResult.activated) {
        Alert.alert('Success', 'You have accepted the show invitation! The show is now ACTIVE!');
      } else {
        Alert.alert('Success', 'You have accepted the show invitation!');
      }
      fetchNotifications();
    } catch (error) {
      console.error('Error accepting show invitation:', error);
      Alert.alert('Error', 'Could not accept invitation');
    } finally {
      setLoading(false);
    }
  };

  // Handle artist show invitation rejection
  const handleArtistShowInvitationReject = async (notification: Notification) => {
    try {
      Alert.alert(
        'Reject Invitation',
        'Are you sure you want to reject this show invitation?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: async () => {
              // Mark notification as handled
              await supabase
                .from('notifications')
                .update({ action_required: false, is_read: true })
                .eq('notification_id', notification.notification_id);
              
              Alert.alert('Success', 'Show invitation declined');
              fetchNotifications();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error rejecting show invitation:', error);
      Alert.alert('Error', 'Could not reject invitation');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  const handleBandInvitationAccept = async (notification: Notification) => {
    try {
      if (!notification.notification_data?.band_id) {
        Alert.alert('Error', 'Invalid band invitation');
        return;
      }

      setLoading(true);
      
      // Get the band data
      const { data: bandData, error: bandError } = await supabase
        .from('bands')
        .select('*')
        .eq('band_id', notification.notification_data.band_id)
        .single();

      if (bandError || !bandData) {
        Alert.alert('Error', 'Could not find band information');
        return;
      }

      // Update band_consensus to accept (notification_recipient is artist_id)
      console.log('🎵 Updating band consensus...');
      console.log('🎵 Notification recipient (artist_id):', notification.notification_recipient);
      console.log('🎵 Current band_consensus:', bandData.band_consensus);
      
      const updatedConsensus = bandData.band_consensus.map((member: any) => {
        console.log('🎵 Checking member:', member.member, 'against recipient:', notification.notification_recipient);
        if (member.member === notification.notification_recipient) {
          console.log('🎵 ✅ Found matching member, setting accepted to true');
          return { ...member, accepted: true };
        }
        return member;
      });
      
      console.log('🎵 Updated consensus:', updatedConsensus);

      // First, let's verify the band exists and check current user permissions
      console.log('🎵 Checking if band exists...');
      const { data: bandCheck, error: bandCheckError } = await supabase
        .from('bands')
        .select('band_id, band_creator, band_members, band_consensus')
        .eq('band_id', notification.notification_data.band_id);
      
      console.log('🎵 Band check result:', bandCheck);
      console.log('🎵 Band check error:', bandCheckError);
      
      // Get current session for this scope
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      console.log('🎵 Current user session:', currentSession?.user?.id);
      
      if (!bandCheck || bandCheck.length === 0) {
        console.error('🎵 Band not found or not accessible due to RLS');
        Alert.alert('Error', 'Band not found or you do not have permission to update it');
        return;
      }

      // Update the band
      console.log('🎵 Attempting to update band with ID:', notification.notification_data.band_id);
      console.log('🎵 Updating with consensus:', updatedConsensus);
      
      const { data: updateData, error: updateError } = await supabase
        .from('bands')
        .update({ band_consensus: updatedConsensus })
        .eq('band_id', notification.notification_data.band_id)
        .select();

      console.log('🎵 Update response data:', updateData);
      console.log('🎵 Update error:', updateError);

      if (updateError) {
        console.error('🎵 Database update failed:', updateError);
        Alert.alert('Error', 'Could not update band status');
        return;
      }
      
      if (!updateData || updateData.length === 0) {
        console.error('🎵 No rows were updated - band_id might not exist');
        Alert.alert('Error', 'Band not found');
        return;
      }
      
      console.log('🎵 ✅ Band consensus updated successfully');

      // Mark notification as not requiring action
      await supabase
        .from('notifications')
        .update({ action_required: false, is_read: true })
        .eq('notification_id', notification.notification_id);

      // Send acceptance notifications to other band members
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Get accepting artist's info (notification_recipient is artist_id)
        const { data: artistData } = await supabase
          .from('artists')
          .select('artist_name')
          .eq('artist_id', notification.notification_recipient)
          .single();

        const acceptingArtistName = artistData?.artist_name || 'A member';

        // Send notifications to all band members (band_members contains artist_ids)
        for (const memberArtistId of bandData.band_members) {
          if (memberArtistId !== notification.notification_recipient) {
            await notificationService.createBandAcceptanceNotification(
              notification.notification_recipient,
              acceptingArtistName,
              memberArtistId,
              bandData.band_id,
              bandData.band_name
            );
          }
        }

        // Check if all members have accepted
        const allAccepted = updatedConsensus.every((member: any) => member.accepted);
        if (allAccepted) {
          // Update band status to active
          await supabase
            .from('bands')
            .update({ band_status: 'active' })
            .eq('band_id', bandData.band_id);

          // Send band activation notifications
          for (const member of bandData.band_members) {
            await notificationService.createNotification({
              notification_type: 'general',
              notification_recipient: member,
              notification_sender: bandData.band_creator,
              notification_title: 'Band Now Active!',
              notification_message: `${bandData.band_name} is now active! You can now upload songs, accept show invitations, and backline for existing shows.`,
              notification_data: { band_id: bandData.band_id, band_name: bandData.band_name },
              is_read: false,
              action_required: false,
            });
          }
        }
      }

      Alert.alert('Success', 'You have joined the band!');
      fetchNotifications(); // Refresh the list
    } catch (error) {
      console.error('Error accepting band invitation:', error);
      Alert.alert('Error', 'Could not accept invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleBandInvitationReject = async (notification: Notification) => {
    try {
      if (!notification.notification_data?.band_id) {
        Alert.alert('Error', 'Invalid band invitation');
        return;
      }

      Alert.alert(
        'Reject Invitation',
        'Are you sure you want to reject this band invitation?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              
              // Mark notification as not requiring action
              await supabase
                .from('notifications')
                .update({ action_required: false, is_read: true })
                .eq('notification_id', notification.notification_id);

              // Get rejecting artist's info (notification_recipient is artist_id)
              const { data: artistData } = await supabase
                .from('artists')
                .select('artist_name')
                .eq('artist_id', notification.notification_recipient)
                .single();

              const rejectingArtistName = artistData?.artist_name || 'A member';

              // Send rejection notification to band creator (notification_sender is artist_id)
              await notificationService.createBandRejectionNotification(
                notification.notification_recipient,
                rejectingArtistName,
                notification.notification_sender!,
                notification.notification_data.band_id,
                notification.notification_data.band_name
              );

              Alert.alert('Success', 'You have declined the band invitation');
              fetchNotifications();
              setLoading(false);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error rejecting band invitation:', error);
      Alert.alert('Error', 'Could not reject invitation');
      setLoading(false);
    }
  };

  const handleSongRequestAccept = async (notification: Notification) => {
    try {
      if (!notification.notification_data?.song_id) {
        Alert.alert('Error', 'Invalid song request');
        return;
      }

      setLoading(true);

      // Get the song data
      const { data: songData, error: songError } = await supabase
        .from('songs')
        .select('*')
        .eq('song_id', notification.notification_data.song_id)
        .single();

      if (songError || !songData) {
        Alert.alert('Error', 'Could not find song information');
        return;
      }

      // Get the band data to access band_members
      const { data: bandData, error: bandError } = await supabase
        .from('bands')
        .select('band_members')
        .eq('band_id', songData.band_id)
        .single();

      if (bandError || !bandData) {
        Alert.alert('Error', 'Could not find band information');
        return;
      }

      // Update song_consensus to accept
      const updatedConsensus = songData.song_consensus.map((member: any) => {
        if (member.member === notification.notification_recipient) {
          return { ...member, accepted: true };
        }
        return member;
      });

      // Check if all members have accepted
      const allAccepted = updatedConsensus.every((member: any) => member.accepted);

      // Update the song
      const { error: updateError } = await supabase
        .from('songs')
        .update({ 
          song_consensus: updatedConsensus,
          song_approved: allAccepted,
          song_status: allAccepted ? 'active' : 'pending'
        })
        .eq('song_id', notification.notification_data.song_id);

      if (updateError) {
        Alert.alert('Error', 'Could not update song status');
        return;
      }

      // If all members approved, send activation notifications
      if (allAccepted) {
        console.log('🎵 All members approved! Sending activation notifications...');
        
        // Send song activation notifications to all band members
        for (const memberArtistId of bandData.band_members) {
          try {
            await notificationService.createNotification({
              notification_type: 'song_approved',
              notification_recipient: memberArtistId,
              notification_sender: songData.uploader_id,
              notification_title: 'Song Activated!',
              notification_message: `"${songData.song_title}" has been approved by all members and is now live!`,
              notification_data: {
                song_id: songData.song_id,
                song_title: songData.song_title,
                band_id: songData.band_id,
                band_name: notification.notification_data.band_name
              },
              is_read: false,
              action_required: false,
            });
          } catch (notifError) {
            console.error('Failed to send activation notification:', notifError);
          }
        }
        
        Alert.alert('Success', `"${songData.song_title}" is now active and available to everyone!`);
      } else {
        Alert.alert('Approved', 'Your approval has been recorded. Waiting for other members to approve.');
      }

      // Mark notification as not requiring action
      await supabase
        .from('notifications')
        .update({ action_required: false, is_read: true })
        .eq('notification_id', notification.notification_id);

      // Send approval notifications to other band members
      const { data: artistData } = await supabase
        .from('artists')
        .select('artist_name')
        .eq('artist_id', notification.notification_recipient)
        .single();

      const approverName = artistData?.artist_name || 'A member';

      // Send notifications to all band members
      for (const memberArtistId of bandData.band_members) {
        if (memberArtistId !== notification.notification_recipient) {
          await notificationService.createSongApprovalNotification(
            notification.notification_recipient,
            approverName,
            memberArtistId,
            notification.notification_data.song_id,
            notification.notification_data.song_title,
            notification.notification_data.band_id,
            notification.notification_data.band_name
          );
        }
      }

      if (allAccepted) {
        Alert.alert('Success', 'Song approved! The song is now live for the band.');
      } else {
        Alert.alert('Success', 'You approved the song. Waiting for other members to approve.');
      }

      fetchNotifications(); // Refresh the list
    } catch (error) {
      console.error('Error approving song request:', error);
      Alert.alert('Error', 'Could not approve song');
    } finally {
      setLoading(false);
    }
  };

  const handleSongRequestReject = async (notification: Notification) => {
    try {
      if (!notification.notification_data?.song_id) {
        Alert.alert('Error', 'Invalid song request');
        return;
      }

      Alert.alert(
        'Reject Song',
        'Are you sure you want to reject this song?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: async () => {
              setLoading(true);

              // Mark notification as not requiring action
              await supabase
                .from('notifications')
                .update({ action_required: false, is_read: true })
                .eq('notification_id', notification.notification_id);

              // Get rejecting artist's info
              const { data: artistData } = await supabase
                .from('artists')
                .select('artist_name')
                .eq('artist_id', notification.notification_recipient)
                .single();

              const rejecterName = artistData?.artist_name || 'A member';

              // Send rejection notification to song uploader
              await notificationService.createSongRejectionNotification(
                notification.notification_recipient,
                rejecterName,
                notification.notification_sender!,
                notification.notification_data.song_id,
                notification.notification_data.song_title,
                notification.notification_data.band_id,
                notification.notification_data.band_name
              );

              // Optionally, you could delete the song or mark it as rejected
              // For now, we'll just leave it unapproved

              Alert.alert('Success', 'You have rejected the song');
              fetchNotifications();
              setLoading(false);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error rejecting song request:', error);
      Alert.alert('Error', 'Could not reject song');
      setLoading(false);
    }
  };

  const handleSongPreview = async (notification: Notification) => {
    try {
      const songData = notification.notification_data;
      if (!songData?.song_file) {
        Alert.alert('Error', 'Song file not available for preview');
        return;
      }

      // Create a song object for the player
      const song = {
        song_id: songData.song_id,
        song_title: songData.song_title,
        song_file: songData.song_file,
        song_image: songData.song_image,
        song_price: '0', // Preview is free
        artist_id: notification.notification_sender,
        spotter_id: notification.notification_sender,
        song_status: 'pending',
        song_approved: false,
        song_type: 'band', // This is a band song
        band_id: songData.band_id
      };

      // Play the song
      playSong(song, [song]);
      
      // Show a success message
      Alert.alert('Playing Preview', `Now playing "${songData.song_title}" preview`);
    } catch (error) {
      console.error('Error playing song preview:', error);
      Alert.alert('Error', 'Failed to play song preview');
    }
  };



  // Handle band member show invitation accept
  const handleBandMemberShowInvitationAccept = async (notification: Notification) => {
    try {
      if (!notification.notification_data?.show_id) {
        Alert.alert('Error', 'Invalid show invitation');
        return;
      }

      setLoading(true);

      // Get the show data
      const { data: showData, error: showError } = await supabase
        .from('shows')
        .select('*')
        .eq('show_id', notification.notification_data.show_id)
        .single();

      if (showError || !showData) {
        Alert.alert('Error', 'Could not find show information');
        return;
      }

      // Find and update the band member's consensus
      let bandMemberIndex = -1;
      let showMemberIndex = -1;
      
      console.log('🔍 DEBUG: Looking for notification recipient:', notification.notification_recipient);
      console.log('🔍 DEBUG: Show members:', JSON.stringify(showData.show_members, null, 2));
      
      const updatedMembers = showData.show_members.map((member: any, idx: number) => {
        if (member.show_member_type === 'band' && member.show_member_consensus) {
          console.log(`🔍 DEBUG: Checking band ${member.show_member_name} consensus:`, member.show_member_consensus);
          
          const consensusIndex = member.show_member_consensus.findIndex(
            (bm: any) => {
              console.log(`🔍 DEBUG: Comparing ${bm.show_band_member_id} === ${notification.notification_recipient}`);
              return bm.show_band_member_id === notification.notification_recipient;
            }
          );
          
          console.log(`🔍 DEBUG: Found consensus index: ${consensusIndex} for band ${member.show_member_name}`);
          
          if (consensusIndex !== -1) {
            showMemberIndex = idx;
            bandMemberIndex = consensusIndex;
            
            const updatedConsensus = [...member.show_member_consensus];
            updatedConsensus[consensusIndex] = {
              ...updatedConsensus[consensusIndex],
              show_band_member_decision: true
            };
            
            console.log('🔍 DEBUG: Updated consensus:', updatedConsensus);
            
            // Check if all band members have accepted
            const allAccepted = updatedConsensus.every((bm: any) => bm.show_band_member_decision);
            console.log('🔍 DEBUG: All accepted?', allAccepted);
            
            return {
              ...member,
              show_member_consensus: updatedConsensus,
              show_member_decision: allAccepted
            };
          }
        }
        return member;
      });

      // Check if we found the member to update
      if (showMemberIndex === -1 || bandMemberIndex === -1) {
        console.error('🔍 DEBUG: Could not find band member in consensus array');
        console.error('🔍 DEBUG: showMemberIndex:', showMemberIndex, 'bandMemberIndex:', bandMemberIndex);
        Alert.alert('Error', 'Could not find your membership in this show');
        return;
      }

      // Update the show
      console.log('🔍 DEBUG: About to update show with members:', JSON.stringify(updatedMembers, null, 2));
      
      const { data: updateData, error: updateError } = await supabase
        .from('shows')
        .update({ show_members: updatedMembers })
        .eq('show_id', notification.notification_data.show_id)
        .select();

      console.log('🔍 DEBUG: Update result:', { data: updateData, error: updateError });

      if (updateError) {
        console.error('🔍 DEBUG: Update failed:', updateError);
        Alert.alert('Error', 'Could not update show status');
        return;
      }

      if (!updateData || updateData.length === 0) {
        console.error('🔍 DEBUG: No rows updated');
        Alert.alert('Error', 'Show not found or not updated');
        return;
      }

      // Mark notification as handled
      await supabase
        .from('notifications')
        .update({ action_required: false, is_read: true })
        .eq('notification_id', notification.notification_id);

      // Check if the entire band has now accepted
      const updatedBandMember = updatedMembers[showMemberIndex];
      if (updatedBandMember?.show_member_decision) {
        // All band members accepted - send band acceptance notifications
        const recipientIds = new Set<string>();
        
        // Add promoter
        recipientIds.add(showData.show_promoter);
        
        // Add venue spotter_id
        const { data: venueData } = await supabase
          .from('venues')
          .select('spotter_id')
          .eq('venue_id', showData.show_venue)
          .single();
        
        if (venueData?.spotter_id) {
          recipientIds.add(venueData.spotter_id);
        }

        // Add all show members (artists and band members)
        for (const member of showData.show_members) {
          if (member.show_member_type === 'artist') {
            recipientIds.add(member.show_member_id);
          } else if (member.show_member_type === 'band' && member.show_member_consensus) {
            for (const bandMember of member.show_member_consensus) {
              recipientIds.add(bandMember.show_band_member_id);
            }
          }
        }

        // Send band acceptance notifications
        for (const recipientId of recipientIds) {
          await notificationService.createBandShowAcceptanceNotification(
            showData.show_promoter,
            updatedBandMember.show_member_name,
            recipientId,
            showData.show_id,
            {
              venue_name: notification.notification_data.venue_name,
              preferred_date: notification.notification_data.preferred_date,
              preferred_time: notification.notification_data.preferred_time
            }
          );
        }

        Alert.alert('Success', `Your band ${updatedBandMember.show_member_name} has accepted the show invitation!`);
      } else {
        Alert.alert('Success', 'You have accepted the show invitation. Waiting for other band members to accept.');
      }

      fetchNotifications();
    } catch (error) {
      console.error('Error accepting band show invitation:', error);
      Alert.alert('Error', 'Could not accept invitation');
    } finally {
      setLoading(false);
    }
  };

  // Handle band member show invitation reject
  const handleBandMemberShowInvitationReject = async (notification: Notification) => {
    try {
      Alert.alert(
        'Reject Invitation',
        'Are you sure you want to reject this show invitation for your band?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: async () => {
              // Mark notification as handled
              await supabase
                .from('notifications')
                .update({ action_required: false, is_read: true })
                .eq('notification_id', notification.notification_id);

              Alert.alert('Success', 'You have declined the show invitation for your band');
              fetchNotifications();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error rejecting band show invitation:', error);
      Alert.alert('Error', 'Could not reject invitation');
    }
  };

  // Handle venue show invitation accept (opens wizard)
  const handleVenueShowInvitationAccept = async (notification: Notification) => {
    try {
      if (!notification.notification_data?.show_id) {
        Alert.alert('Error', 'Invalid show invitation');
        return;
      }

      // Close the notifications page first
      onClose();
      
      // Small delay to ensure the page closes before navigation
      setTimeout(() => {
        navigation.navigate('VenueAcceptanceWizard' as never, {
          show_id: notification.notification_data.show_id
        } as never);
      }, 100);

      // Mark notification as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('notification_id', notification.notification_id);

    } catch (error) {
      console.error('Error handling venue invitation:', error);
      Alert.alert('Error', 'Could not process invitation');
    }
  };

  // Handle venue show invitation reject
  const handleVenueShowInvitationReject = async (notification: Notification) => {
    try {
      Alert.alert(
        'Reject Invitation',
        'Are you sure you want to reject hosting this show?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: async () => {
              // Mark notification as handled
              await supabase
                .from('notifications')
                .update({ action_required: false, is_read: true })
                .eq('notification_id', notification.notification_id);

              Alert.alert('Success', 'You have declined to host this show');
              fetchNotifications();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error rejecting venue invitation:', error);
      Alert.alert('Error', 'Could not reject invitation');
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#ff00ff', '#2a2882']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadCount}>({unreadCount} unread)</Text>
          )}
        </View>
        
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Mark All Read</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff00ff" />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#ff00ff']}
              />
            }
          >
            {notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No notifications yet</Text>
                <Text style={styles.emptyMessage}>
                  When you receive notifications, they'll appear here.
                </Text>
              </View>
            ) : (
              notifications.map((notification) => (
                <TouchableOpacity
                  key={notification.notification_id}
                  style={[
                    styles.notificationItem,
                    !notification.is_read && styles.unreadNotification
                  ]}
                  onPress={() => {
                    if (!notification.is_read) {
                      markAsRead(notification.notification_id);
                    }
                    
                    // Handle navigation for venue acceptance and show activated notifications
                    if ((notification.notification_type === 'venue_show_acceptance' || 
                         (notification.notification_type === 'general' && notification.notification_data?.notification_subtype === 'show_activated')) && 
                        notification.notification_data?.show_id) {
                      onClose(); // Close notifications page
                      setTimeout(() => {
                        navigation.navigate('ShowBill' as never, {
                          show_id: notification.notification_data.show_id
                        } as never);
                      }, 100);
                    }
                  }}
                >
                  <View style={styles.notificationHeader}>
                    <Text style={styles.notificationTitle}>
                      {notification.notification_title}
                    </Text>
                    <Text style={styles.notificationTime}>
                      {formatDate(notification.created_at)}
                    </Text>
                  </View>
                  
                  <Text style={styles.notificationMessage}>
                    {notification.notification_message}
                  </Text>
                  
                  {/* Show Bill Link for venue acceptance and show activated notifications */}
                  {(notification.notification_type === 'venue_show_acceptance' || 
                    (notification.notification_type === 'general' && notification.notification_data?.notification_subtype === 'show_activated')) && (
                    <View style={styles.showBillLink}>
                      <Text style={styles.showBillLinkText}>👆 Tap to view show bill</Text>
                    </View>
                  )}
                  
                  {notification.sender_name && (
                    <Text style={styles.senderName}>
                      From: {notification.sender_name}
                    </Text>
                  )}
                  
                  {!notification.is_read && (
                    <View style={styles.unreadDot} />
                  )}
                  
                  {notification.action_required && (
                    <View style={styles.actionRequiredBadge}>
                      <Text style={styles.actionRequiredText}>Action Required</Text>
                    </View>
                  )}
                  
                  {notification.notification_type === 'band_invitation' && notification.action_required && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => handleBandInvitationAccept(notification)}
                      >
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => handleBandInvitationReject(notification)}
                      >
                        <Text style={styles.rejectButtonText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {notification.notification_type === 'song_request' && notification.action_required && (
                    <View style={styles.actionButtonsContainer}>
                      {/* Song Preview Button */}
                      {notification.notification_data?.song_file && (
                        <TouchableOpacity
                          style={styles.previewButton}
                          onPress={() => handleSongPreview(notification)}
                        >
                          <Text style={styles.previewButtonText}>▶️ Preview Song</Text>
                        </TouchableOpacity>
                      )}
                      
                      {/* Action Buttons */}
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={styles.acceptButton}
                          onPress={() => handleSongRequestAccept(notification)}
                        >
                          <Text style={styles.acceptButtonText}>Approve</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={styles.rejectButton}
                          onPress={() => handleSongRequestReject(notification)}
                        >
                          <Text style={styles.rejectButtonText}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Artist Show Invitation */}
                  {notification.notification_type === 'artist_show_invitation' && notification.action_required && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => handleArtistShowInvitationAccept(notification)}
                      >
                        <Text style={styles.acceptButtonText}>Accept Show</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => handleArtistShowInvitationReject(notification)}
                      >
                        <Text style={styles.rejectButtonText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Band Member Show Invitation */}
                  {notification.notification_type === 'band_member_show_invitation' && notification.action_required && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => handleBandMemberShowInvitationAccept(notification)}
                      >
                        <Text style={styles.acceptButtonText}>Accept for Band</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => handleBandMemberShowInvitationReject(notification)}
                      >
                        <Text style={styles.rejectButtonText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Venue Show Invitation */}
                  {notification.notification_type === 'venue_show_invitation' && notification.action_required && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => handleVenueShowInvitationAccept(notification)}
                      >
                        <Text style={styles.acceptButtonText}>Host Show</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => handleVenueShowInvitationReject(notification)}
                      >
                        <Text style={styles.rejectButtonText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 85,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 50,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  unreadCount: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
  },
  markAllButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  markAllText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 100,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  notificationItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#ff00ff',
    backgroundColor: '#fafafa',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  senderName: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  unreadDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff00ff',
  },
  actionRequiredBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ff4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  actionRequiredText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#2a2882',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    marginTop: 12,
  },
  previewButton: {
    backgroundColor: '#ff00ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 8,
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  showBillLink: {
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    borderColor: '#ff00ff',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  showBillLinkText: {
    color: '#ff00ff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default NotificationsPage;