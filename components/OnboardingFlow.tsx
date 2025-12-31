// OnboardingFlow Component
// Manages the full onboarding experience across the app
// Provides context for screens to show their relevant tutorials

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { Dimensions } from 'react-native';
import SpotlightOverlay, { SpotlightStep, SpotlightTarget } from './SpotlightOverlay';
import { onboardingService, TutorialStep } from '../services/onboardingService';
import { dimensions } from '../lib/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Footer tab layout: 5 tabs evenly distributed
const TAB_COUNT = 5;
const TAB_WIDTH = SCREEN_WIDTH / TAB_COUNT;
const TAB_ICON_SIZE = 48;
const FOOTER_TOP = SCREEN_HEIGHT - dimensions.footerHeight - 25;

// Calculate tab center position
const getTabPosition = (index: number) => ({
  x: (TAB_WIDTH * index) + (TAB_WIDTH / 2) - (TAB_ICON_SIZE / 2),
  y: FOOTER_TOP,
  width: TAB_ICON_SIZE,
  height: TAB_ICON_SIZE,
  shape: 'circle' as const,
  padding: 12,
});

// Predefined target positions for common UI elements
export const ONBOARDING_TARGETS = {
  // Footer tab bar icons - calculated for 5 evenly spaced tabs
  footerHome: getTabPosition(0),      // MapHome
  footerSearch: getTabPosition(1),    // Search
  footerCreate: getTabPosition(2),    // Create
  footerPlayer: getTabPosition(3),    // Player
  footerProfile: getTabPosition(4),   // Profile

  // Map center area for venue markers
  mapCenter: {
    x: SCREEN_WIDTH / 2 - 50,
    y: SCREEN_HEIGHT / 2 - 80,
    width: 100,
    height: 100,
    shape: 'circle' as const,
    padding: 20,
  },

  // Header area
  header: {
    x: 0,
    y: 0,
    width: SCREEN_WIDTH,
    height: dimensions.headerHeight + 44, // Include safe area
    shape: 'rectangle' as const,
    padding: 0,
  },
};

// Tutorial content for each screen
const TUTORIAL_CONTENT: Record<TutorialStep, SpotlightStep[]> = {
  welcome: [], // Handled by WelcomeScreen
  map: [
    {
      target: ONBOARDING_TARGETS.mapCenter,
      title: 'Discover Live Shows',
      description: 'Tap on venue markers to see upcoming shows near you. The map shows all active venues in your area.',
      buttonText: 'Next',
      showSkip: true,
    },
    {
      target: ONBOARDING_TARGETS.footerSearch,
      title: 'Search Artists & Venues',
      description: 'Find your favorite artists, bands, and venues. Discover new music in your area.',
      buttonText: 'Next',
      showSkip: true,
    },
  ],
  create: [
    {
      target: ONBOARDING_TARGETS.footerCreate,
      title: 'Create & Promote',
      description: 'Promote a show, form a band, or register as an artist. This is where the magic happens!',
      buttonText: 'Got it!',
      showSkip: false,
    },
  ],
  player: [
    {
      target: ONBOARDING_TARGETS.footerPlayer,
      title: 'Your Music Player',
      description: 'Listen to music from local artists. Build playlists and support musicians directly.',
      buttonText: 'Got it!',
      showSkip: false,
    },
  ],
  profile: [
    {
      target: ONBOARDING_TARGETS.footerProfile,
      title: 'Your Profile',
      description: 'View and edit your profile, see your tickets, and manage your account settings.',
      buttonText: 'Got it!',
      showSkip: false,
    },
  ],
  search: [], // Combined with map tutorial
};

