// Onboarding Service
// Manages first-time user experience and tutorial state using AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  HAS_SEEN_WELCOME: '@showspot_has_seen_welcome',
  HAS_SEEN_MAP_TUTORIAL: '@showspot_has_seen_map_tutorial',
  HAS_SEEN_PROFILE_TUTORIAL: '@showspot_has_seen_profile_tutorial',
  HAS_SEEN_CREATE_TUTORIAL: '@showspot_has_seen_create_tutorial',
  HAS_SEEN_PLAYER_TUTORIAL: '@showspot_has_seen_player_tutorial',
  HAS_SEEN_SEARCH_TUTORIAL: '@showspot_has_seen_search_tutorial',
  ONBOARDING_COMPLETED: '@showspot_onboarding_completed',
  LAST_SEEN_VERSION: '@showspot_last_seen_version',
} as const;

type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

// Tutorial step identifiers
export type TutorialStep =
  | 'welcome'
  | 'map'
  | 'profile'
  | 'create'
  | 'player'
  | 'search';

// Onboarding state interface
export interface OnboardingState {
  hasSeenWelcome: boolean;
  hasSeenMapTutorial: boolean;
  hasSeenProfileTutorial: boolean;
  hasSeenCreateTutorial: boolean;
  hasSeenPlayerTutorial: boolean;
  hasSeenSearchTutorial: boolean;
  isOnboardingComplete: boolean;
}

// Default state for new users
const DEFAULT_STATE: OnboardingState = {
  hasSeenWelcome: false,
  hasSeenMapTutorial: false,
  hasSeenProfileTutorial: false,
  hasSeenCreateTutorial: false,
  hasSeenPlayerTutorial: false,
  hasSeenSearchTutorial: false,
  isOnboardingComplete: false,
};

class OnboardingService {
  private cachedState: OnboardingState | null = null;

  /**
   * Get the full onboarding state
   */
  async getOnboardingState(): Promise<OnboardingState> {
    if (this.cachedState) {
      return this.cachedState;
    }

    try {
      const keys = Object.values(STORAGE_KEYS);
      const results = await AsyncStorage.multiGet(keys);

      const state: OnboardingState = {
        hasSeenWelcome: results[0][1] === 'true',
        hasSeenMapTutorial: results[1][1] === 'true',
        hasSeenProfileTutorial: results[2][1] === 'true',
        hasSeenCreateTutorial: results[3][1] === 'true',
        hasSeenPlayerTutorial: results[4][1] === 'true',
        hasSeenSearchTutorial: results[5][1] === 'true',
        isOnboardingComplete: results[6][1] === 'true',
      };

      this.cachedState = state;
      return state;
    } catch (error) {
      console.error('Error reading onboarding state:', error);
      return DEFAULT_STATE;
    }
  }

  /**
   * Check if a specific tutorial step has been seen
   */
  async hasSeenTutorial(step: TutorialStep): Promise<boolean> {
    const keyMap: Record<TutorialStep, StorageKey> = {
      welcome: STORAGE_KEYS.HAS_SEEN_WELCOME,
      map: STORAGE_KEYS.HAS_SEEN_MAP_TUTORIAL,
      profile: STORAGE_KEYS.HAS_SEEN_PROFILE_TUTORIAL,
      create: STORAGE_KEYS.HAS_SEEN_CREATE_TUTORIAL,
      player: STORAGE_KEYS.HAS_SEEN_PLAYER_TUTORIAL,
      search: STORAGE_KEYS.HAS_SEEN_SEARCH_TUTORIAL,
    };

    try {
      const value = await AsyncStorage.getItem(keyMap[step]);
      return value === 'true';
    } catch (error) {
      console.error(`Error checking tutorial step ${step}:`, error);
      return false;
    }
  }

  /**
   * Mark a tutorial step as seen
   */
  async markTutorialSeen(step: TutorialStep): Promise<void> {
    const keyMap: Record<TutorialStep, StorageKey> = {
      welcome: STORAGE_KEYS.HAS_SEEN_WELCOME,
      map: STORAGE_KEYS.HAS_SEEN_MAP_TUTORIAL,
      profile: STORAGE_KEYS.HAS_SEEN_PROFILE_TUTORIAL,
      create: STORAGE_KEYS.HAS_SEEN_CREATE_TUTORIAL,
      player: STORAGE_KEYS.HAS_SEEN_PLAYER_TUTORIAL,
      search: STORAGE_KEYS.HAS_SEEN_SEARCH_TUTORIAL,
    };

    try {
      await AsyncStorage.setItem(keyMap[step], 'true');

      // Invalidate cache
      this.cachedState = null;

      // Check if all tutorials are complete
      await this.checkOnboardingComplete();
    } catch (error) {
      console.error(`Error marking tutorial step ${step} as seen:`, error);
    }
  }

