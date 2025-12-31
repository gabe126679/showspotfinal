// UserTypeSelection Component
// Post-signup screen to personalize user experience
// Based on 2025 best practices: action-oriented, quick personalization

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, G } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'UserTypeSelection'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STORAGE_KEY = '@showspot_user_type';

// User type icons
const FanIcon = ({ selected }: { selected: boolean }) => (
  <Svg width={48} height={48} viewBox="0 0 48 48">
    <Circle cx="24" cy="24" r="22" fill={selected ? 'rgba(255, 0, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'} />
    {/* Heart/fan icon */}
    <Path
      d="M24 38s-12-8.35-12-16c0-4.42 3.58-8 8-8 2.83 0 5.3 1.47 6.72 3.69A7.974 7.974 0 0132 14c4.42 0 8 3.58 8 8 0 7.65-12 16-12 16h-4z"
      fill={selected ? '#ff00ff' : 'rgba(255, 255, 255, 0.4)'}
    />
    {/* Music note */}
    <Path
      d="M28 20v8.55c-.59-.34-1.27-.55-2-.55-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3v-6h3v-5h-4z"
      fill={selected ? '#fff' : 'rgba(255, 255, 255, 0.6)'}
    />
  </Svg>
);

const ArtistIcon = ({ selected }: { selected: boolean }) => (
  <Svg width={48} height={48} viewBox="0 0 48 48">
    <Circle cx="24" cy="24" r="22" fill={selected ? 'rgba(139, 0, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'} />
    {/* Microphone icon */}
    <Path
      d="M24 28c2.76 0 5-2.24 5-5V15c0-2.76-2.24-5-5-5s-5 2.24-5 5v8c0 2.76 2.24 5 5 5z"
      fill={selected ? '#8b00ff' : 'rgba(255, 255, 255, 0.4)'}
    />
    <Path
      d="M31 23c0 3.87-3.13 7-7 7s-7-3.13-7-7h-2c0 4.72 3.58 8.62 8.19 9.32V36h-3.19v2h8v-2h-3.19v-3.68C29.42 31.62 33 27.72 33 23h-2z"
      fill={selected ? '#8b00ff' : 'rgba(255, 255, 255, 0.4)'}
    />
    {/* Star accent */}
    <Path
      d="M34 12l1 2 2 .5-1.5 1.5.5 2-2-1-2 1 .5-2-1.5-1.5 2-.5 1-2z"
      fill={selected ? '#ff00ff' : 'rgba(255, 255, 255, 0.3)'}
    />
  </Svg>
);

const VenueIcon = ({ selected }: { selected: boolean }) => (
  <Svg width={48} height={48} viewBox="0 0 48 48">
    <Circle cx="24" cy="24" r="22" fill={selected ? 'rgba(42, 40, 130, 0.3)' : 'rgba(255, 255, 255, 0.05)'} />
    {/* Building icon */}
    <Path
      d="M12 38h24V18L24 10 12 18v20zm4-18h4v4h-4v-4zm0 6h4v4h-4v-4zm8-6h4v4h-4v-4zm0 6h4v4h-4v-4zm8-6h4v4h-4v-4zm0 6h4v4h-4v-4z"
      fill={selected ? '#2a2882' : 'rgba(255, 255, 255, 0.4)'}
    />
    {/* Stage lights */}
    <G>
      <Circle cx="18" cy="14" r="2" fill={selected ? '#ff00ff' : 'rgba(255, 255, 255, 0.2)'} />
      <Circle cx="30" cy="14" r="2" fill={selected ? '#8b00ff' : 'rgba(255, 255, 255, 0.2)'} />
    </G>
  </Svg>
);

export type UserType = 'fan' | 'artist' | 'venue' | null;

interface UserTypeOption {
  type: UserType;
  title: string;
  subtitle: string;
  description: string;
  icon: (props: { selected: boolean }) => React.ReactElement;
  gradient: string[];
}

const USER_TYPES: UserTypeOption[] = [
  {
    type: 'fan',
    title: "I'm a Fan",
    subtitle: 'Discover & Support',
    description: 'Find shows, buy tickets, and support local artists',
    icon: FanIcon,
    gradient: ['#ff00ff', '#8b00ff'],
  },
  {
    type: 'artist',
    title: "I'm an Artist",
    subtitle: 'Perform & Earn',
    description: 'Book shows, sell music, and grow your fanbase',
    icon: ArtistIcon,
    gradient: ['#8b00ff', '#2a2882'],
  },
  {
    type: 'venue',
    title: "I'm a Venue",
    subtitle: 'Host & Promote',
    description: 'Host shows, discover talent, and fill your calendar',
    icon: VenueIcon,
    gradient: ['#2a2882', '#1a1035'],
  },
];

