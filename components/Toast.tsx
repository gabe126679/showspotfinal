// Toast Component
// Global toast notification system for quick user feedback
// Usage: const { showToast } = useToast(); showToast('Success!', 'success');

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing, borderRadius, toast as toastConfig } from '../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'default';
export type ToastPosition = 'top' | 'bottom';

interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  position: ToastPosition;
}

interface ToastContextType {
  showToast: (
    message: string,
    type?: ToastType,
    options?: {
      duration?: number;
      position?: ToastPosition;
    }
  ) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

// Toast icons
const getToastIcon = (type: ToastType): string => {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'warning':
      return '!';
    case 'info':
      return 'i';
    default:
      return '•';
  }
};

// Toast colors
const getToastColors = (type: ToastType) => {
  switch (type) {
    case 'success':
      return {
        background: colors.status.success,
        icon: '#fff',
      };
    case 'error':
      return {
        background: colors.status.error,
        icon: '#fff',
      };
    case 'warning':
      return {
        background: colors.status.warning,
        icon: '#fff',
      };
    case 'info':
      return {
        background: colors.status.info,
        icon: '#fff',
      };
    default:
      return {
        background: colors.primary.deepPurple,
        icon: '#fff',
      };
  }
};

// Toast Provider Component
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toast, setToast] = useState<ToastData | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const insets = useSafeAreaInsets();

  const hideToast = useCallback(() => {
    const toValue = toast?.position === 'bottom' ? 100 : -100;

    Animated.parallel([
      Animated.timing(translateY, {
        toValue,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  }, [toast?.position, translateY, opacity]);

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = 'default',
      options?: {
        duration?: number;
        position?: ToastPosition;
      }
    ) => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const duration = options?.duration ?? toastConfig.duration.medium;
      const position = options?.position ?? 'top';

      const newToast: ToastData = {
        id: Date.now().toString(),
        message,
        type,
        duration,
        position,
      };

      setToast(newToast);

      // Reset animation values
      const startValue = position === 'bottom' ? 100 : -100;
      translateY.setValue(startValue);
      opacity.setValue(0);

      // Animate in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide
      timeoutRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [translateY, opacity, hideToast]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const toastColors = toast ? getToastColors(toast.type) : null;

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}

      {toast && toastColors && (
        <Animated.View
          style={[
            styles.container,
            toast.position === 'bottom'
              ? { bottom: insets.bottom + toastConfig.position.bottom }
              : { top: insets.top + toastConfig.position.top },
            {
              transform: [{ translateY }],
              opacity,
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={hideToast}
            style={[
              styles.toast,
              { backgroundColor: toastColors.background },
            ]}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
              ]}
            >
              <Text style={styles.icon}>{getToastIcon(toast.type)}</Text>
            </View>
            <Text style={styles.message} numberOfLines={2}>
              {toast.message}
            </Text>
            <TouchableOpacity
              onPress={hideToast}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

// Hook to use toast
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Standalone toast component for imperative usage
// This can be called without a provider using ToastManager
class ToastManagerClass {
  private showToastFn: ToastContextType['showToast'] | null = null;
  private hideToastFn: ToastContextType['hideToast'] | null = null;

  setToastFunctions(
    show: ToastContextType['showToast'],
    hide: ToastContextType['hideToast']
  ) {
    this.showToastFn = show;
    this.hideToastFn = hide;
  }

  show(
    message: string,
    type?: ToastType,
    options?: { duration?: number; position?: ToastPosition }
  ) {
    if (this.showToastFn) {
      this.showToastFn(message, type, options);
    } else {
      console.warn('ToastManager: Toast functions not initialized');
    }
  }

  hide() {
    if (this.hideToastFn) {
      this.hideToastFn();
    }
  }

  // Convenience methods
  success(message: string, options?: { duration?: number; position?: ToastPosition }) {
    this.show(message, 'success', options);
  }

  error(message: string, options?: { duration?: number; position?: ToastPosition }) {
    this.show(message, 'error', options);
  }

  warning(message: string, options?: { duration?: number; position?: ToastPosition }) {
    this.show(message, 'warning', options);
  }

  info(message: string, options?: { duration?: number; position?: ToastPosition }) {
    this.show(message, 'info', options);
  }
}

export const ToastManager = new ToastManagerClass();

// Helper component to connect ToastManager to context
export const ToastManagerConnector: React.FC = () => {
  const { showToast, hideToast } = useToast();

  useEffect(() => {
    ToastManager.setToastFunctions(showToast, hideToast);
  }, [showToast, hideToast]);

  return null;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    zIndex: 99999,
    elevation: 99999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  icon: {
    color: '#fff',
    fontSize: fonts.size.base,
    fontWeight: 'bold',
  },
  message: {
    flex: 1,
    color: '#fff',
    fontSize: fonts.size.md,
    fontFamily: fonts.family.regular,
    lineHeight: 20,
  },
  closeButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  closeText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default ToastProvider;