  /**
   * Check and update if onboarding is complete
   */
  private async checkOnboardingComplete(): Promise<boolean> {
    try {
      const state = await this.getOnboardingState();
      const isComplete =
        state.hasSeenWelcome &&
        state.hasSeenMapTutorial &&
        state.hasSeenProfileTutorial &&
        state.hasSeenCreateTutorial &&
        state.hasSeenPlayerTutorial;

      if (isComplete && !state.isOnboardingComplete) {
        await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
        this.cachedState = null;
      }

      return isComplete;
    } catch (error) {
      console.error('Error checking onboarding completion:', error);
      return false;
    }
  }

  /**
   * Check if onboarding is complete
   */
  async isOnboardingComplete(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED);
      return value === 'true';
    } catch (error) {
      console.error('Error checking if onboarding is complete:', error);
      return false;
    }
  }

  /**
   * Mark entire onboarding as complete (skip remaining tutorials)
   */
  async completeOnboarding(): Promise<void> {
    try {
      const pairs: [string, string][] = [
        [STORAGE_KEYS.HAS_SEEN_WELCOME, 'true'],
        [STORAGE_KEYS.HAS_SEEN_MAP_TUTORIAL, 'true'],
        [STORAGE_KEYS.HAS_SEEN_PROFILE_TUTORIAL, 'true'],
        [STORAGE_KEYS.HAS_SEEN_CREATE_TUTORIAL, 'true'],
        [STORAGE_KEYS.HAS_SEEN_PLAYER_TUTORIAL, 'true'],
        [STORAGE_KEYS.HAS_SEEN_SEARCH_TUTORIAL, 'true'],
        [STORAGE_KEYS.ONBOARDING_COMPLETED, 'true'],
      ];

      await AsyncStorage.multiSet(pairs);
      this.cachedState = null;
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  }

  /**
   * Reset onboarding state (for testing or "replay tutorial" feature)
   */
  async resetOnboarding(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      await AsyncStorage.multiRemove(keys);
      this.cachedState = null;
    } catch (error) {
      console.error('Error resetting onboarding:', error);
    }
  }

  /**
   * Get the next tutorial step that hasn't been seen
   * Returns null if all tutorials have been seen
   */
  async getNextTutorialStep(): Promise<TutorialStep | null> {
    const state = await this.getOnboardingState();

    // Priority order for tutorials
    const tutorialOrder: { step: TutorialStep; seen: boolean }[] = [
      { step: 'welcome', seen: state.hasSeenWelcome },
      { step: 'map', seen: state.hasSeenMapTutorial },
      { step: 'profile', seen: state.hasSeenProfileTutorial },
      { step: 'create', seen: state.hasSeenCreateTutorial },
      { step: 'player', seen: state.hasSeenPlayerTutorial },
      { step: 'search', seen: state.hasSeenSearchTutorial },
    ];

    const nextStep = tutorialOrder.find(t => !t.seen);
    return nextStep?.step ?? null;
  }

  /**
   * Get progress percentage (0-100)
   */
  async getOnboardingProgress(): Promise<number> {
    const state = await this.getOnboardingState();
    const steps = [
      state.hasSeenWelcome,
      state.hasSeenMapTutorial,
      state.hasSeenProfileTutorial,
      state.hasSeenCreateTutorial,
      state.hasSeenPlayerTutorial,
      state.hasSeenSearchTutorial,
    ];

    const completed = steps.filter(Boolean).length;
    return Math.round((completed / steps.length) * 100);
  }

  /**
   * Store app version to detect new features
   */
  async setLastSeenVersion(version: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SEEN_VERSION, version);
    } catch (error) {
      console.error('Error setting last seen version:', error);
    }
  }

  /**
   * Get last seen app version
   */
  async getLastSeenVersion(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.LAST_SEEN_VERSION);
    } catch (error) {
      console.error('Error getting last seen version:', error);
      return null;
    }
  }

  /**
   * Check if this is a first-time user (no tutorials seen at all)
   */
  async isFirstTimeUser(): Promise<boolean> {
    const state = await this.getOnboardingState();
    return !state.hasSeenWelcome && !state.hasSeenMapTutorial;
  }
}

// Export singleton instance
export const onboardingService = new OnboardingService();

// Export types
export type { OnboardingState };
