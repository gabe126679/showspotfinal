// SpotlightOverlay Component
// Creates an instructional overlay with a spotlight effect on target elements
// Used for onboarding tutorials and feature highlights

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  LayoutRectangle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Rect, Mask, Circle, G } from 'react-native-svg';
import { colors, fonts, spacing, borderRadius, onboarding } from '../lib/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Target shape types
export type SpotlightShape = 'circle' | 'rectangle' | 'pill';

// Position for the instruction tooltip
export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'auto';

// Arrow direction
export type ArrowDirection = 'up' | 'down' | 'left' | 'right' | 'none';

export interface SpotlightTarget {
  // Position and size of the spotlight
  x: number;
  y: number;
  width: number;
  height: number;
  // Shape of spotlight
  shape?: SpotlightShape;
  // Padding around the target
  padding?: number;
}

export interface SpotlightStep {
  // Target element to highlight
  target: SpotlightTarget;
  // Instruction text
  title: string;
  description?: string;
  // Button text
  buttonText?: string;
  // Where to show the tooltip
  tooltipPosition?: TooltipPosition;
  // Skip button
  showSkip?: boolean;
}

interface SpotlightOverlayProps {
  // Current step to display
  step: SpotlightStep;
  // Called when user taps to continue
  onNext: () => void;
  // Called when user skips
  onSkip?: () => void;
  // Animation state
  visible: boolean;
  // Current step number (for progress)
  currentStepIndex?: number;
  // Total steps (for progress)
  totalSteps?: number;
}

