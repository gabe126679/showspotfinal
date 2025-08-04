// Stripe configuration for ShowSpot
import { loadStripe } from '@stripe/stripe-js';

// Stripe configuration - using test keys for development
export const STRIPE_CONFIG = {
  // Test mode public key
  PUBLIC_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  
  // IMPORTANT: Never include secret keys in frontend code!
  // Secret keys should only exist on your backend server
  // SECRET_KEY: 'sk_test_...' // <- REMOVED FOR SECURITY
  
  // Dashboard URL for reference
  DASHBOARD_URL: 'https://dashboard.stripe.com/b/acct_1RSxsJBXbEDo51IX',
  
  // Test mode settings
  IS_TEST_MODE: true,
  
  // Test card numbers for development
  TEST_CARDS: {
    VISA: '4242424242424242',
    VISA_DEBIT: '4000056655665556', 
    MASTERCARD: '5555555555554444',
    AMERICAN_EXPRESS: '378282246310005',
    DECLINED: '4000000000000002',
    INSUFFICIENT_FUNDS: '4000000000009995'
  }
};

// Initialize Stripe
let stripePromise: Promise<any>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_CONFIG.PUBLIC_KEY);
  }
  return stripePromise;
};

// Stripe payment methods and utilities
export const STRIPE_UTILS = {
  // Format price for Stripe (convert dollars to cents)
  formatPriceForStripe: (dollarAmount: string | number): number => {
    const amount = typeof dollarAmount === 'string' ? parseFloat(dollarAmount) : dollarAmount;
    return Math.round(amount * 100); // Convert to cents
  },
  
  // Format price for display (convert cents to dollars)
  formatPriceForDisplay: (cents: number): string => {
    return (cents / 100).toFixed(2);
  },
  
  // Generate payment metadata for shows
  generateShowMetadata: (showId: string, ticketType: string, purchaserId: string) => ({
    show_id: showId,
    ticket_type: ticketType,
    purchaser_id: purchaserId,
    platform: 'showspot',
    environment: 'test'
  }),
  
  // Validate payment amount (minimum $0.50 for Stripe)
  validatePaymentAmount: (amount: number): boolean => {
    return amount >= 50; // 50 cents minimum
  }
};

// Stripe payment intents configuration
export const PAYMENT_INTENT_CONFIG = {
  currency: 'usd',
  automatic_payment_methods: {
    enabled: true,
  },
  capture_method: 'automatic', // Capture payment immediately
  confirmation_method: 'automatic',
};

// Error handling for Stripe
export const STRIPE_ERRORS = {
  CARD_DECLINED: 'card_declined',
  INSUFFICIENT_FUNDS: 'insufficient_funds',
  EXPIRED_CARD: 'expired_card',
  INCORRECT_CVC: 'incorrect_cvc',
  PROCESSING_ERROR: 'processing_error',
  INVALID_REQUEST: 'invalid_request_error'
};

export const getStripeErrorMessage = (error: any): string => {
  switch (error.code) {
    case STRIPE_ERRORS.CARD_DECLINED:
      return 'Your card was declined. Please try a different payment method.';
    case STRIPE_ERRORS.INSUFFICIENT_FUNDS:
      return 'Insufficient funds. Please try a different card.';
    case STRIPE_ERRORS.EXPIRED_CARD:
      return 'Your card has expired. Please use a different card.';
    case STRIPE_ERRORS.INCORRECT_CVC:
      return 'Your card\'s security code is incorrect.';
    case STRIPE_ERRORS.PROCESSING_ERROR:
      return 'An error occurred while processing your card. Try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};