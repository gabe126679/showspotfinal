import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { ticketService } from '../services/ticketService';
import { paymentService } from '../services/paymentService';
import { notificationService } from '../services/notificationService';
import { v4 as uuidv4 } from 'uuid';
import { formatShowDate } from '../utils/dateUtils';
import { useUser } from '../context/userContext';
import AuthPromptModal from './AuthPromptModal';
import { ToastManager } from './Toast';
import { STRIPE_CONFIG } from '../config/stripe';

// Conditionally import Stripe hook - not available in Expo Go
let useStripe: () => { initPaymentSheet: any; presentPaymentSheet: any } = () => ({
  initPaymentSheet: null,
  presentPaymentSheet: null,
});
try {
  useStripe = require('@stripe/stripe-react-native').useStripe;
} catch (e) {
  console.log('Stripe hook not available (expected in Expo Go)');
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TicketPurchaseModalProps {
  visible: boolean;
  onClose: () => void;
  showData: {
    show_id: string;
    title: string;
    ticket_price: number;
    show_date?: string;
    show_time?: string;
    venue_name?: string;
    venue_id?: string;
  };
  onPurchaseSuccess: () => void;
}

const TicketPurchaseModal: React.FC<TicketPurchaseModalProps> = ({
  visible,
  onClose,
  showData,
  onPurchaseSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { isGuest, user } = useUser();

  useEffect(() => {
    if (visible) {
      // If user is a guest, show auth prompt instead
      if (isGuest || !user) {
        setShowAuthPrompt(true);
        return;
      }
      getCurrentUser();
    }
  }, [visible, isGuest, user]);

  // If showing auth prompt for guests
  if (showAuthPrompt && visible) {
    return (
      <AuthPromptModal
        visible={true}
        onClose={() => {
          setShowAuthPrompt(false);
          onClose();
        }}
        action="purchase_ticket"
      />
    );
  }

  const getCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      setCurrentUser(user);
    } catch (error) {
      console.error('Error getting current user:', error);
      ToastManager.error('Unable to get user information');
    }
  };

  const handlePurchase = async () => {
    if (!currentUser) {
      ToastManager.error('Please log in to purchase tickets');
      return;
    }

    // Check if Stripe is available (won't be in Expo Go)
    if (!initPaymentSheet || !presentPaymentSheet) {
      // Fall back to test purchase in development
      console.log('Stripe not available, using test purchase');
      await handleTestPurchase();
      return;
    }

    try {
      setLoading(true);

      // Create payment intent using our service
      const paymentResult = await paymentService.createTicketPaymentIntent(
        showData.show_id,
        showData.title,
        showData.ticket_price,
        1, // quantity
        currentUser.id,
        showData.venue_id
      );

      if (!paymentResult.success || !paymentResult.clientSecret) {
        ToastManager.error(paymentResult.error || 'Unable to initialize payment');
        return;
      }

      // Initialize the payment sheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'ShowSpot',
        paymentIntentClientSecret: paymentResult.clientSecret,
        defaultBillingDetails: {
          name: currentUser?.user_metadata?.full_name || 'User',
          email: currentUser?.email,
        },
        allowsDelayedPaymentMethods: false,
      });

      if (initError) {
        console.error('Error initializing payment sheet:', initError);
        ToastManager.error('Unable to initialize payment');
        return;
      }

      // Present the payment sheet to the user
      const { error: paymentError } = await presentPaymentSheet();

      if (paymentError) {
        if (paymentError.code !== 'Canceled') {
          console.error('Payment error:', paymentError);
          ToastManager.error(paymentError.message || 'Payment failed');
        }
        return;
      }

      // Payment successful! Create the ticket
      await createTicket(paymentResult.paymentIntentId!);

    } catch (error: any) {
      console.error('Error in handlePurchase:', error);
      ToastManager.error('Something went wrong with your purchase');
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async (paymentIntentId: string) => {
    try {
      console.log('Creating ticket after successful payment');

      // Generate QR code data
      const ticketId = uuidv4();
      const qrCodeData = {
        ticket_id: ticketId,
        show_id: showData.show_id,
        purchaser_id: currentUser.id,
        ticket_price: showData.ticket_price.toString(),
        created_at: new Date().toISOString(),
      };

      // Create ticket in database
      const ticketResult = await ticketService.createTicket({
        show_id: showData.show_id,
        purchaser_id: currentUser.id,
        ticket_price: showData.ticket_price.toString(),
        purchase_type: 'spotter show',
        qr_code: JSON.stringify(qrCodeData),
        qr_code_data: qrCodeData,
        ticket_status: 'purchased',
        payment_status: 'active',
        stripe_payment_intent_id: paymentIntentId,
      });

      if (!ticketResult.success) {
        throw new Error(ticketResult.error || 'Failed to create ticket');
      }

      // Add purchaser to show
      const showResult = await ticketService.addPurchaserToShow(showData.show_id, currentUser.id);
      if (!showResult.success) {
        console.error('Failed to add purchaser to show:', showResult.error);
      }

      // Send ticket confirmation notification
      await notificationService.createTicketPurchaseConfirmation(
        currentUser.id,
        showData.title,
        showData.show_id,
        showData.venue_name || 'the venue',
        showData.show_date || '',
        1,
        showData.ticket_price
      );

      // Success!
      Alert.alert(
        'Purchase Successful!',
        `Your ticket for ${showData?.title || 'the show'} has been purchased. You can find it in your profile under "Upcoming Shows".`,
        [
          {
            text: 'OK',
            onPress: () => {
              onPurchaseSuccess();
              onClose();
            },
          },
        ]
      );

    } catch (error) {
      console.error('Error creating ticket:', error);
      Alert.alert('Error', 'Payment was successful but there was an error creating your ticket. Please contact support.');
    }
  };

  // For TEST MODE - simulate successful purchase without Stripe UI
  const handleTestPurchase = async () => {
    if (!currentUser) {
      ToastManager.error('Please log in to purchase tickets');
      return;
    }

    try {
      setLoading(true);

      // Create payment intent (will be mock in test mode)
      const paymentResult = await paymentService.createTicketPaymentIntent(
        showData.show_id,
        showData.title,
        showData.ticket_price,
        1,
        currentUser.id,
        showData.venue_id
      );

      if (!paymentResult.success) {
        ToastManager.error(paymentResult.error || 'Payment failed');
        return;
      }

      // Simulate payment delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Create the ticket with mock payment ID
      await createTicket(paymentResult.paymentIntentId || `pi_test_${Date.now()}`);

    } catch (error) {
      console.error('Error in test purchase:', error);
      ToastManager.error('Something went wrong with your purchase');
    } finally {
      setLoading(false);
    }
  };

  // Don't render modal if showData is null
  if (!showData) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#2a2882', '#ff00ff']}
            style={styles.modalGradient}
          >
            <Text style={styles.modalTitle}>Purchase Ticket</Text>

            <View style={styles.ticketInfo}>
              <Text style={styles.showTitle}>{showData?.title || 'Show'}</Text>
              {showData?.venue_name && (
                <Text style={styles.venueText}>at {showData.venue_name}</Text>
              )}
              {showData?.show_date && (
                <Text style={styles.showDetails}>
                  {formatShowDate(showData.show_date)}
                  {showData.show_time && ` at ${showData.show_time}`}
                </Text>
              )}
              <Text style={styles.priceText}>${showData?.ticket_price || '0'}</Text>
            </View>

            <View style={styles.buttonContainer}>
              {/* Show appropriate button based on mode and Stripe availability */}
              {(STRIPE_CONFIG.IS_TEST_MODE || !initPaymentSheet) ? (
                <TouchableOpacity
                  style={[styles.purchaseButton, loading && styles.disabledButton]}
                  onPress={handleTestPurchase}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.purchaseButtonText}>
                      Purchase Ticket {STRIPE_CONFIG.IS_TEST_MODE ? '(Test)' : ''}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.purchaseButton, loading && styles.disabledButton]}
                  onPress={handlePurchase}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.purchaseButtonText}>
                      Purchase Ticket
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            {(STRIPE_CONFIG.IS_TEST_MODE || !initPaymentSheet) && (
              <Text style={styles.testModeText}>
                {!initPaymentSheet ? 'Dev mode - Stripe requires production build' : 'Test mode - No real charges'}
              </Text>
            )}
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  modalContainer: {
    width: SCREEN_WIDTH - 40,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 10000,
  },
  modalGradient: {
    padding: 30,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  ticketInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
    width: '100%',
    alignItems: 'center',
  },
  showTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  venueText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 8,
  },
  showDetails: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 12,
  },
  priceText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00ff00',
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 15,
  },
  purchaseButton: {
    backgroundColor: '#00ff00',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  purchaseButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#fff',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  testModeText: {
    marginTop: 15,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
});

export default TicketPurchaseModal;