const SpotlightOverlay: React.FC<SpotlightOverlayProps> = ({
  step,
  onNext,
  onSkip,
  visible,
  currentStepIndex = 0,
  totalSteps = 1,
}) => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: onboarding.animationDuration,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: onboarding.animationDuration,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: onboarding.animationDuration,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsVisible(false);
      });
    }
  }, [visible, fadeAnim, scaleAnim]);

  if (!isVisible) return null;

  const { target, title, description, buttonText, tooltipPosition, showSkip } = step;
  const padding = target.padding ?? onboarding.spotlightPadding;
  const shape = target.shape ?? 'circle';

  // Calculate spotlight dimensions with padding
  const spotlightX = target.x - padding;
  const spotlightY = target.y - padding;
  const spotlightWidth = target.width + padding * 2;
  const spotlightHeight = target.height + padding * 2;
  const spotlightCenterX = spotlightX + spotlightWidth / 2;
  const spotlightCenterY = spotlightY + spotlightHeight / 2;
  const spotlightRadius = Math.max(spotlightWidth, spotlightHeight) / 2;

  // Determine tooltip position
  const getTooltipPosition = (): { top?: number; bottom?: number; arrowDirection: ArrowDirection } => {
    const position = tooltipPosition ?? 'auto';

    if (position === 'auto') {
      // If target is in top half, show tooltip below; otherwise above
      if (spotlightCenterY < SCREEN_HEIGHT / 2) {
        return {
          top: spotlightY + spotlightHeight + 20,
          arrowDirection: 'up',
        };
      } else {
        return {
          bottom: SCREEN_HEIGHT - spotlightY + 20,
          arrowDirection: 'down',
        };
      }
    }

    if (position === 'bottom') {
      return {
        top: spotlightY + spotlightHeight + 20,
        arrowDirection: 'up',
      };
    }

    return {
      bottom: SCREEN_HEIGHT - spotlightY + 20,
      arrowDirection: 'down',
    };
  };

  const tooltipPos = getTooltipPosition();

  // Render arrow pointing to spotlight
  const renderArrow = () => {
    if (tooltipPos.arrowDirection === 'none') return null;

    const arrowStyle = tooltipPos.arrowDirection === 'up'
      ? styles.arrowUp
      : styles.arrowDown;

    return (
      <View
        style={[
          styles.arrowContainer,
          { left: spotlightCenterX - 10 },
          tooltipPos.arrowDirection === 'up'
            ? { top: (tooltipPos.top ?? 0) - 10 }
            : { bottom: (tooltipPos.bottom ?? 0) - 10 },
        ]}
      >
        <View style={arrowStyle} />
      </View>
    );
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim },
      ]}
      pointerEvents="box-none"
    >
      <TouchableWithoutFeedback onPress={onNext}>
        <View style={styles.touchableArea}>
          {/* SVG Mask for spotlight effect */}
          <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={styles.svg}>
            <Defs>
              <Mask id="spotlight-mask">
                {/* White = visible, Black = transparent */}
                <Rect
                  x="0"
                  y="0"
                  width={SCREEN_WIDTH}
                  height={SCREEN_HEIGHT}
                  fill="white"
                />
                {/* Spotlight cutout */}
                {shape === 'circle' ? (
                  <Circle
                    cx={spotlightCenterX}
                    cy={spotlightCenterY}
                    r={spotlightRadius}
                    fill="black"
                  />
                ) : shape === 'pill' ? (
                  <Rect
                    x={spotlightX}
                    y={spotlightY}
                    width={spotlightWidth}
                    height={spotlightHeight}
                    rx={spotlightHeight / 2}
                    ry={spotlightHeight / 2}
                    fill="black"
                  />
                ) : (
                  <Rect
                    x={spotlightX}
                    y={spotlightY}
                    width={spotlightWidth}
                    height={spotlightHeight}
                    rx={8}
                    ry={8}
                    fill="black"
                  />
                )}
              </Mask>
            </Defs>
            {/* Dark overlay with mask applied */}
            <Rect
              x="0"
              y="0"
              width={SCREEN_WIDTH}
              height={SCREEN_HEIGHT}
              fill={`rgba(0, 0, 0, ${onboarding.overlayOpacity})`}
              mask="url(#spotlight-mask)"
            />
          </Svg>

          {/* Spotlight ring/border */}
          <Animated.View
            style={[
              styles.spotlightRing,
              {
                transform: [{ scale: scaleAnim }],
              },
              shape === 'circle' ? {
                left: spotlightCenterX - spotlightRadius - 4,
                top: spotlightCenterY - spotlightRadius - 4,
                width: spotlightRadius * 2 + 8,
                height: spotlightRadius * 2 + 8,
                borderRadius: spotlightRadius + 4,
              } : shape === 'pill' ? {
                left: spotlightX - 4,
                top: spotlightY - 4,
                width: spotlightWidth + 8,
                height: spotlightHeight + 8,
                borderRadius: (spotlightHeight + 8) / 2,
              } : {
                left: spotlightX - 4,
                top: spotlightY - 4,
                width: spotlightWidth + 8,
                height: spotlightHeight + 8,
                borderRadius: 12,
              },
            ]}
          />

          {/* Arrow */}
          {renderArrow()}

          {/* Tooltip */}
          <Animated.View
            style={[
              styles.tooltip,
              {
                transform: [{ scale: scaleAnim }],
              },
              tooltipPos.top !== undefined && { top: tooltipPos.top },
              tooltipPos.bottom !== undefined && { bottom: tooltipPos.bottom },
            ]}
          >
            {/* Progress indicator */}
            {totalSteps > 1 && (
              <View style={styles.progressContainer}>
                {Array.from({ length: totalSteps }).map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.progressDot,
                      idx === currentStepIndex && styles.progressDotActive,
                    ]}
                  />
                ))}
              </View>
            )}

            <Text style={styles.title}>{title}</Text>
            {description && (
              <Text style={styles.description}>{description}</Text>
            )}

            <View style={styles.buttonContainer}>
              {showSkip && onSkip && (
                <TouchableWithoutFeedback onPress={onSkip}>
                  <View style={styles.skipButton}>
                    <Text style={styles.skipButtonText}>Skip</Text>
                  </View>
                </TouchableWithoutFeedback>
              )}
              <TouchableWithoutFeedback onPress={onNext}>
                <View style={styles.nextButton}>
                  <Text style={styles.nextButtonText}>
                    {buttonText ?? (currentStepIndex === totalSteps - 1 ? 'Got it!' : 'Next')}
                  </Text>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </Animated.View>

          {/* Tap anywhere hint */}
          <View style={[styles.tapHint, { bottom: insets.bottom + 20 }]}>
            <Text style={styles.tapHintText}>Tap anywhere to continue</Text>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
  },
  touchableArea: {
    flex: 1,
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  spotlightRing: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: colors.primary.magenta,
    shadowColor: colors.primary.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  arrowContainer: {
    position: 'absolute',
    width: 20,
    height: 10,
    zIndex: 1000,
  },
  arrowUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(42, 40, 130, 0.95)',
  },
  arrowDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(42, 40, 130, 0.95)',
  },
  tooltip: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(42, 40, 130, 0.95)',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary.magenta,
    shadowColor: colors.primary.magenta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressDotActive: {
    backgroundColor: colors.primary.magenta,
  },
  title: {
    fontSize: fonts.size.xl,
    fontFamily: fonts.family.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: fonts.size.md,
    fontFamily: fonts.family.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.base,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  skipButtonText: {
    fontSize: fonts.size.md,
    fontFamily: fonts.family.regular,
    color: colors.text.tertiary,
  },
  nextButton: {
    backgroundColor: colors.primary.magenta,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.base,
  },
  nextButtonText: {
    fontSize: fonts.size.md,
    fontFamily: fonts.family.bold,
    color: colors.text.primary,
  },
  tapHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tapHintText: {
    fontSize: fonts.size.sm,
    fontFamily: fonts.family.regular,
    color: colors.text.tertiary,
  },
});

export default SpotlightOverlay;
