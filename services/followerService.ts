import { supabase } from '../lib/supabase';

export type EntityType = 'artist' | 'band' | 'venue';

export interface FollowerInfo {
  followerCount: number;
  userIsFollowing: boolean;
}

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class FollowerService {
  async getFollowerInfo(
    entityId: string, 
    entityType: EntityType, 
    userId?: string
  ): Promise<ServiceResponse<FollowerInfo>> {
    try {
      // Get follower info
      const { data: followerData, error: followerError } = await supabase
        .rpc('get_follower_info', {
          entity_id: entityId,
          entity_type: entityType,
          user_id: userId || null
        });

      if (followerError) {
        throw new Error(`Failed to get follower info: ${followerError.message}`);
      }

      const info = followerData?.[0] || { follower_count: 0, user_is_following: false };

      const result: FollowerInfo = {
        followerCount: info.follower_count || 0,
        userIsFollowing: info.user_is_following || false
      };

      return { success: true, data: result };
    } catch (error) {
      console.error('Error getting follower info:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async toggleFollow(
    entityId: string, 
    entityType: EntityType, 
    userId: string
  ): Promise<ServiceResponse<FollowerInfo>> {
    try {
      // Toggle follow status
      const { data, error } = await supabase
        .rpc('toggle_follow_entity', {
          entity_id: entityId,
          entity_type: entityType,
          user_id: userId
        });

      if (error) {
        throw new Error(`Failed to toggle follow: ${error.message}`);
      }

      // Get updated follower info
      const updatedInfoResult = await this.getFollowerInfo(entityId, entityType, userId);
      
      if (!updatedInfoResult.success) {
        throw new Error(updatedInfoResult.error);
      }

      return { success: true, data: updatedInfoResult.data };
    } catch (error) {
      console.error('Error toggling follow:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async checkUserFollowing(
    entityId: string, 
    entityType: EntityType, 
    userId: string
  ): Promise<ServiceResponse<boolean>> {
    try {
      const { data, error } = await supabase
        .rpc('user_is_following_entity', {
          entity_id: entityId,
          entity_type: entityType,
          user_id: userId
        });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return { success: true, data: data || false };
    } catch (error) {
      console.error('Error checking user following:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async getFollowerCounts(
    entities: { id: string; type: EntityType }[]
  ): Promise<ServiceResponse<{ [key: string]: number }>> {
    try {
      const entityIds = entities.map(e => e.id);
      const entityTypes = entities.map(e => e.type);

      const { data, error } = await supabase
        .rpc('get_entity_follower_counts', {
          entity_ids: entityIds,
          entity_types: entityTypes
        });

      if (error) {
        throw new Error(`Failed to get follower counts: ${error.message}`);
      }

      // Convert array response to object keyed by entity_id
      const result: { [key: string]: number } = {};
      data?.forEach((item: any) => {
        result[item.entity_id] = item.follower_count || 0;
      });

      return { success: true, data: result };
    } catch (error) {
      console.error('Error getting follower counts:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }
}

export const followerService = new FollowerService();