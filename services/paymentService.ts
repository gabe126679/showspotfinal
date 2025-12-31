// Payment Service for ShowSpot
// Handles Stripe payment intent creation and processing
// NOTE: For production, payment intents should be created on a secure backend

import { supabase } from '../lib/supabase';
import { STRIPE_CONFIG, STRIPE_UTILS } from '../config/stripe';

export interface PaymentIntentResult {
  success: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  error?: string;
}

export interface PaymentMetadata {
  type: 'ticket' | 'song' | 'album' | 'tip';
  itemId: string;
  itemName: string;
  buyerId: string;
  sellerId?: string;
  quantity?: number;
}

class PaymentService {
  /**
   * Create a payment intent for a purchase
   * In production, this should call your secure backend endpoint
   * For now, we use a mock that simulates the payment intent creation
   */
  async createPaymentIntent(
    amountInCents: number,
    metadata: PaymentMetadata
  ): Promise<PaymentIntentResult> {
    try {
      // Validate minimum amount (Stripe requires at least $0.50)
      if (!STRIPE_UTILS.validatePaymentAmount(amountInCents)) {
        return {
          success: false,
          error: 'Amount must be at least $0.50'
        };
      }

      // In TEST MODE: Create a mock payment intent
      // This allows the app to function for testing without a backend
      if (STRIPE_CONFIG.IS_TEST_MODE) {
        const mockPaymentIntentId = `pi_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const mockClientSecret = `${mockPaymentIntentId}_secret_${Math.random().toString(36).substr(2, 16)}`;

        console.log('🧪 TEST MODE: Created mock payment intent:', mockPaymentIntentId);

        return {
          success: true,
          clientSecret: mockClientSecret,
          paymentIntentId: mockPaymentIntentId
        };
      }

      // PRODUCTION: Call your secure backend endpoint
      // This endpoint should use your Stripe secret key to create the payment intent
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInCents,
          currency: 'usd',
          metadata: {
            ...metadata,
            platform: 'showspot'
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment intent');
      }

      const data = await response.json();
      return {
        success: true,
        clientSecret: data.clientSecret,
        paymentIntentId: data.paymentIntentId
      };

    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      return {
        success: false,
        error: error.message || 'Failed to create payment'
      };
    }
  }

  /**
   * Create payment intent for ticket purchase
   */
  async createTicketPaymentIntent(
    showId: string,
    showName: string,
    ticketPrice: number,
    quantity: number,
    buyerId: string,
    venueId?: string
  ): Promise<PaymentIntentResult> {
    const totalAmount = STRIPE_UTILS.formatPriceForStripe(ticketPrice * quantity);

    return this.createPaymentIntent(totalAmount, {
      type: 'ticket',
      itemId: showId,
      itemName: showName,
      buyerId,
      sellerId: venueId,
      quantity
    });
  }

  /**
   * Create payment intent for song purchase
   */
  async createSongPaymentIntent(
    songId: string,
    songTitle: string,
    price: number,
    buyerId: string,
    artistId: string
  ): Promise<PaymentIntentResult> {
    const amountInCents = STRIPE_UTILS.formatPriceForStripe(price);

    return this.createPaymentIntent(amountInCents, {
      type: 'song',
      itemId: songId,
      itemName: songTitle,
      buyerId,
      sellerId: artistId
    });
  }

  /**
   * Create payment intent for album purchase
   */
  async createAlbumPaymentIntent(
    albumId: string,
    albumTitle: string,
    price: number,
    buyerId: string,
    artistId: string
  ): Promise<PaymentIntentResult> {
    const amountInCents = STRIPE_UTILS.formatPriceForStripe(price);

    return this.createPaymentIntent(amountInCents, {
      type: 'album',
      itemId: albumId,
      itemName: albumTitle,
      buyerId,
      sellerId: artistId
    });
  }

  /**
   * Create payment intent for tip
   */
  async createTipPaymentIntent(
    recipientId: string,
    recipientName: string,
    amount: number,
    senderId: string
  ): Promise<PaymentIntentResult> {
    const amountInCents = STRIPE_UTILS.formatPriceForStripe(amount);

    return this.createPaymentIntent(amountInCents, {
      type: 'tip',
      itemId: recipientId,
      itemName: `Tip for ${recipientName}`,
      buyerId: senderId,
      sellerId: recipientId
    });
  }

  /**
   * Confirm payment was successful (verify with backend in production)
   * For test mode, this just returns success
   */
  async confirmPayment(paymentIntentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (STRIPE_CONFIG.IS_TEST_MODE) {
        // In test mode, assume payment succeeded
        console.log('🧪 TEST MODE: Payment confirmed:', paymentIntentId);
        return { success: true };
      }

      // In production, verify payment status with your backend
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentIntentId }),
      });

      if (!response.ok) {
        throw new Error('Payment verification failed');
      }

      const data = await response.json();
      return { success: data.status === 'succeeded' };

    } catch (error: any) {
      console.error('Error confirming payment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record a successful payment in the database
   */
  async recordPayment(
    paymentIntentId: string,
    metadata: PaymentMetadata,
    amountInCents: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('payments').insert({
        stripe_payment_intent_id: paymentIntentId,
        payment_type: metadata.type,
        item_id: metadata.itemId,
        buyer_id: metadata.buyerId,
        seller_id: metadata.sellerId,
        amount_cents: amountInCents,
        status: 'completed',
        created_at: new Date().toISOString()
      });

      if (error) {
        // If payments table doesn't exist, just log and continue
        // The individual purchase tables will still be updated
        console.warn('Could not record payment (table may not exist):', error);
      }

      return { success: true };
    } catch (error: any) {
      console.warn('Error recording payment:', error);
      return { success: true }; // Don't fail the purchase if payment recording fails
    }
  }
}

export const paymentService = new PaymentService();
