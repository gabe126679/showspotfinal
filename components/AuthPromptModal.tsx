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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AuthPromptModalProps {
  visible: boolean;
  onClose: () => void;
  action?: string; // What the user was trying to do
}

const ACTION_MESSAGES: Record<string, { title: string; message: string }> = {
  tip: {
    title: 'Support Your Favorites',
    message: 'Create an account to tip artists, bands, and venues you love.',
  },
  purchase_song: {
    title: 'Own the Music',
    message: 'Sign up to purchase and keep songs in your personal library.',
  },
  purchase_album: {
    title: 'Get the Full Album',
    message: 'Create an account to purchase albums and support artists.',
  },
  purchase_ticket: {
    title: 'Get Your Tickets',
    message: 'Sign up to purchase tickets and never miss a show.',
  },
  profile: {
    title: 'Your ShowSpot Profile',
    message: 'Create an account to build your profile, save favorites, and track your music journey.',
  },
  create: {
    title: 'Share Your Music',
    message: 'Sign up to create shows, upload music, and connect with fans.',
  },
  playlist: {
    title: 'Build Your Playlists',
    message: 'Create an account to make playlists and save your favorite tracks.',
  },
  default: {
    title: 'Join ShowSpot',
    message: 'Create a free account to unlock all features and support live music.',
  },
};

const AuthPromptModal: React.FC<AuthPromptModalProps> = ({
  visible,
  onClose,
  action = 'default',
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { title, message } = ACTION_MESSAGES[action] || ACTION_MESSAGES.default;

  const handleSignUp = () => {
    onClose();
    navigation.navigate('Signup');
  };

  const handleLogin = () => {
    onClose();
    navigation.navigate('Login');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={['#1a1035', '#0a0a0f']}
            style={styles.gradient}
          >
            {/* Close button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>x</Text>
            </TouchableOpacity>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              {/* Sign Up Button */}
              <TouchableOpacity onPress={handleSignUp} style={styles.signUpButtonWrapper}>
                <LinearGradient
                  colors={['#ff00ff', '#8b00ff', '#2a2882']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.signUpButton}
                >
                  <Text style={styles.signUpButtonText}>Create Account</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Login Link */}
              <TouchableOpacity onPress={handleLogin} style={styles.loginButton}>
                <Text style={styles.loginButtonText}>
                  Already have an account? <Text style={styles.loginLink}>Log In</Text>
                </Text>
              </TouchableOpacity>

              {/* Continue Browsing */}
              <TouchableOpacity onPress={onClose} style={styles.continueButton}>
                <Text style={styles.continueButtonText}>Continue Browsing</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: SCREEN_WIDTH - 48,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.3)',
  },
  gradient: {
    padding: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
  closeButtonText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 24,
    fontWeight: '300',
  },
  content: {
    alignItems: 'center',
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Audiowide-Regular',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: '#ff00ff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  message: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 24,
  },
  signUpButtonWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  signUpButton: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  signUpButtonText: {
    fontSize: 17,
    fontFamily: 'Amiko-Bold',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  loginButton: {
    marginBottom: 20,
  },
  loginButtonText: {
    fontSize: 15,
    fontFamily: 'Amiko-Regular',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  loginLink: {
    color: '#ff00ff',
    fontFamily: 'Amiko-Bold',
  },
  continueButton: {
    paddingVertical: 8,
  },
  continueButtonText: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: 'rgba(255, 255, 255, 0.5)',
  },
});

export default AuthPromptModal;
