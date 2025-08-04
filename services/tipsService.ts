import { supabase } from '../lib/supabase';

export type EntityType = 'artist' | 'band' | 'venue';

export interface TipPayload {
  recipientId: string;
  recipientType: EntityType;
  amount: number;
  message?: string;
}

export interface PayoutInfo {
  totalAmount: number;
  tipTotal: number;
  showTotal: number;
  songTotal: number;
  albumTotal: number;
  payoutCount: number;
}

export interface RecentPayout {
  payoutId: string;
  amount: number;
  paymentType: string;
  paymentDescription: string;
  payerName: string;
  createdAt: string;
}

export interface TipStats {
  totalTipsReceived: number;
  tipCount: number;
  averageTip: number;
  topTipperName?: string;
  topTipAmount: number;
}

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class TipsService {
  // Process a tip payment
  async processTip(
    tipperId: string,
    tipPayload: TipPayload,
    stripePaymentIntentId?: string
  ): Promise<ServiceResponse<{ tipId: string }>> {
    try {
      const { data, error } = await supabase
        .rpc('process_tip', {
          tipper_user_id: tipperId,
          recipient_entity_id: tipPayload.recipientId,
          recipient_entity_type: tipPayload.recipientType,
          tip_amount_param: tipPayload.amount,
          tip_message_param: tipPayload.message || null,
          stripe_payment_intent_param: stripePaymentIntentId || null
        });

      if (error) {
        throw new Error(`Failed to process tip: ${error.message}`);
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to process tip');
      }

      return {
        success: true,
        data: { tipId: data.tip_id }
      };
    } catch (error) {
      console.error('Error processing tip:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Get total payouts for an entity
  async getEntityPayouts(
    entityId: string,
    entityType: EntityType
  ): Promise<ServiceResponse<PayoutInfo>> {
    try {
      const { data, error } = await supabase
        .rpc('get_entity_total_payouts', {
          entity_id: entityId,
          entity_type: entityType
        });

      if (error) {
        throw new Error(`Failed to get entity payouts: ${error.message}`);
      }

      const payoutInfo: PayoutInfo = {
        totalAmount: data?.[0]?.total_amount || 0,
        tipTotal: data?.[0]?.tip_total || 0,
        showTotal: data?.[0]?.show_total || 0,
        songTotal: data?.[0]?.song_total || 0,
        albumTotal: data?.[0]?.album_total || 0,
        payoutCount: data?.[0]?.payout_count || 0
      };

      return { success: true, data: payoutInfo };
    } catch (error) {
      console.error('Error getting entity payouts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Get recent payouts for an entity
  async getEntityRecentPayouts(
    entityId: string,
    entityType: EntityType,
    limit: number = 10
  ): Promise<ServiceResponse<RecentPayout[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_entity_recent_payouts', {
          entity_id: entityId,
          entity_type: entityType,
          limit_count: limit
        });

      if (error) {
        throw new Error(`Failed to get recent payouts: ${error.message}`);
      }

      const recentPayouts: RecentPayout[] = data?.map((payout: any) => ({
        payoutId: payout.payout_id,
        amount: payout.amount,
        paymentType: payout.payment_type,
        paymentDescription: payout.payment_description,
        payerName: payout.payer_name,
        createdAt: payout.created_at
      })) || [];

      return { success: true, data: recentPayouts };
    } catch (error) {
      console.error('Error getting recent payouts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Get tip statistics for an entity
  async getEntityTipStats(
    entityId: string,
    entityType: EntityType
  ): Promise<ServiceResponse<TipStats>> {
    try {
      const { data, error } = await supabase
        .rpc('get_entity_tip_stats', {
          entity_id: entityId,
          entity_type: entityType
        });

      if (error) {
        throw new Error(`Failed to get tip stats: ${error.message}`);
      }

      const tipStats: TipStats = {
        totalTipsReceived: data?.[0]?.total_tips_received || 0,
        tipCount: data?.[0]?.tip_count || 0,
        averageTip: data?.[0]?.average_tip || 0,
        topTipperName: data?.[0]?.top_tipper_name || undefined,
        topTipAmount: data?.[0]?.top_tip_amount || 0
      };

      return { success: true, data: tipStats };
    } catch (error) {
      console.error('Error getting tip stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Create Stripe payment intent for tip
  async createTipPaymentIntent(
    amount: number,
    recipientId: string,
    recipientType: EntityType
  ): Promise<ServiceResponse<{ clientSecret: string; paymentIntentId: string }>> {
    try {
      // This would typically call your backend API that creates a Stripe Payment Intent
      // For now, we'll simulate this since Stripe integration requires backend setup
      
      // In a real implementation, you would call something like:
      // const response = await fetch('/api/create-payment-intent', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     amount: amount * 100, // Stripe expects cents
      //     currency: 'usd',
      //     metadata: {
      //       recipientId,
      //       recipientType,
      //       paymentType: 'tip'
      //     }
      //   })
      // });

      // For development, return a mock response
      const mockPaymentIntentId = `pi_mock_${Date.now()}`;
      const mockClientSecret = `${mockPaymentIntentId}_secret_mock`;

      return {
        success: true,
        data: {
          clientSecret: mockClientSecret,
          paymentIntentId: mockPaymentIntentId
        }
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create payment intent'
      };
    }
  }

  // Validate tip amount
  validateTipAmount(amount: number): { valid: boolean; error?: string } {
    if (amount <= 0) {
      return { valid: false, error: 'Tip amount must be greater than $0' };
    }
    
    if (amount > 1000) {
      return { valid: false, error: 'Tip amount cannot exceed $1000' };
    }
    
    if (amount < 1) {
      return { valid: false, error: 'Minimum tip amount is $1' };
    }

    // Check for valid decimal places (max 2)
    if (Math.round(amount * 100) !== amount * 100) {
      return { valid: false, error: 'Invalid amount format' };
    }

    return { valid: true };
  }

  // Get predefined tip amounts
  getPredefinedTipAmounts(): number[] {
    return [1, 5, 10, 25, 50];
  }

  // Format currency for display
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
}

export const tipsService = new TipsService();