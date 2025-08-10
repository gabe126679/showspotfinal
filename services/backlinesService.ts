import { supabase } from '../lib/supabase';
import { notificationService } from './notificationService';

export type BacklineArtistType = 'artist' | 'band';

export interface BacklineInfo {
  backlineArtist: string;
  backlineArtistType: BacklineArtistType;
  backlineStatus: 'active' | 'pending';
  voteCount: number;
  userHasVoted: boolean;
  backlineConsensus?: BacklineConsensus[];
}

export interface BacklineConsensus {
  backlineBandMember: string;
  backlineDecision: boolean;
}

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class BacklinesService {
  async addBacklineApplication(
    showId: string,
    backlineArtist: string,
    backlineArtistType: BacklineArtistType,
    requestingMember?: string
  ): Promise<ServiceResponse<boolean>> {
    try {
      const { data, error } = await supabase
        .rpc('add_backline_application', {
          show_id: showId,
          backline_artist: backlineArtist,
          backline_artist_type: backlineArtistType,
          requesting_member: requestingMember || null
        });

      if (error) {
        throw new Error(`Failed to add backline application: ${error.message}`);
      }

      // Send notifications for band backline applications
      if (backlineArtistType === 'band' && requestingMember) {
        try {
          // Get current user info
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const requesterName = await notificationService.getUserFullName(user.id);
            
            // Get band name and show data
            const { data: bandData } = await supabase
              .from('bands')
              .select('band_name')
              .eq('band_id', backlineArtist)
              .single();

            const { data: showData } = await supabase
              .from('shows')
              .select('*, venues!inner(venue_name)')
              .eq('show_id', showId)
              .single();

            if (bandData && showData) {
              const notificationData = {
                band_id: backlineArtist,
                venue_name: showData.venues?.venue_name || 'Venue',
                show_date: showData.show_date || showData.show_preferred_date,
                show_time: showData.show_time || showData.show_preferred_time
              };

              await notificationService.createBandBacklineConsensusNotification(
                requestingMember,
                requesterName,
                backlineArtist,
                bandData.band_name,
                showId,
                notificationData
              );
            }
          }
        } catch (notificationError) {
          console.error('Error sending backline consensus notifications:', notificationError);
          // Don't fail the backline application if notifications fail
        }
      }

      return { success: true, data: data };
    } catch (error) {
      console.error('Error adding backline application:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async voteForBackline(
    showId: string,
    backlineArtist: string,
    voterId: string
  ): Promise<ServiceResponse<boolean>> {
    try {
      const { data, error } = await supabase
        .rpc('vote_for_backline', {
          show_id: showId,
          backline_artist: backlineArtist,
          voter_id: voterId
        });

      if (error) {
        throw new Error(`Failed to vote for backline: ${error.message}`);
      }

      return { success: true, data: data };
    } catch (error) {
      console.error('Error voting for backline:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async updateBacklineConsensus(
    showId: string,
    backlineArtist: string,
    bandMemberId: string,
    decision: boolean
  ): Promise<ServiceResponse<boolean>> {
    try {
      const { data, error } = await supabase
        .rpc('update_backline_consensus', {
          show_id: showId,
          backline_artist: backlineArtist,
          band_member_id: bandMemberId,
          decision: decision
        });

      if (error) {
        throw new Error(`Failed to update backline consensus: ${error.message}`);
      }

      // Send notifications based on consensus changes
      try {
        // Get the updated backline data to check status
        const { data: updatedBacklines } = await supabase.rpc('get_show_backlines', {
          show_id: showId
        });

        const updatedBackline = updatedBacklines?.find((bl: any) => bl.backline_artist === backlineArtist);
        
        if (updatedBackline) {
          // Get show data for notifications
          const { data: showData } = await supabase
            .from('shows')
            .select('*, venues!inner(venue_name)')
            .eq('show_id', showId)
            .single();

          // Get band data
          const { data: bandData } = await supabase
            .from('bands')
            .select('band_name')
            .eq('band_id', backlineArtist)
            .single();

          if (showData && bandData) {
            const notificationData = {
              band_id: backlineArtist,
              venue_name: showData.venues?.venue_name || 'Venue',
              show_date: showData.show_date || showData.show_preferred_date,
              show_time: showData.show_time || showData.show_preferred_time
            };

            if (updatedBackline.backline_status === 'active') {
              // All members approved - send approval notifications
              await notificationService.createBandBacklineApprovedNotifications(
                showId,
                backlineArtist,
                bandData.band_name,
                notificationData
              );
            } else if (!decision) {
              // Member rejected - notify the original requester
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                const rejecterName = await notificationService.getUserFullName(user.id);
                
                // Find the original requester from the backline data
                // This would need to be stored in the backline_requester field
                // For now, we'll skip individual rejection notifications
                console.log('Member rejected backline request');
              }
            }
          }
        }
      } catch (notificationError) {
        console.error('Error sending backline consensus notifications:', notificationError);
        // Don't fail the consensus update if notifications fail
      }

      return { success: true, data: data };
    } catch (error) {
      console.error('Error updating backline consensus:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async getShowBacklines(
    showId: string,
    userId?: string
  ): Promise<ServiceResponse<BacklineInfo[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_show_backlines', {
          show_id: showId,
          user_id: userId || null
        });

      if (error) {
        throw new Error(`Failed to get show backlines: ${error.message}`);
      }

      const backlines: BacklineInfo[] = data?.map((item: any) => ({
        backlineArtist: item.backline_artist,
        backlineArtistType: item.backline_artist_type,
        backlineStatus: item.backline_status,
        voteCount: item.vote_count || 0,
        userHasVoted: item.user_has_voted || false,
        backlineConsensus: item.backline_consensus ? 
          item.backline_consensus.map((consensus: any) => ({
            backlineBandMember: consensus.backline_band_member,
            backlineDecision: consensus.backline_decision
          })) : undefined
      })) || [];

      // Sort by vote count (highest first)
      backlines.sort((a, b) => b.voteCount - a.voteCount);

      return { success: true, data: backlines };
    } catch (error) {
      console.error('Error getting show backlines:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async checkUserVotedBackline(
    showId: string,
    backlineArtist: string,
    userId: string
  ): Promise<ServiceResponse<boolean>> {
    try {
      const { data, error } = await supabase
        .rpc('user_has_voted_backline', {
          show_id: showId,
          backline_artist: backlineArtist,
          user_id: userId
        });

      if (error) {
        throw new Error(`Failed to check backline vote: ${error.message}`);
      }

      return { success: true, data: data || false };
    } catch (error) {
      console.error('Error checking backline vote:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async getBackliningShows(
    artistId: string,
    artistType: BacklineArtistType
  ): Promise<ServiceResponse<any[]>> {
    try {
      // Query shows where the artist/band is backlining
      const { data: showsData, error: showsError } = await supabase
        .from('shows')
        .select(`
          show_id,
          show_date,
          show_time,
          show_preferred_date,
          show_preferred_time,
          show_backlines,
          show_status,
          venue_decision,
          venues!inner(
            venue_name,
            venue_profile_image
          )
        `);

      if (showsError) {
        throw new Error(`Failed to get backlining shows: ${showsError.message}`);
      }

      // Filter shows where the artist/band is backlining
      const backliningShows = (showsData || []).filter(show => {
        if (!show.show_backlines) return false;
        
        // Parse backlines if it's a string
        let backlines;
        try {
          backlines = typeof show.show_backlines === 'string' 
            ? JSON.parse(show.show_backlines) 
            : show.show_backlines;
        } catch (e) {
          return false;
        }

        if (!Array.isArray(backlines)) return false;

        // Check if artist/band is in the backlines
        return backlines.some((backline: any) => 
          backline.backline_artist === artistId && 
          backline.backline_artist_type === artistType &&
          backline.backline_status === 'active' // Only show active backlines
        );
      }).map(show => ({
        show_id: show.show_id,
        show_date: show.show_date || show.show_preferred_date,
        show_time: show.show_time || show.show_preferred_time,
        venue_name: show.venues.venue_name,
        venue_profile_image: show.venues.venue_profile_image,
        show_status: show.show_status,
        venue_decision: show.venue_decision,
      }));

      return { success: true, data: backliningShows };
    } catch (error) {
      console.error('Error getting backlining shows:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }
}

export const backlinesService = new BacklinesService();