const UserTypeSelection: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [selectedType, setSelectedType] = useState<UserType>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const cardAnims = useRef(USER_TYPES.map(() => new Animated.Value(0))).current;

  const navigateToMain = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'BottomTabs' }],
      })
    );
  };

  // Check if user has already selected a type
  useEffect(() => {
    const checkExistingType = async () => {
      const existingType = await getUserType();
      if (existingType) {
        // Already selected, skip to main app
        navigateToMain();
      }
    };
    checkExistingType();
  }, []);

  useEffect(() => {
    // Header animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Staggered card animations
    Animated.stagger(
      100,
      cardAnims.map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        })
      )
    ).start();
  }, []);

  const handleSelect = (type: UserType) => {
    setSelectedType(type);
  };

  const handleContinue = async () => {
    if (selectedType) {
      // Save user type preference
      await AsyncStorage.setItem(STORAGE_KEY, selectedType);
      navigateToMain();
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'fan'); // Default to fan
    navigateToMain();
  };

  return (
    <LinearGradient
      colors={['#0a0a0f', '#1a1035', '#0a0a0f']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.welcomeText}>Welcome to ShowSpot!</Text>
          <Text style={styles.title}>How will you use the app?</Text>
          <Text style={styles.subtitle}>
            This helps us personalize your experience
          </Text>
        </Animated.View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {USER_TYPES.map((option, index) => {
            const isSelected = selectedType === option.type;
            const Icon = option.icon;

            return (
              <Animated.View
                key={option.type}
                style={{
                  opacity: cardAnims[index],
                  transform: [
                    {
                      translateX: cardAnims[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [-30, 0],
                      }),
                    },
                  ],
                }}
              >
                <Pressable
                  onPress={() => handleSelect(option.type)}
                  style={({ pressed }) => [
                    styles.optionCard,
                    isSelected && styles.optionCardSelected,
                    pressed && styles.optionCardPressed,
                  ]}
                >
                  {isSelected && (
                    <LinearGradient
                      colors={option.gradient as any}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.selectedGradient}
                    />
                  )}
                  <View style={styles.optionContent}>
                    <View style={styles.iconContainer}>
                      <Icon selected={isSelected} />
                    </View>
                    <View style={styles.optionTextContainer}>
                      <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                        {option.title}
                      </Text>
                      <Text style={[styles.optionSubtitle, isSelected && styles.optionSubtitleSelected]}>
                        {option.subtitle}
                      </Text>
                      <Text style={[styles.optionDescription, isSelected && styles.optionDescriptionSelected]}>
                        {option.description}
                      </Text>
                    </View>
                    {/* Checkmark */}
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && (
                        <Svg width={16} height={16} viewBox="0 0 16 16">
                          <Path
                            d="M6 10.5L3.5 8l-1 1 3.5 3.5 7.5-7.5-1-1L6 10.5z"
                            fill="#fff"
                          />
                        </Svg>
                      )}
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {/* Helper text */}
        <Animated.View style={[styles.helperContainer, { opacity: fadeAnim }]}>
          <Text style={styles.helperText}>
            Don't worry, you can always change this later in settings
          </Text>
        </Animated.View>

        {/* Bottom buttons */}
        <View style={styles.bottomContainer}>
          <Pressable
            onPress={handleSkip}
            style={styles.skipButton}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </Pressable>

          <Pressable
            onPress={handleContinue}
            disabled={!selectedType}
            style={({ pressed }) => [
              styles.continueButtonWrapper,
              !selectedType && styles.continueButtonDisabled,
              pressed && selectedType && styles.buttonPressed,
            ]}
          >
            <LinearGradient
              colors={selectedType ? ['#ff00ff', '#8b00ff', '#2a2882'] : ['#333', '#222']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.continueButton}
            >
              <Text style={[styles.continueButtonText, !selectedType && styles.continueButtonTextDisabled]}>
                Continue
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

// Helper to get stored user type
export const getUserType = async (): Promise<UserType> => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return (value as UserType) || null;
  } catch {
    return null;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    marginTop: 20,
    marginBottom: 30,
  },
  welcomeText: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#ff00ff',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Audiowide-Regular',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Amiko-Regular',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  optionsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  optionCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  optionCardSelected: {
    borderColor: 'rgba(255, 0, 255, 0.5)',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  optionCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  selectedGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.15,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontFamily: 'Amiko-Bold',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  optionTitleSelected: {
    color: '#ffffff',
  },
  optionSubtitle: {
    fontSize: 13,
    fontFamily: 'Amiko-SemiBold',
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 2,
  },
  optionSubtitleSelected: {
    color: '#ff00ff',
  },
  optionDescription: {
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    color: 'rgba(255, 255, 255, 0.35)',
    marginTop: 4,
  },
  optionDescriptionSelected: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  checkboxSelected: {
    backgroundColor: '#ff00ff',
    borderColor: '#ff00ff',
  },
  helperContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  helperText: {
    fontSize: 13,
    fontFamily: 'Amiko-Regular',
    color: 'rgba(255, 255, 255, 0.35)',
  },
  bottomContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  skipButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  skipButtonText: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  continueButtonWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  continueButton: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: 'Amiko-Bold',
    color: '#ffffff',
    letterSpacing: 1,
  },
  continueButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
});

export default UserTypeSelection;
