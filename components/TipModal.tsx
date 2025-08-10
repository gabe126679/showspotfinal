import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tipsService, EntityType, TipPayload } from '../services/tipsService';
import { supabase } from '../lib/supabase';

interface TipModalProps {
  visible: boolean;
  onClose: () => void;
  recipientId: string;
  recipientType: EntityType;
  recipientName: string;
}

const TipModal: React.FC<TipModalProps> = ({
  visible,
  onClose,
  recipientId,
  recipientType,
  recipientName,
}) => {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [tipMessage, setTipMessage] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const predefinedAmounts = tipsService.getPredefinedTipAmounts();

  useEffect(() => {
    if (visible) {
      getCurrentUser();
      resetForm();
    }
  }, [visible]);

  const getCurrentUser = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        setCurrentUser(sessionData.session.user);
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const resetForm = () => {
    setSelectedAmount(null);
    setCustomAmount('');
    setTipMessage('');
    setProcessing(false);
  };

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (text: string) => {
    // Allow only numbers and decimal point
    const numericText = text.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const parts = numericText.split('.');
    if (parts.length > 2) {
      return;
    }
    
    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      return;
    }

    setCustomAmount(numericText);
    setSelectedAmount(null);
  };

  const getFinalAmount = (): number | null => {
    if (selectedAmount !== null) {
      return selectedAmount;
    }
    
    if (customAmount) {
      const amount = parseFloat(customAmount);
      return isNaN(amount) ? null : amount;
    }
    
    return null;
  };

  const handleSendTip = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'Please log in to send tips');
      return;
    }

    const finalAmount = getFinalAmount();
    if (!finalAmount) {
      Alert.alert('Error', 'Please select or enter a tip amount');
      return;
    }

    // Validate amount
    const validation = tipsService.validateTipAmount(finalAmount);
    if (!validation.valid) {
      Alert.alert('Invalid Amount', validation.error);
      return;
    }

    try {
      setProcessing(true);

      // In a real app, you would integrate with Stripe here
      // For now, we'll simulate the payment process
      
      // Create payment intent (mock for development)
      const paymentIntentResult = await tipsService.createTipPaymentIntent(
        finalAmount,
        recipientId,
        recipientType
      );

      if (!paymentIntentResult.success) {
        throw new Error(paymentIntentResult.error);
      }

      // Process the tip
      const tipPayload: TipPayload = {
        recipientId,
        recipientType,
        amount: finalAmount,
        message: tipMessage.trim() || undefined
      };

      const result = await tipsService.processTip(
        currentUser.id,
        tipPayload,
        paymentIntentResult.data?.paymentIntentId
      );

      if (result.success) {
        Alert.alert(
          'Tip Sent! 🎉',
          `Your ${tipsService.formatCurrency(finalAmount)} tip has been sent to ${recipientName}!`,
          [
            {
              text: 'OK',
              onPress: () => {
                onClose();
                resetForm();
              }
            }
          ]
        );
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error sending tip:', error);
      Alert.alert(
        'Payment Failed',
        error instanceof Error ? error.message : 'Failed to process tip. Please try again.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const finalAmount = getFinalAmount();
  const canSendTip = finalAmount && finalAmount > 0 && !processing;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView 
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContent}>
          <LinearGradient
            colors={["#2a2882", "#ff00ff"]}
            style={styles.modalHeader}
          >
            <Text style={styles.modalTitle}>Tip {recipientName}</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
              disabled={processing}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.modalBody}>
            {/* Predefined Amounts */}
            <Text style={styles.sectionTitle}>Select Amount</Text>
            <View style={styles.amountGrid}>
              {predefinedAmounts.map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.amountButton,
                    selectedAmount === amount && styles.amountButtonSelected
                  ]}
                  onPress={() => handleAmountSelect(amount)}
                  disabled={processing}
                >
                  <Text style={[
                    styles.amountButtonText,
                    selectedAmount === amount && styles.amountButtonTextSelected
                  ]}>
                    ${amount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Amount */}
            <Text style={styles.sectionTitle}>Or Enter Custom Amount</Text>
            <View style={styles.customAmountContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.customAmountInput}
                value={customAmount}
                onChangeText={handleCustomAmountChange}
                placeholder="0.00"
                keyboardType="decimal-pad"
                editable={!processing}
              />
            </View>

            {/* Tip Message */}
            <Text style={styles.sectionTitle}>Add a Message (Optional)</Text>
            <TextInput
              style={styles.messageInput}
              value={tipMessage}
              onChangeText={setTipMessage}
              placeholder="Say something nice..."
              multiline
              numberOfLines={3}
              maxLength={200}
              editable={!processing}
            />

            {/* Total Display */}
            {finalAmount && (
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Total Tip:</Text>
                <Text style={styles.totalAmount}>
                  {tipsService.formatCurrency(finalAmount)}
                </Text>
              </View>
            )}

            {/* Band Split Info */}
            {recipientType === 'band' && finalAmount && (
              <View style={styles.infoContainer}>
                <Text style={styles.infoText}>
                  💡 This tip will be split evenly among all band members
                </Text>
              </View>
            )}

            {/* Send Button */}
            <TouchableOpacity
              style={[
                styles.sendButton,
                !canSendTip && styles.sendButtonDisabled
              ]}
              onPress={handleSendTip}
              disabled={!canSendTip}
            >
              <LinearGradient
                colors={canSendTip ? ["#ff00ff", "#2a2882"] : ["#ccc", "#999"]}
                style={styles.sendButtonGradient}
              >
                {processing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.sendButtonText}>
                    Send Tip {finalAmount ? tipsService.formatCurrency(finalAmount) : ''}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.disclaimerText}>
              Payments are processed securely through Stripe
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    maxHeight: '90%',
    width: '90%',
    maxWidth: 400,
    overflow: 'hidden',
    zIndex: 10000,
    elevation: 10000,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Audiowide-Regular',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    marginTop: 10,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  amountButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    minWidth: 70,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  amountButtonSelected: {
    backgroundColor: '#ff00ff',
    borderColor: '#ff00ff',
  },
  amountButtonText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#333',
  },
  amountButtonTextSelected: {
    color: '#fff',
  },
  customAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  currencySymbol: {
    fontSize: 18,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#333',
    marginRight: 5,
  },
  customAmountInput: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Amiko-Regular',
    color: '#333',
    paddingVertical: 15,
  },
  messageInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    padding: 15,
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#333',
    textAlignVertical: 'top',
    marginBottom: 20,
    minHeight: 80,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  totalLabel: {
    fontSize: 18,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#333',
  },
  totalAmount: {
    fontSize: 20,
    fontFamily: 'Audiowide-Regular',
    color: '#ff00ff',
    fontWeight: 'bold',
  },
  infoContainer: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#856404',
    textAlign: 'center',
  },
  sendButton: {
    marginBottom: 15,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  sendButtonText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#fff',
  },
  disclaimerText: {
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default TipModal;