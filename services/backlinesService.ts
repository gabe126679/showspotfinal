import { supabase } from '../lib/supabase';

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
    backlineArtistType: BacklineArtistType
  ): Promise<ServiceResponse<boolean>> {
    try {
      const { data, error } = await supabase
        .rpc('add_backline_application', {
          show_id: showId,
          backline_artist: backlineArtist,
          backline_artist_type: backlineArtistType
        });

      if (error) {
        throw new Error(`Failed to add backline application: ${error.message}`);
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
}

export const backlinesService = new BacklinesService();