// ShowSpot Theme Constants
// Centralized styling for consistent UI across the app

export const colors = {
  // Primary brand colors
  primary: {
    magenta: '#ff00ff',
    purple: '#8b00ff',
    deepPurple: '#2a2882',
  },

  // Gradient presets (use with LinearGradient)
  gradients: {
    primary: ['#ff00ff', '#8b00ff', '#2a2882'] as const,
    primaryReverse: ['#2a2882', '#8b00ff', '#ff00ff'] as const,
    header: ['#2a2882', '#ff00ff'] as const,
    headerReverse: ['#ff00ff', '#2a2882'] as const,
    venue: ['rgba(255, 215, 0, 0.95)', 'rgba(80, 200, 120, 0.95)'] as const,
    dark: ['#0a0a0f', '#1a1035', '#0a0a0f'] as const,
    overlay: ['rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 0.4)'] as const,
  },

  // UI colors
  background: {
    dark: '#0a0a0f',
    darkPurple: '#1a1035',
    card: 'rgba(255, 255, 255, 0.03)',
    cardHover: 'rgba(255, 255, 255, 0.06)',
    overlay: 'rgba(0, 0, 0, 0.9)',
    overlayLight: 'rgba(0, 0, 0, 0.5)',
  },

  // Text colors
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255, 255, 255, 0.7)',
    tertiary: 'rgba(255, 255, 255, 0.5)',
    muted: 'rgba(255, 255, 255, 0.35)',
    dark: '#333333',
    darkSecondary: '#666666',
  },

  // Status colors
  status: {
    success: '#4CAF50',
    successDark: '#45a049',
    error: '#f44336',
    errorDark: '#d32f2f',
    warning: '#ff9800',
    warningDark: '#f57c00',
    info: '#2196F3',
    infoDark: '#1976D2',
  },

  // Interactive element colors
  interactive: {
    border: 'rgba(255, 255, 255, 0.1)',
    borderLight: 'rgba(255, 255, 255, 0.3)',
    disabled: 'rgba(255, 255, 255, 0.3)',
    ripple: 'rgba(255, 255, 255, 0.2)',
  },

  // Rating/stars
  rating: {
    filled: '#FFD700',
    empty: '#E0E0E0',
  },
};

export const fonts = {
  // Font families
  family: {
    display: 'Audiowide-Regular',
    bold: 'Amiko-Bold',
    semiBold: 'Amiko-SemiBold',
    regular: 'Amiko-Regular',
  },

  // Font sizes
  size: {
    xs: 10,
    sm: 12,
    md: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 38,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Letter spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 2,
    display: 3,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
};

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  base: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  glow: {
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  glowSmall: {
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const dimensions = {
  // Common heights
  headerHeight: 85,
  footerHeight: 85,
  tabBarHeight: 60,
  buttonHeight: 56,
  inputHeight: 48,

  // Icon sizes
  iconSm: 20,
  iconMd: 24,
  iconLg: 32,
  iconXl: 40,

  // Avatar sizes
  avatarSm: 32,
  avatarMd: 48,
  avatarLg: 64,
  avatarXl: 96,
};

export const animation = {
  // Duration in ms
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },

  // Spring configs for Animated.spring
  spring: {
    default: {
      tension: 100,
      friction: 8,
    },
    bouncy: {
      tension: 120,
      friction: 7,
    },
    stiff: {
      tension: 150,
      friction: 10,
    },
  },
};

// Toast configuration
export const toast = {
  duration: {
    short: 2000,
    medium: 3500,
    long: 5000,
  },
  position: {
    top: 60,
    bottom: 100,
  },
};

// Onboarding configuration
export const onboarding = {
  overlayOpacity: 0.85,
  spotlightPadding: 8,
  animationDuration: 300,
};

// Export a default theme object for convenience
const theme = {
  colors,
  fonts,
  spacing,
  borderRadius,
  shadows,
  dimensions,
  animation,
  toast,
  onboarding,
};

export default theme;
