import { supabase } from '../lib/supabase';

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface VoteResult {
  hasVoted: boolean;
  voteCount: number;
  voteAdded?: boolean;
}

class ShowVotingService {
  async checkUserVote(showId: string, userId: string): Promise<ServiceResponse<boolean>> {
    try {
      const { data, error } = await supabase
        .rpc('user_has_voted_for_show', {
          show_id: showId,
          user_id: userId
        });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return { success: true, data: data || false };
    } catch (error) {
      console.error('Error checking user vote:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async getShowVoteCount(showId: string): Promise<ServiceResponse<number>> {
    try {
      const { data, error } = await supabase
        .rpc('get_show_vote_count', {
          show_id: showId
        });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return { success: true, data: data || 0 };
    } catch (error) {
      console.error('Error getting vote count:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async addVote(showId: string, userId: string): Promise<ServiceResponse<boolean>> {
    try {
      const { data, error } = await supabase
        .rpc('add_show_vote', {
          show_id: showId,
          user_id: userId
        });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // data will be true if vote was added, false if user already voted
      return { success: true, data: data || false };
    } catch (error) {
      console.error('Error adding vote:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async getVoteInfo(showId: string, userId: string): Promise<ServiceResponse<VoteResult>> {
    try {
      // Get both vote status and count in parallel
      const [voteCheckResult, voteCountResult] = await Promise.all([
        this.checkUserVote(showId, userId),
        this.getShowVoteCount(showId)
      ]);

      if (!voteCheckResult.success) {
        throw new Error(voteCheckResult.error);
      }

      if (!voteCountResult.success) {
        throw new Error(voteCountResult.error);
      }

      const result: VoteResult = {
        hasVoted: voteCheckResult.data || false,
        voteCount: voteCountResult.data || 0
      };

      return { success: true, data: result };
    } catch (error) {
      console.error('Error getting vote info:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async voteForShow(showId: string, userId: string): Promise<ServiceResponse<VoteResult>> {
    try {
      // Add the vote
      const addVoteResult = await this.addVote(showId, userId);
      
      if (!addVoteResult.success) {
        throw new Error(addVoteResult.error);
      }

      // Get updated vote info
      const voteInfoResult = await this.getVoteInfo(showId, userId);
      
      if (!voteInfoResult.success) {
        throw new Error(voteInfoResult.error);
      }

      const result: VoteResult = {
        ...voteInfoResult.data!,
        voteAdded: addVoteResult.data || false
      };

      return { success: true, data: result };
    } catch (error) {
      console.error('Error voting for show:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }
}

export const showVotingService = new ShowVotingService();
export type { VoteResult };