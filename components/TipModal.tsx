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
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tipsService, EntityType, TipPayload } from '../services/tipsService';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/userContext';
import AuthPromptModal from './AuthPromptModal';

interface TipModalProps {
  visible: boolean;
  onClose: () => void;
  recipientId: string;
  recipientType: EntityType;
  recipientName: string;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const TipModal: React.FC<TipModalProps> = ({
  visible,
  onClose,
  recipientId,
  recipientType,
  recipientName,
}) => {
  const [currentStep, setCurrentStep] = useState<'amount' | 'message' | 'confirm'>('amount');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [tipMessage, setTipMessage] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const { isGuest, user } = useUser();
  const predefinedAmounts = tipsService.getPredefinedTipAmounts();

  useEffect(() => {
    if (visible) {
      // If user is a guest, show auth prompt instead
      if (isGuest || !user) {
        setShowAuthPrompt(true);
        return;
      }
      getCurrentUser();
      resetForm();
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
        action="tip"
      />
    );
  }

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
    setCurrentStep('amount');
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

  const handleNextStep = () => {
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

    setCurrentStep('message');
  };

  const handlePreviousStep = () => {
    if (currentStep === 'message') {
      setCurrentStep('amount');
    } else if (currentStep === 'confirm') {
      setCurrentStep('message');
    }
  };

  const handleSkipMessage = () => {
    setCurrentStep('confirm');
  };

  const handleAddMessage = () => {
    setCurrentStep('confirm');
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

  const renderAmountStep = () => (
    <>
      <Text style={styles.stepTitle}>How much would you like to tip?</Text>
      
      {/* Predefined Amounts */}
      <View style={styles.amountGrid}>
        {predefinedAmounts.map((amount) => (
          <TouchableOpacity
            key={amount}
            style={[
              styles.amountButton,
              selectedAmount === amount && styles.amountButtonSelected
            ]}
            onPress={() => handleAmountSelect(amount)}
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
      <Text style={styles.orText}>Or enter custom amount</Text>
      <View style={styles.customAmountContainer}>
        <Text style={styles.currencySymbol}>$</Text>
        <TextInput
          style={styles.customAmountInput}
          value={customAmount}
          onChangeText={handleCustomAmountChange}
          placeholder="0.00"
          keyboardType="decimal-pad"
          placeholderTextColor="#999"
        />
      </View>

      {/* Next Button */}
      <TouchableOpacity
        style={[
          styles.primaryButton,
          !finalAmount && styles.primaryButtonDisabled
        ]}
        onPress={handleNextStep}
        disabled={!finalAmount}
      >
        <LinearGradient
          colors={finalAmount ? ["#ff00ff", "#2a2882"] : ["#ccc", "#999"]}
          style={styles.primaryButtonGradient}
        >
          <Text style={styles.primaryButtonText}>
            Next {finalAmount ? `(${tipsService.formatCurrency(finalAmount)})` : ''}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </>
  );

  const renderMessageStep = () => (
    <>
      <TouchableOpacity onPress={handlePreviousStep} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.stepTitle}>Add a message (optional)</Text>
      <Text style={styles.stepSubtitle}>
        Let {recipientName} know you appreciate them!
      </Text>

      <TextInput
        style={styles.messageInput}
        value={tipMessage}
        onChangeText={setTipMessage}
        placeholder="Say something nice..."
        placeholderTextColor="#999"
        multiline
        numberOfLines={4}
        maxLength={200}
        textAlignVertical="top"
        autoFocus
      />

      <Text style={styles.characterCount}>
        {tipMessage.length}/200 characters
      </Text>

      <View style={styles.messageButtons}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleSkipMessage}
        >
          <Text style={styles.secondaryButtonText}>Skip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleAddMessage}
        >
          <LinearGradient
            colors={["#ff00ff", "#2a2882"]}
            style={styles.primaryButtonGradient}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderConfirmStep = () => (
    <>
      <TouchableOpacity onPress={handlePreviousStep} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.stepTitle}>Confirm Your Tip</Text>

      {/* Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Recipient:</Text>
          <Text style={styles.summaryValue}>{recipientName}</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Amount:</Text>
          <Text style={styles.summaryAmount}>
            {tipsService.formatCurrency(finalAmount!)}
          </Text>
        </View>

        {tipMessage && (
          <View style={styles.summaryMessageContainer}>
            <Text style={styles.summaryLabel}>Message:</Text>
            <Text style={styles.summaryMessage}>"{tipMessage}"</Text>
          </View>
        )}
      </View>

      {/* Band Split Info */}
      {recipientType === 'band' && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            💡 This tip will be split evenly among all band members
          </Text>
        </View>
      )}

      {/* Send Button */}
      <TouchableOpacity
        style={[styles.primaryButton, processing && styles.primaryButtonDisabled]}
        onPress={handleSendTip}
        disabled={processing}
      >
        <LinearGradient
          colors={!processing ? ["#ff00ff", "#2a2882"] : ["#ccc", "#999"]}
          style={styles.primaryButtonGradient}
        >
          {processing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>
              Send Tip {tipsService.formatCurrency(finalAmount!)}
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <Text style={styles.disclaimerText}>
        Payments are processed securely through Stripe
      </Text>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalOverlay}>
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

              {/* Progress Indicator */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill,
                      { 
                        width: currentStep === 'amount' ? '33%' : 
                               currentStep === 'message' ? '66%' : '100%' 
                      }
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  Step {currentStep === 'amount' ? '1' : currentStep === 'message' ? '2' : '3'} of 3
                </Text>
              </View>

              <ScrollView 
                style={styles.modalBody}
                contentContainerStyle={styles.modalBodyContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {currentStep === 'amount' && renderAmountStep()}
                {currentStep === 'message' && renderMessageStep()}
                {currentStep === 'confirm' && renderConfirmStep()}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SCREEN_HEIGHT * 0.75,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    paddingTop: 20,
  },
  modalTitle: {
    fontSize: 18,
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
  progressContainer: {
    padding: 10,
    backgroundColor: '#f8f9fa',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff00ff',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  modalBody: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalBodyContent: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 13,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  backButton: {
    marginBottom: 15,
  },
  backButtonText: {
    fontSize: 14,
    color: '#2a2882',
    fontWeight: '600',
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  amountButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    width: '30%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 10,
  },
  amountButtonSelected: {
    backgroundColor: '#ff00ff',
    borderColor: '#ff00ff',
  },
  amountButtonText: {
    fontSize: 18,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#333',
  },
  amountButtonTextSelected: {
    color: '#fff',
  },
  orText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginVertical: 15,
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
    marginHorizontal: 10,
  },
  currencySymbol: {
    fontSize: 20,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#333',
    marginRight: 5,
  },
  customAmountInput: {
    flex: 1,
    fontSize: 20,
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
    minHeight: 120,
    marginBottom: 10,
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginBottom: 20,
  },
  messageButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  primaryButton: {
    flex: 1,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonGradient: {
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#666',
  },
  summaryContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 20,
    marginVertical: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#333',
  },
  summaryAmount: {
    fontSize: 20,
    fontFamily: 'Audiowide-Regular',
    color: '#ff00ff',
    fontWeight: 'bold',
  },
  summaryMessageContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  summaryMessage: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#333',
    fontStyle: 'italic',
    marginTop: 5,
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
  disclaimerText: {
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 15,
  },
});

export default TipModal;