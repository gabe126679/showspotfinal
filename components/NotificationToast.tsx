import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface NotificationToastData {
  id: string;
  title: string;
  message: string;
  type?: 'default' | 'success' | 'warning' | 'error';
}

interface NotificationToastProps {
  notifications: NotificationToastData[];
  onNotificationPress?: (notification: NotificationToastData) => void;
  onNotificationDismiss?: (notificationId: string) => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({
  notifications,
  onNotificationPress,
  onNotificationDismiss,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const translateY = useRef(new Animated.Value(-200)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Auto-advance timer
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const DISPLAY_DURATION = 4000; // 4 seconds per notification
  const FADE_DURATION = 300; // 300ms fade animation

  useEffect(() => {
    // Simple logic: show if we have notifications, hide if we don't
    if (notifications.length > 0 && !isVisible) {
      console.log('🍞 Showing toast for', notifications.length, 'notifications');
      showNotification();
    } else if (notifications.length === 0 && isVisible) {
      console.log('🍞 No more notifications, hiding toast');
      hideNotification();
    }
  }, [notifications.length]); // Only depend on notification count to avoid loops

  useEffect(() => {
    if (isVisible && notifications.length > 0) {
      startTimer();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentIndex, isVisible, notifications.length]);

  const startTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      // Always dismiss the current notification after display time
      if (notifications.length > 0 && onNotificationDismiss) {
        const currentNotification = notifications[currentIndex];
        if (currentNotification) {
          onNotificationDismiss(currentNotification.id);
        }
      }
    }, DISPLAY_DURATION);
  };

  const showNotification = useCallback(() => {
    console.log('🍞 Showing notification toast');
    setIsVisible(true);
    setCurrentIndex(0);
    
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      console.log('🍞 Toast animation completed');
    });
  }, [translateY, opacity]);

  const hideNotification = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -200,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
      setCurrentIndex(0);
      
      // Clear timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    });
  }, [translateY, opacity]);

  const handleNotificationPress = () => {
    const currentNotification = notifications[currentIndex];
    if (currentNotification && onNotificationPress) {
      onNotificationPress(currentNotification);
    }
    hideNotification();
  };

  const handleDismiss = () => {
    const currentNotification = notifications[currentIndex];
    if (currentNotification && onNotificationDismiss) {
      onNotificationDismiss(currentNotification.id);
    }
    
    // If there are more notifications, show the next one
    if (currentIndex < notifications.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      hideNotification();
    }
  };

  const getGradientColors = (type: string = 'default') => {
    switch (type) {
      case 'success':
        return ['#4CAF50', '#45a049'];
      case 'warning':
        return ['#FF9800', '#F57C00'];
      case 'error':
        return ['#F44336', '#D32F2F'];
      default:
        return ['#ff00ff', '#2a2882'];
    }
  };

  if (!isVisible || notifications.length === 0 || currentIndex >= notifications.length) {
    return null;
  }

  const currentNotification = notifications[currentIndex];
  const gradientColors = getGradientColors(currentNotification.type);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.toastContainer,
          {
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleNotificationPress}
          style={styles.touchableContainer}
        >
          <LinearGradient
            colors={gradientColors}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.contentContainer}>
              <View style={styles.textContainer}>
                <Text style={styles.title} numberOfLines={1}>
                  {currentNotification.title}
                </Text>
                <Text style={styles.message} numberOfLines={2}>
                  {currentNotification.message}
                </Text>
              </View>
              
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={handleDismiss}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.dismissText}>×</Text>
              </TouchableOpacity>
            </View>
            
            {/* Progress indicator for multiple notifications */}
            {notifications.length > 1 && (
              <View style={styles.progressContainer}>
                {notifications.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.progressDot,
                      index === currentIndex && styles.activeProgressDot,
                    ]}
                  />
                ))}
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100, // Position below the ShowSpotHeader (85px height + safe area)
    left: 0,
    right: 0,
    zIndex: 9999,
    pointerEvents: 'box-none',
  },
  toastContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    backgroundColor: 'rgba(255, 0, 255, 0.1)', // Debug background
  },
  touchableContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  message: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
    lineHeight: 18,
  },
  dismissButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dismissText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  activeProgressDot: {
    backgroundColor: '#fff',
  },
});

export default NotificationToast;