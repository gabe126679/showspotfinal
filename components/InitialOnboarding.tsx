// InitialOnboarding Component
// Swipeable carousel for first-time users showcasing app value
// Based on 2025 best practices: quick wins, social proof, action-oriented

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  FlatList,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { onboardingService } from '../services/onboardingService';
import type { RootStackParamList } from '../App';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'InitialOnboarding'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Animated Icons for each slide
const MapDiscoverIcon = ({ scale }: { scale: Animated.Value }) => (
  <Animated.View style={{ transform: [{ scale }] }}>
    <Svg width={140} height={140} viewBox="0 0 140 140">
      <Defs>
        <RadialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#ff00ff" stopOpacity="0.4" />
          <Stop offset="100%" stopColor="#ff00ff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="70" cy="70" r="65" fill="url(#mapGlow)" />
      <Circle cx="70" cy="70" r="50" fill="rgba(255, 0, 255, 0.15)" stroke="#ff00ff" strokeWidth="2" />
      {/* Map pin */}
      <Path
        d="M70 35C57.85 35 48 44.85 48 57c0 16.88 22 38 22 38s22-21.12 22-38c0-12.15-9.85-22-22-22zm0 30c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"
        fill="#ff00ff"
      />
      {/* Pulse rings */}
      <Circle cx="70" cy="57" r="35" fill="none" stroke="#ff00ff" strokeWidth="1" opacity="0.3" />
      <Circle cx="70" cy="57" r="45" fill="none" stroke="#ff00ff" strokeWidth="1" opacity="0.15" />
    </Svg>
  </Animated.View>
);

const MusicSupportIcon = ({ scale }: { scale: Animated.Value }) => (
  <Animated.View style={{ transform: [{ scale }] }}>
    <Svg width={140} height={140} viewBox="0 0 140 140">
      <Defs>
        <RadialGradient id="musicGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#8b00ff" stopOpacity="0.4" />
          <Stop offset="100%" stopColor="#8b00ff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="70" cy="70" r="65" fill="url(#musicGlow)" />
      <Circle cx="70" cy="70" r="50" fill="rgba(139, 0, 255, 0.15)" stroke="#8b00ff" strokeWidth="2" />
      {/* Music note */}
      <Path
        d="M85 40v35.55c-1.77-1.02-3.81-1.55-6-1.55-6.63 0-12 5.37-12 12s5.37 12 12 12 12-5.37 12-12V52h10V40H85z"
        fill="#8b00ff"
      />
      {/* Dollar/tip symbol */}
      <G transform="translate(45, 55)">
        <Circle cx="12" cy="12" r="12" fill="rgba(255, 0, 255, 0.3)" />
        <Path d="M12 6v2m0 8v2m-4-8c0-1.1 1.79-2 4-2s4 .9 4 2-1.79 2-4 2-4 .9-4 2 1.79 2 4 2 4-.9 4-2" stroke="#ff00ff" strokeWidth="1.5" fill="none" />
      </G>
    </Svg>
  </Animated.View>
);

const TicketShowIcon = ({ scale }: { scale: Animated.Value }) => (
  <Animated.View style={{ transform: [{ scale }] }}>
    <Svg width={140} height={140} viewBox="0 0 140 140">
      <Defs>
        <RadialGradient id="ticketGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#2a2882" stopOpacity="0.5" />
          <Stop offset="100%" stopColor="#2a2882" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="70" cy="70" r="65" fill="url(#ticketGlow)" />
      <Circle cx="70" cy="70" r="50" fill="rgba(42, 40, 130, 0.2)" stroke="#2a2882" strokeWidth="2" />
      {/* Ticket shape */}
      <Path
        d="M105 55v-5c0-2.76-2.24-5-5-5H40c-2.76 0-5 2.24-5 5v5c2.76 0 5 2.24 5 5s-2.24 5-5 5v5c0 2.76 2.24 5 5 5h60c2.76 0 5-2.24 5-5v-5c-2.76 0-5-2.24-5-5s2.24-5 5-5z"
        fill="#2a2882"
      />
      {/* Ticket details */}
      <Path d="M50 55h25M50 63h15M50 71h20" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      {/* Checkmark */}
      <Circle cx="85" cy="63" r="8" fill="#ff00ff" />
      <Path d="M81 63l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  </Animated.View>
);

const CommunityIcon = ({ scale }: { scale: Animated.Value }) => (
  <Animated.View style={{ transform: [{ scale }] }}>
    <Svg width={140} height={140} viewBox="0 0 140 140">
      <Defs>
        <RadialGradient id="communityGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#ff00ff" stopOpacity="0.3" />
          <Stop offset="100%" stopColor="#8b00ff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="70" cy="70" r="65" fill="url(#communityGlow)" />
      <Circle cx="70" cy="70" r="50" fill="rgba(255, 0, 255, 0.1)" stroke="url(#communityGlow)" strokeWidth="2" />
      {/* People icons */}
      <G transform="translate(35, 45)">
        {/* Center person */}
        <Circle cx="35" cy="15" r="10" fill="#ff00ff" />
        <Path d="M35 28c-11 0-20 6-20 14h40c0-8-9-14-20-14z" fill="#ff00ff" />
        {/* Left person */}
        <Circle cx="10" cy="20" r="7" fill="#8b00ff" opacity="0.7" />
        <Path d="M10 30c-7 0-13 4-13 9h26c0-5-6-9-13-9z" fill="#8b00ff" opacity="0.7" />
        {/* Right person */}
        <Circle cx="60" cy="20" r="7" fill="#8b00ff" opacity="0.7" />
        <Path d="M60 30c-7 0-13 4-13 9h26c0-5-6-9-13-9z" fill="#8b00ff" opacity="0.7" />
      </G>
      {/* Connection lines */}
      <Path d="M50 70L70 55L90 70" stroke="#ff00ff" strokeWidth="1" opacity="0.5" strokeDasharray="3,3" />
    </Svg>
  </Animated.View>
);

interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: (props: { scale: Animated.Value }) => React.ReactElement;
  gradient: string[];
  stat?: { value: string; label: string };
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 'discover',
    title: 'Discover Live Music',
    subtitle: 'Near You',
    description: 'Find shows happening tonight at venues in your neighborhood. Never miss your favorite local artists.',
    icon: MapDiscoverIcon,
    gradient: ['#0a0a0f', '#1a1035', '#0a0a0f'],
  },
  {
    id: 'support',
    title: 'Support Artists',
    subtitle: 'Directly',
    description: 'Buy music, tip performers, and help local talent thrive. Your support goes straight to the artists.',
    icon: MusicSupportIcon,
    gradient: ['#0a0a0f', '#150a25', '#0a0a0f'],
  },
  {
    id: 'tickets',
    title: 'Get Tickets',
    subtitle: 'Instantly',
    description: 'Purchase tickets directly through the app. Get notified when your favorite artists announce new shows.',
    icon: TicketShowIcon,
    gradient: ['#0a0a0f', '#0a1525', '#0a0a0f'],
  },
  {
    id: 'community',
    title: 'Join the Community',
    subtitle: '',
    description: 'Connect with thousands of music lovers discovering live shows every day.',
    icon: CommunityIcon,
    gradient: ['#0a0a0f', '#1a1035', '#0a0a0f'],
    stat: { value: '10,000+', label: 'Music fans and growing' },
  },
];

const InitialOnboarding: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.8)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Check if user has already seen onboarding
  useEffect(() => {
    const checkOnboarding = async () => {
      const hasSeen = await onboardingService.hasSeenTutorial('welcome');
      if (hasSeen) {
        // Skip to welcome screen if already seen
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Welcome' }],
          })
        );
      } else {
        setHasCheckedOnboarding(true);
      }
    };
    checkOnboarding();
  }, [navigation]);

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.spring(iconScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Reset icon animation on slide change
  useEffect(() => {
    iconScale.setValue(0.8);
    Animated.spring(iconScale, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [currentIndex]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      if (index !== currentIndex && index >= 0 && index < SLIDES.length) {
        setCurrentIndex(index);
      }
    },
    [currentIndex]
  );

  const goToNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleComplete();
    }
  }, [currentIndex]);

  const navigateToWelcome = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      })
    );
  }, [navigation]);

  const handleComplete = useCallback(async () => {
    await onboardingService.markTutorialSeen('welcome');
    navigateToWelcome();
  }, [navigateToWelcome]);

  const handleSkip = useCallback(async () => {
    await onboardingService.markTutorialSeen('welcome');
    navigateToWelcome();
  }, [navigateToWelcome]);

  const renderSlide = useCallback(
    ({ item, index }: { item: OnboardingSlide; index: number }) => {
      const inputRange = [
        (index - 1) * SCREEN_WIDTH,
        index * SCREEN_WIDTH,
        (index + 1) * SCREEN_WIDTH,
      ];

      const opacity = scrollX.interpolate({
        inputRange,
        outputRange: [0.3, 1, 0.3],
        extrapolate: 'clamp',
      });

      const translateY = scrollX.interpolate({
        inputRange,
        outputRange: [30, 0, 30],
        extrapolate: 'clamp',
      });

      const Icon = item.icon;

      return (
        <LinearGradient colors={item.gradient as any} style={styles.slide}>
          <Animated.View
            style={[
              styles.slideContent,
              {
                opacity,
                transform: [{ translateY }],
              },
            ]}
          >
            {/* Icon */}
            <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
              <Icon scale={iconScale} />
            </Animated.View>

            {/* Text content */}
            <View style={styles.textContainer}>
              <Text style={styles.title}>{item.title}</Text>
              {item.subtitle ? (
                <Text style={styles.subtitle}>{item.subtitle}</Text>
              ) : null}
              <Text style={styles.description}>{item.description}</Text>

              {/* Social proof stat on last slide */}
              {item.stat && (
                <View style={styles.statContainer}>
                  <Text style={styles.statValue}>{item.stat.value}</Text>
                  <Text style={styles.statLabel}>{item.stat.label}</Text>
                </View>
              )}
            </View>
          </Animated.View>
        </LinearGradient>
      );
    },
    [scrollX, iconScale, pulseAnim]
  );

  const isLastSlide = currentIndex === SLIDES.length - 1;

  // Don't render until we've checked onboarding status
  if (!hasCheckedOnboarding) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <LinearGradient
          colors={['#0a0a0f', '#1a1035', '#0a0a0f']}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <SafeAreaView style={styles.progressContainer}>
        <View style={styles.progressBar}>
          {SLIDES.map((_, index) => {
            const inputRange = [
              (index - 1) * SCREEN_WIDTH,
              index * SCREEN_WIDTH,
              (index + 1) * SCREEN_WIDTH,
            ];

            const width = scrollX.interpolate({
              inputRange,
              outputRange: ['0%', '100%', '0%'],
              extrapolate: 'clamp',
            });

            return (
              <View key={index} style={styles.progressSegment}>
                <View style={styles.progressSegmentBg} />
                <Animated.View
                  style={[
                    styles.progressSegmentFill,
                    { width: index < currentIndex ? '100%' : index === currentIndex ? width : '0%' },
                  ]}
                />
              </View>
            );
          })}
        </View>

        {/* Skip button - show on all but last slide */}
        {!isLastSlide && (
          <Animated.View style={{ opacity: buttonOpacity }}>
            <Pressable onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </Animated.View>
        )}
      </SafeAreaView>

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false, listener: handleScroll }
        )}
        scrollEventThrottle={16}
        bounces={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Bottom buttons */}
      <SafeAreaView style={styles.bottomContainer}>
        <Animated.View style={[styles.buttonsRow, { opacity: buttonOpacity }]}>
          {/* Dots indicator */}
          <View style={styles.dotsContainer}>
            {SLIDES.map((_, index) => {
              const inputRange = [
                (index - 1) * SCREEN_WIDTH,
                index * SCREEN_WIDTH,
                (index + 1) * SCREEN_WIDTH,
              ];

              const dotScale = scrollX.interpolate({
                inputRange,
                outputRange: [1, 1.3, 1],
                extrapolate: 'clamp',
              });

              const dotOpacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.3, 1, 0.3],
                extrapolate: 'clamp',
              });

              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      transform: [{ scale: dotScale }],
                      opacity: dotOpacity,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Next/Get Started button */}
          <Pressable
            onPress={goToNext}
            style={({ pressed }) => [
              styles.nextButtonWrapper,
              pressed && styles.buttonPressed,
            ]}
          >
            <LinearGradient
              colors={['#ff00ff', '#8b00ff', '#2a2882']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.nextButton}
            >
              <Text style={styles.nextButtonText}>
                {isLastSlide ? 'Get Started' : 'Next'}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 20,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressBar: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    marginRight: 16,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressSegmentBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
  },
  progressSegmentFill: {
    height: '100%',
    backgroundColor: '#ff00ff',
    borderRadius: 2,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  slideContent: {
    alignItems: 'center',
    marginTop: -60,
  },
  iconContainer: {
    marginBottom: 40,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 10,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Audiowide-Regular',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: '#ff00ff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  subtitle: {
    fontSize: 28,
    fontFamily: 'Audiowide-Regular',
    color: '#ff00ff',
    textAlign: 'center',
    marginTop: 4,
  },
  description: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 20,
    maxWidth: 300,
  },
  statContainer: {
    marginTop: 30,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 255, 0.1)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.2)',
  },
  statValue: {
    fontSize: 36,
    fontFamily: 'Audiowide-Regular',
    color: '#ff00ff',
    textShadowColor: '#ff00ff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff00ff',
  },
  nextButtonWrapper: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  nextButton: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontFamily: 'Amiko-Bold',
    color: '#ffffff',
    letterSpacing: 1,
  },
});

export default InitialOnboarding;
