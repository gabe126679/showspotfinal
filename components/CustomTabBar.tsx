import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

import HomeIcon from "../assets/home-icon.svg";
import SearchIcon from "../assets/search-icon.svg";
import CreateIcon from "../assets/create-icon.svg";
import PlayerIcon from "../assets/player-icon.svg";
import ProfileIcon from "../assets/profile-icon.svg";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CustomTabBarProps extends BottomTabBarProps {
  profileData?: {
    name: string;
    type: 'spotter' | 'artist' | 'venue';
  };
  onGesturePress?: () => void;
  onSwipeUp?: () => void;
}

const CustomTabBar: React.FC<CustomTabBarProps> = ({ 
  state, 
  descriptors, 
  navigation,
  profileData = { name: 'Profile', type: 'spotter' },
  onGesturePress,
  onSwipeUp 
}) => {
  const isProfileScreen = state.routes[state.index].name === 'Profile';
  
  const handleGestureEvent = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationY, velocityY } = event.nativeEvent;
      
      // Detect swipe up gesture (very sensitive for better UX)
      if (translationY < -20 || velocityY < -200) {
        console.log('Swipe up detected!');
        onSwipeUp?.();
      }
    }
  };
  
  const getIconComponent = (routeName: string, color: string) => {
    const iconProps = { width: 40, height: 40, fill: color };
    
    switch (routeName) {
      case 'MapHome':
        return <HomeIcon {...iconProps} />;
      case 'Search':
        return <SearchIcon {...iconProps} />;
      case 'Create':
        return <CreateIcon {...iconProps} />;
      case 'Player':
        return <PlayerIcon {...iconProps} />;
      case 'Profile':
        return <ProfileIcon {...iconProps} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Modern Compact Footer */}
      <LinearGradient
        colors={profileData.type === 'venue' 
          ? ['rgba(255, 215, 0, 0.95)', 'rgba(80, 200, 120, 0.95)'] 
          : ['rgba(255, 0, 255, 0.95)', 'rgba(42, 40, 130, 0.95)']
        }
        style={styles.modernFooter}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        {/* Gesture handler for profile screen */}
        {isProfileScreen && (
          <PanGestureHandler onHandlerStateChange={handleGestureEvent}>
            <View style={styles.gestureSection}>
              <View style={styles.modernGestureHandle} />
              <View style={styles.profileInfo}>
                <Text style={styles.profileNameCompact}>{profileData.name}</Text>
                <View style={styles.profileTypeBadge}>
                  <Text style={styles.profileTypeBadgeText}>
                    {profileData.type === 'spotter' ? '👤' : 
                     profileData.type === 'artist' ? '🎵' : '🏢'}
                  </Text>
                </View>
              </View>
            </View>
          </PanGestureHandler>
        )}

        {/* Tab Navigation */}
        <View style={styles.modernTabContainer}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                style={[
                  styles.modernTabButton,
                  isFocused && styles.activeTabButton
                ]}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.iconWrapper,
                  isFocused && styles.activeIconWrapper
                ]}>
                  {getIconComponent(
                    route.name, 
                    isFocused ? '#ffffff' : 'rgba(255, 255, 255, 0.6)'
                  )}
                </View>
                {isFocused && <View style={styles.activeIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  modernFooter: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 20,
    paddingBottom: 10,
    marginTop: 0,
  },
  gestureSection: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 30,
  },
  modernGestureHandle: {
    width: 50,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 2,
    alignSelf: 'center',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileNameCompact: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  profileTypeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  profileTypeBadgeText: {
    fontSize: 16,
  },
  modernTabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 8,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    minHeight: 50,
    width: '100%',
  },
  modernTabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 20,
    flex: 1,
    maxWidth: 70,
  },
  activeTabButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  iconWrapper: {
    padding: 4,
    borderRadius: 12,
    transition: 'all 0.2s ease',
  },
  activeIconWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
    marginTop: 4,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 3,
  },
});

export default CustomTabBar;