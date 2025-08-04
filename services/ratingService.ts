import { supabase } from '../lib/supabase';

export type EntityType = 'artist' | 'band' | 'venue';

export interface RatingInfo {
  currentRating: number;
  totalRaters: number;
  userRating: number; // 0 if user hasn't rated, 1-5 if they have
  hasRated: boolean;
}

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class RatingService {
  async getRatingInfo(
    entityId: string, 
    entityType: EntityType, 
    userId?: string
  ): Promise<ServiceResponse<RatingInfo>> {
    try {
      // Get entity rating
      const { data: ratingData, error: ratingError } = await supabase
        .rpc('get_entity_rating', {
          entity_id: entityId,
          entity_type: entityType
        });

      if (ratingError) {
        throw new Error(`Failed to get rating: ${ratingError.message}`);
      }

      const entityRating = ratingData?.[0] || { current_rating: 5.00, total_raters: 0 };

      let userRating = 0;
      let hasRated = false;

      // Get user's rating if user is provided
      if (userId) {
        const { data: userRatingData, error: userRatingError } = await supabase
          .rpc('get_user_rating', {
            entity_id: entityId,
            entity_type: entityType,
            user_id: userId
          });

        if (userRatingError) {
          console.warn('Error getting user rating:', userRatingError);
        } else {
          userRating = userRatingData || 0;
          hasRated = userRating > 0;
        }
      }

      const result: RatingInfo = {
        currentRating: Number(entityRating.current_rating),
        totalRaters: entityRating.total_raters,
        userRating,
        hasRated
      };

      return { success: true, data: result };
    } catch (error) {
      console.error('Error getting rating info:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async rateEntity(
    entityId: string, 
    entityType: EntityType, 
    userId: string, 
    rating: number
  ): Promise<ServiceResponse<RatingInfo>> {
    try {
      // Validate rating
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5 stars');
      }

      // Submit rating
      const { data, error } = await supabase
        .rpc('rate_entity', {
          entity_id: entityId,
          entity_type: entityType,
          user_id: userId,
          rating_value: rating
        });

      if (error) {
        throw new Error(`Failed to submit rating: ${error.message}`);
      }

      if (!data) {
        throw new Error('Failed to submit rating');
      }

      // Get updated rating info
      const updatedRatingResult = await this.getRatingInfo(entityId, entityType, userId);
      
      if (!updatedRatingResult.success) {
        throw new Error(updatedRatingResult.error);
      }

      return { success: true, data: updatedRatingResult.data };
    } catch (error) {
      console.error('Error rating entity:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async checkUserRating(
    entityId: string, 
    entityType: EntityType, 
    userId: string
  ): Promise<ServiceResponse<boolean>> {
    try {
      const { data, error } = await supabase
        .rpc('user_has_rated_entity', {
          entity_id: entityId,
          entity_type: entityType,
          user_id: userId
        });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return { success: true, data: data || false };
    } catch (error) {
      console.error('Error checking user rating:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }
}

export const ratingService = new RatingService();