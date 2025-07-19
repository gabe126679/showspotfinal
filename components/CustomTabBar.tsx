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
    const iconProps = { width: 50, height: 50, fill: color };
    
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
      {/* Gesture Area - Only show on Profile screen */}
      {isProfileScreen && (
        <View style={styles.gestureArea}>
          {/* Profile Name Strip */}
          <LinearGradient
            colors={profileData.type === 'venue' 
              ? ["rgba(80, 200, 120, 0.95)", "rgba(255, 215, 0, 0.95)"] 
              : ["rgba(42, 40, 130, 0.95)", "rgba(255, 0, 255, 0.95)"]
            }
            style={styles.profileNameStrip}
          >
            <Text style={styles.profileNameText}>{profileData.name}</Text>
            <Text style={styles.profileTypeIndicator}>
              {profileData.type === 'spotter' ? '👤 Spotter' : 
               profileData.type === 'artist' ? '🎵 Artist' : '🏢 Venue'}
            </Text>
          </LinearGradient>
          
          {/* Gesture Handler Bar */}
          <PanGestureHandler
            onHandlerStateChange={handleGestureEvent}
          >
            <View 
              style={[styles.gestureBar, profileData.type === 'venue' && styles.venueGestureBar]}
            >
              <View style={styles.gestureHandle} />
              <Text style={styles.swipeText}>Swipe up</Text>
              <Text style={styles.upArrow}>▲</Text>
            </View>
          </PanGestureHandler>
        </View>
      )}
      
      {/* Tab Bar */}
      <View style={styles.tabBar}>
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
              style={styles.tabButton}
            >
              {getIconComponent(
                route.name, 
                isFocused ? '#ff00ff' : '#888'
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  gestureArea: {
    width: '100%',
  },
  profileNameStrip: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 15,
  },
  profileNameText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 0.5,
  },
  profileTypeIndicator: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    overflow: 'hidden',
  },
  gestureBar: {
    height: 50,
    backgroundColor: '#ff00ff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  venueGestureBar: {
    backgroundColor: '#FFD700',
  },
  gestureHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 2,
  },
  swipeText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  upArrow: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: 'bold',
    marginTop: -2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 10, 15, 0.95)',
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    borderTopWidth: 1,
    height: 85,
    paddingBottom: 12,
    paddingTop: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CustomTabBar;