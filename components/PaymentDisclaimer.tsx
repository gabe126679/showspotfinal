import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PaymentDisclaimerProps {
  visible: boolean;
  onClose: () => void;
  onProceed: () => void;
  action: string; // "purchase", "tip", "buy ticket", etc.
  itemName?: string; // song name, ticket type, etc.
}

const PaymentDisclaimer: React.FC<PaymentDisclaimerProps> = ({
  visible,
  onClose,
  onProceed,
  action,
  itemName
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={['#ff00ff', '#2a2882']}
            style={styles.header}
          >
            <Text style={styles.headerIcon}>ℹ️</Text>
            <Text style={styles.headerTitle}>PAYMENT NOTICE</Text>
          </LinearGradient>
          
          <View style={styles.content}>
            <Text style={styles.title}>
              Payment Processing Information
            </Text>
            
            <Text style={styles.message}>
              You are about to {action} {itemName ? `"${itemName}"` : ''}.
            </Text>
            
            <View style={styles.bulletPoints}>
              <Text style={styles.bullet}>• Secure payment processing</Text>
              <Text style={styles.bullet}>• All transactions are protected</Text>
              <Text style={styles.bullet}>• Your information is encrypted</Text>
              <Text style={styles.bullet}>• Powered by Stripe</Text>
            </View>
            
            <Text style={styles.footer}>
              By proceeding, you agree to our terms and conditions.
            </Text>
          </View>
          
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.proceedButton} onPress={onProceed}>
              <LinearGradient
                colors={['#ff00ff', '#2a2882']}
                style={styles.proceedGradient}
              >
                <Text style={styles.proceedText}>Proceed</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 400,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Amiko-Regular',
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  message: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#555',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  bulletPoints: {
    marginBottom: 20,
  },
  bullet: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  footer: {
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttons: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#eee',
  },
  cancelText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    fontWeight: '500',
  },
  proceedButton: {
    flex: 1,
  },
  proceedGradient: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  proceedText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#fff',
    fontWeight: '600',
  },
});

export default PaymentDisclaimer;