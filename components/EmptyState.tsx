// EmptyState Component
// Reusable empty state display for when there's no content to show
// Provides visual feedback and optional action buttons

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { colors, fonts, spacing, borderRadius } from '../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Icon types available
export type EmptyStateIcon =
  | 'map'
  | 'music'
  | 'search'
  | 'playlist'
  | 'ticket'
  | 'user'
  | 'band'
  | 'venue'
  | 'show'
  | 'message'
  | 'notification'
  | 'generic';

interface EmptyStateProps {
  // Main content
  icon?: EmptyStateIcon;
  title: string;
  subtitle?: string;

  // Action button
  actionLabel?: string;
  onAction?: () => void;

  // Secondary action
  secondaryLabel?: string;
  onSecondaryAction?: () => void;

  // Styling
  compact?: boolean;
  style?: object;
}

// Icon components
const IconMap = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={colors.primary.magenta} strokeWidth="1.5" opacity="0.3" />
    <Path
      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
      fill={colors.primary.magenta}
    />
  </Svg>
);

const IconMusic = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={colors.primary.purple} strokeWidth="1.5" opacity="0.3" />
    <Path
      d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
      fill={colors.primary.purple}
    />
  </Svg>
);

const IconSearch = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={colors.primary.magenta} strokeWidth="1.5" opacity="0.3" />
    <Path
      d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
      fill={colors.primary.magenta}
    />
  </Svg>
);

const IconPlaylist = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={colors.primary.purple} strokeWidth="1.5" opacity="0.3" />
    <Path
      d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"
      fill={colors.primary.purple}
    />
  </Svg>
);

const IconTicket = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={colors.primary.deepPurple} strokeWidth="1.5" opacity="0.3" />
    <Path
      d="M22 10V6c0-1.11-.9-2-2-2H4c-1.1 0-1.99.89-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zm-9 7.5h-2v-2h2v2zm0-4.5h-2v-2h2v2zm0-4.5h-2v-2h2v2z"
      fill={colors.primary.deepPurple}
    />
  </Svg>
);

const IconUser = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={colors.primary.magenta} strokeWidth="1.5" opacity="0.3" />
    <Path
      d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
      fill={colors.primary.magenta}
    />
  </Svg>
);

const IconBand = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={colors.primary.purple} strokeWidth="1.5" opacity="0.3" />
    <Path
      d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
      fill={colors.primary.purple}
    />
  </Svg>
);

const IconVenue = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke="#FFD700" strokeWidth="1.5" opacity="0.3" />
    <Path
      d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z"
      fill="#FFD700"
    />
  </Svg>
);

const IconShow = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={colors.primary.magenta} strokeWidth="1.5" opacity="0.3" />
    <Path
      d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"
      fill={colors.primary.magenta}
    />
  </Svg>
);

const IconMessage = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={colors.primary.purple} strokeWidth="1.5" opacity="0.3" />
    <Path
      d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"
      fill={colors.primary.purple}
    />
  </Svg>
);

const IconNotification = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={colors.primary.magenta} strokeWidth="1.5" opacity="0.3" />
    <Path
      d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
      fill={colors.primary.magenta}
    />
  </Svg>
);

const IconGeneric = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" stroke={colors.text.tertiary} strokeWidth="1.5" opacity="0.5" />
    <Path
      d="M19 5v14H5V5h14zm0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"
      fill={colors.text.tertiary}
    />
  </Svg>
);

// Icon renderer
const renderIcon = (icon: EmptyStateIcon) => {
  switch (icon) {
    case 'map':
      return <IconMap />;
    case 'music':
      return <IconMusic />;
    case 'search':
      return <IconSearch />;
    case 'playlist':
      return <IconPlaylist />;
    case 'ticket':
      return <IconTicket />;
    case 'user':
      return <IconUser />;
    case 'band':
      return <IconBand />;
    case 'venue':
      return <IconVenue />;
    case 'show':
      return <IconShow />;
    case 'message':
      return <IconMessage />;
    case 'notification':
      return <IconNotification />;
    default:
      return <IconGeneric />;
  }
};

const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'generic',
  title,
  subtitle,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
  compact = false,
  style,
}) => {
  return (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      {/* Icon with glow effect */}
      <View style={styles.iconContainer}>
        <View style={styles.iconGlow} />
        {renderIcon(icon)}
      </View>

      {/* Title */}
      <Text style={[styles.title, compact && styles.titleCompact]}>
        {title}
      </Text>

      {/* Subtitle */}
      {subtitle && (
        <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>
          {subtitle}
        </Text>
      )}

      {/* Actions */}
      {(actionLabel || secondaryLabel) && (
        <View style={styles.actionsContainer}>
          {/* Primary Action */}
          {actionLabel && onAction && (
            <TouchableOpacity
              onPress={onAction}
              activeOpacity={0.8}
              style={styles.primaryButtonWrapper}
            >
              <LinearGradient
                colors={[colors.primary.magenta, colors.primary.purple, colors.primary.deepPurple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>{actionLabel}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Secondary Action */}
          {secondaryLabel && onSecondaryAction && (
            <TouchableOpacity
              onPress={onSecondaryAction}
              activeOpacity={0.7}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['3xl'],
  },
  containerCompact: {
    paddingVertical: spacing.xl,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: spacing.lg,
  },
  iconGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 50,
    backgroundColor: colors.primary.magenta,
    opacity: 0.1,
  },
  title: {
    fontSize: fonts.size.xl,
    fontFamily: fonts.family.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  titleCompact: {
    fontSize: fonts.size.lg,
  },
  subtitle: {
    fontSize: fonts.size.md,
    fontFamily: fonts.family.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: SCREEN_WIDTH * 0.8,
  },
  subtitleCompact: {
    fontSize: fonts.size.sm,
  },
  actionsContainer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  primaryButtonWrapper: {
    borderRadius: borderRadius.base,
    overflow: 'hidden',
  },
  primaryButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.base,
  },
  primaryButtonText: {
    fontSize: fonts.size.base,
    fontFamily: fonts.family.bold,
    color: colors.text.primary,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    fontSize: fonts.size.md,
    fontFamily: fonts.family.regular,
    color: colors.primary.magenta,
  },
});

export default EmptyState;