interface OnboardingContextType {
  // Check if onboarding is active
  isOnboardingActive: boolean;
  // Start tutorial for a specific screen
  startTutorial: (step: TutorialStep) => Promise<void>;
  // Check if a tutorial should be shown
  shouldShowTutorial: (step: TutorialStep) => Promise<boolean>;
  // Skip all remaining tutorials
  skipOnboarding: () => Promise<void>;
  // Reset onboarding (for settings)
  resetOnboarding: () => Promise<void>;
  // Register a target element's position (for dynamic positioning)
  registerTarget: (key: string, target: SpotlightTarget) => void;
  // Get registered target
  getTarget: (key: string) => SpotlightTarget | undefined;
  // Current tutorial step name
  currentTutorial: TutorialStep | null;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export const useOnboarding = (): OnboardingContextType => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};

interface OnboardingProviderProps {
  children: React.ReactNode;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({
  children,
}) => {
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  const [currentTutorial, setCurrentTutorial] = useState<TutorialStep | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<SpotlightStep[]>([]);
  const registeredTargets = useRef<Record<string, SpotlightTarget>>({});

  // Initialize with predefined targets
  useEffect(() => {
    registeredTargets.current = { ...ONBOARDING_TARGETS };
  }, []);

  const registerTarget = useCallback((key: string, target: SpotlightTarget) => {
    registeredTargets.current[key] = target;
  }, []);

  const getTarget = useCallback((key: string): SpotlightTarget | undefined => {
    return registeredTargets.current[key];
  }, []);

  const shouldShowTutorial = useCallback(async (step: TutorialStep): Promise<boolean> => {
    const hasSeen = await onboardingService.hasSeenTutorial(step);
    return !hasSeen && TUTORIAL_CONTENT[step].length > 0;
  }, []);

  const startTutorial = useCallback(async (step: TutorialStep) => {
    const shouldShow = await shouldShowTutorial(step);
    if (!shouldShow) return;

    const tutorialSteps = TUTORIAL_CONTENT[step];
    if (tutorialSteps.length === 0) return;

    // Update targets with any registered dynamic positions
    const updatedSteps = tutorialSteps.map(s => {
      const targetKey = Object.entries(ONBOARDING_TARGETS).find(
        ([_, value]) => value === s.target
      )?.[0];

      if (targetKey && registeredTargets.current[targetKey]) {
        return { ...s, target: registeredTargets.current[targetKey] };
      }
      return s;
    });

    setSteps(updatedSteps);
    setCurrentStepIndex(0);
    setCurrentTutorial(step);
    setIsOnboardingActive(true);
  }, [shouldShowTutorial]);

  const handleNext = useCallback(async () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Tutorial complete
      if (currentTutorial) {
        await onboardingService.markTutorialSeen(currentTutorial);
      }
      setIsOnboardingActive(false);
      setCurrentTutorial(null);
      setSteps([]);
      setCurrentStepIndex(0);
    }
  }, [currentStepIndex, steps.length, currentTutorial]);

  const handleSkip = useCallback(async () => {
    if (currentTutorial) {
      await onboardingService.markTutorialSeen(currentTutorial);
    }
    setIsOnboardingActive(false);
    setCurrentTutorial(null);
    setSteps([]);
    setCurrentStepIndex(0);
  }, [currentTutorial]);

  const skipOnboarding = useCallback(async () => {
    await onboardingService.completeOnboarding();
    setIsOnboardingActive(false);
    setCurrentTutorial(null);
    setSteps([]);
    setCurrentStepIndex(0);
  }, []);

  const resetOnboarding = useCallback(async () => {
    await onboardingService.resetOnboarding();
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingActive,
        startTutorial,
        shouldShowTutorial,
        skipOnboarding,
        resetOnboarding,
        registerTarget,
        getTarget,
        currentTutorial,
      }}
    >
      {children}

      {/* Spotlight Overlay */}
      {isOnboardingActive && steps.length > 0 && (
        <SpotlightOverlay
          step={steps[currentStepIndex]}
          onNext={handleNext}
          onSkip={handleSkip}
          visible={isOnboardingActive}
          currentStepIndex={currentStepIndex}
          totalSteps={steps.length}
        />
      )}
    </OnboardingContext.Provider>
  );
};

export default OnboardingProvider;
