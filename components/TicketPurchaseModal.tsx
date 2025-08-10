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
// TODO: Enable Stripe when properly configured
// import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../lib/supabase';
import { ticketService } from '../services/ticketService';
import { v4 as uuidv4 } from 'uuid';
import { formatShowDate } from '../utils/dateUtils';

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
  // TODO: Enable Stripe when properly configured
  // const { initPaymentSheet, presentPaymentSheet } = useStripe();

  useEffect(() => {
    if (visible) {
      getCurrentUser();
    }
  }, [visible]);

  const getCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      setCurrentUser(user);
    } catch (error) {
      console.error('Error getting current user:', error);
      Alert.alert('Error', 'Unable to get user information');
    }
  };

  const createPaymentIntent = async () => {
    try {
      console.log('Creating payment intent for:', showData);
      
      // Convert price to cents for Stripe
      const amountInCents = Math.round(showData.ticket_price * 100);
      
      // TODO: Replace with your backend endpoint
      // For now, we'll simulate the payment intent creation
      const response = await fetch('YOUR_BACKEND_URL/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInCents,
          currency: 'usd',
          metadata: {
            show_id: showData.show_id,
            purchaser_id: currentUser?.id,
          },
        }),
      });

      const { client_secret } = await response.json();
      return client_secret;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      // For development/testing, return a mock client secret
      return 'pi_test_mock_client_secret';
    }
  };

  const initializePaymentSheet = async () => {
    try {
      setLoading(true);
      
      const clientSecret = await createPaymentIntent();
      
      // TODO: Enable Stripe when properly configured
      /* const { error } = await initPaymentSheet({
        merchantDisplayName: 'ShowSpot',
        paymentIntentClientSecret: clientSecret,
        defaultBillingDetails: {
          name: currentUser?.user_metadata?.full_name || 'User',
          email: currentUser?.email,
        },
        allowsDelayedPaymentMethods: false,
      }); */

      // TODO: Enable Stripe error handling when properly configured
      /* if (error) {
        console.error('Error initializing payment sheet:', error);
        Alert.alert('Error', 'Unable to initialize payment');
        return false;
      } */

      return true;
    } catch (error) {
      console.error('Error in initializePaymentSheet:', error);
      Alert.alert('Error', 'Unable to setup payment');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'Please log in to purchase tickets');
      return;
    }

    try {
      setLoading(true);

      // Initialize payment sheet
      const initialized = await initializePaymentSheet();
      if (!initialized) return;

      // TODO: Enable Stripe payment sheet when properly configured
      /* const { error: paymentError } = await presentPaymentSheet(); */

      // TODO: Enable Stripe payment error handling when properly configured
      /* if (paymentError) {
        if (paymentError.code !== 'Canceled') {
          console.error('Payment error:', paymentError);
          Alert.alert('Payment Failed', paymentError.message);
        }
        return;
      } */

      // Payment successful, create ticket
      await createTicket();
      
    } catch (error) {
      console.error('Error in handlePurchase:', error);
      Alert.alert('Error', 'Something went wrong with your purchase');
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async () => {
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
        stripe_payment_intent_id: 'pi_test_mock', // In production, get from Stripe
      });

      if (!ticketResult.success) {
        throw new Error(ticketResult.error || 'Failed to create ticket');
      }

      // Add purchaser to show
      console.log('About to add purchaser to show:', { show_id: showData.show_id, user_id: currentUser.id });
      const showResult = await ticketService.addPurchaserToShow(showData.show_id, currentUser.id);
      if (!showResult.success) {
        console.error('❌ FAILED to add purchaser to show:', showResult.error);
        Alert.alert('Warning', 'Ticket purchased but show count may not update immediately');
      } else {
        console.log('✅ Successfully added purchaser to show');
      }

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

  // For development/testing - simulate successful purchase
  const handleTestPurchase = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'Please log in to purchase tickets');
      return;
    }

    try {
      setLoading(true);
      
      // Simulate payment delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await createTicket();
      
    } catch (error) {
      console.error('Error in test purchase:', error);
      Alert.alert('Error', 'Something went wrong with your purchase');
    } finally {
      setLoading(false);
    }
  };

  // Don't render modal if showData is null
  if (!showData) {
    console.log('TicketPurchaseModal: showData is null, not rendering');
    return null;
  }
  
  console.log('TicketPurchaseModal: Rendering with showData:', showData);

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
              {showData?.show_date && (
                <Text style={styles.showDetails}>
                  {formatShowDate(showData.show_date)}
                  {showData.show_time && ` at ${showData.show_time}`}
                </Text>
              )}
              <Text style={styles.priceText}>${showData?.ticket_price || '0'}</Text>
            </View>

            <View style={styles.buttonContainer}>
              {/* For development, use test purchase */}
              <TouchableOpacity
                style={[styles.purchaseButton, loading && styles.disabledButton]}
                onPress={handleTestPurchase}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.purchaseButtonText}>
                    Purchase Ticket (Test)
                  </Text>
                )}
              </TouchableOpacity>

              {/* Uncomment for production Stripe */}
              {/* <TouchableOpacity
                style={[styles.purchaseButton, loading && styles.disabledButton]}
                onPress={handlePurchase}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.purchaseButtonText}>
                    Purchase with Stripe
                  </Text>
                )}
              </TouchableOpacity> */}

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
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
});

export default TicketPurchaseModal;