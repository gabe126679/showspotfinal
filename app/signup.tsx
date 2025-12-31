import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { ToastManager } from '../components/Toast';
import { useGoogleAuth, signInWithGoogleToken } from '../lib/oauth';
import { useUser } from '../context/userContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import Svg, { Path } from 'react-native-svg';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

// Google Icon Component
const GoogleIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </Svg>
);

// Guest Icon Component
const GuestIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
      fill="#9CA3AF"
    />
  </Svg>
);

const SignUp = ({ navigation }: Props) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'guest' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const { signInAsGuest } = useUser();

  // Google Auth hook
  const { request: googleRequest, response: googleResponse, promptAsync: googlePromptAsync } = useGoogleAuth();

  // Handle Google auth response
  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (googleResponse?.type === 'success') {
        console.log('Google auth success, authentication data received');
        setSocialLoading('google');
        setErrorMessage('');

        try {
          const { authentication } = googleResponse;

          if (authentication?.idToken) {
            const result = await signInWithGoogleToken(authentication.idToken);

            if (result.success) {
              if (result.needsProfile) {
                navigation.navigate('Picture');
              } else {
                navigation.navigate('BottomTabs');
              }
            } else {
              setErrorMessage(result.error || 'Google sign up failed');
              ToastManager.error(result.error || 'Google sign up failed');
            }
          } else {
            setErrorMessage('No ID token received from Google');
            ToastManager.error('No ID token received from Google');
          }
        } catch (e) {
          console.error('Error processing Google auth:', e);
          setErrorMessage('Failed to complete Google sign up');
          ToastManager.error('Failed to complete Google sign up');
        } finally {
          setSocialLoading(null);
        }
      } else if (googleResponse?.type === 'error') {
        console.error('Google auth error:', googleResponse.error);
        setErrorMessage('Google sign up failed');
        setSocialLoading(null);
      }
    };

    handleGoogleResponse();
  }, [googleResponse, navigation]);

  const handleSignUp = async () => {
    if (loading) return;
    if (!fullName || !email || !password) {
      ToastManager.error('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (signUpError) {
        console.error('Signup Error:', signUpError);
        ToastManager.error(signUpError.message);
        return navigation.navigate('Failure');
      }

      let user = null;
      for (let i = 0; i < 5; i++) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          user = sessionData.session.user;
          break;
        }
        await new Promise(res => setTimeout(res, 1000));
      }

      if (!user) {
        ToastManager.error('Could not retrieve session');
        return navigation.navigate('Failure');
      }

      // Use upsert to handle case where spotter record may already exist
      // (e.g., from a previous partial signup or database trigger)
      const { error: insertError } = await supabase.from('spotters').upsert(
        {
          id: user.id,
          full_name: fullName,
          email,
        },
        { onConflict: 'id' }
      );

      if (insertError) {
        console.error('Insert Error:', insertError);
        // If it's still a duplicate error, the record exists - just continue
        if (insertError.code !== '23505') {
          ToastManager.error(insertError.message);
          return navigation.navigate('Failure');
        }
      }

      navigation.navigate('Picture');

    } catch (err) {
      console.error('Unexpected Error:', err);
      ToastManager.error('Something went wrong');
      navigation.navigate('Failure');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignUp = async (provider: 'google' | 'guest') => {
    if (socialLoading || loading) return;

    setErrorMessage('');

    if (provider === 'google') {
      // Use the new Google auth flow with ID token
      if (googleRequest) {
        setSocialLoading('google');
        try {
          await googlePromptAsync();
          // Response will be handled by the useEffect above
        } catch (e) {
          console.error('Google prompt error:', e);
          ToastManager.error('Failed to open Google sign in');
          setSocialLoading(null);
        }
      } else {
        ToastManager.error('Google sign in is not ready. Please try again.');
      }
    } else if (provider === 'guest') {
      // Guest mode - navigate to user type selection for personalization
      try {
        setSocialLoading('guest');
        await signInAsGuest();
        navigation.navigate('UserTypeSelection');
      } catch (err) {
        console.error('Guest signup error:', err);
        ToastManager.error('An unexpected error occurred. Please try again.');
      } finally {
        setSocialLoading(null);
      }
    }
  };

  return (
    <LinearGradient
      colors={['#0a0a0f', '#1a1035', '#0a0a0f']}
      locations={[0, 0.5, 1]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join the ShowSpot community</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Create a password"
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              {/* Sign Up Button */}
              <Pressable
                onPress={handleSignUp}
                disabled={loading}
                style={({ pressed }) => [
                  styles.buttonWrapper,
                  pressed && styles.buttonPressed,
                  loading && styles.buttonDisabled
                ]}
              >
                <LinearGradient
                  colors={['#ff00ff', '#8b00ff', '#2a2882']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButton}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Create Account</Text>
                  )}
                </LinearGradient>
              </Pressable>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or sign up with</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Social Signup Buttons */}
              <View style={styles.socialButtonsContainer}>
                <Pressable
                  onPress={() => handleSocialSignUp('google')}
                  disabled={!!socialLoading || loading}
                  style={({ pressed }) => [
                    styles.socialButton,
                    pressed && styles.buttonPressed,
                    socialLoading === 'google' && styles.buttonDisabled
                  ]}
                >
                  {socialLoading === 'google' ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <GoogleIcon />
                      <Text style={styles.socialButtonText}>Google</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => handleSocialSignUp('guest')}
                  disabled={!!socialLoading || loading}
                  style={({ pressed }) => [
                    styles.socialButton,
                    pressed && styles.buttonPressed,
                    socialLoading === 'guest' && styles.buttonDisabled
                  ]}
                >
                  {socialLoading === 'guest' ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <GuestIcon />
                      <Text style={styles.socialButtonText}>Guest</Text>
                    </>
                  )}
                </Pressable>
              </View>

              {/* Login Link */}
              <Pressable
                onPress={() => navigation.navigate('Login')}
                style={({ pressed }) => [
                  styles.buttonWrapper,
                  { marginTop: 24 },
                  pressed && styles.buttonPressed
                ]}
              >
                <View style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>
                    Already have an account? <Text style={styles.linkText}>Log In</Text>
                  </Text>
                </View>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Decorative Elements */}
      <View style={styles.decorativeContainer}>
        <View style={[styles.decorativeCircle, styles.circle1]} />
        <View style={[styles.decorativeCircle, styles.circle2]} />
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Audiowide-Regular',
    color: '#ffffff',
    marginBottom: 8,
    textShadowColor: '#ff00ff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.5,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Amiko-SemiBold',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    width: '100%',
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 0, 255, 0.3)',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontFamily: 'Amiko-Regular',
    fontSize: 16,
    color: '#ffffff',
  },
  buttonWrapper: {
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonText: {
    fontSize: 18,
    fontFamily: 'Amiko-Bold',
    color: '#ffffff',
    letterSpacing: 1,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  dividerText: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 16,
  },
  secondaryButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  linkText: {
    color: '#ff00ff',
    fontFamily: 'Amiko-Bold',
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  socialButtonText: {
    fontSize: 15,
    fontFamily: 'Amiko-SemiBold',
    color: '#ffffff',
  },
  decorativeContainer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.08,
  },
  circle1: {
    width: 250,
    height: 250,
    backgroundColor: '#ff00ff',
    top: -80,
    right: -80,
  },
  circle2: {
    width: 180,
    height: 180,
    backgroundColor: '#2a2882',
    bottom: 50,
    left: -60,
  },
});

export default SignUp;
