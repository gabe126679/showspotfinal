import * as React from "react";
import { View, Image, StyleSheet, Text, TouchableOpacity, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Svg, Path } from 'react-native-svg';
import { notificationService } from '../services/notificationService';
import { messagingService } from '../services/messagingService';
import { supabase } from '../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ShowSpotHeaderProps {
  showBackButton?: boolean;
  onBackPress?: () => void;
  onNotificationPress?: () => void;
  onMessagePress?: () => void;
  isVenue?: boolean;
}

// Notification Icon Component
const NotificationIcon = ({ width = 25, height = 25, color = "#fff" }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
      fill={color}
    />
  </Svg>
);

// Message Icon Component
const MessageIcon = ({ width = 25, height = 25, color = "#fff" }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"
      fill={color}
    />
  </Svg>
);

const ShowSpotHeader: React.FC<ShowSpotHeaderProps> = ({
  showBackButton = false,
  onBackPress,
  onNotificationPress,
  onMessagePress,
  isVenue = false,
}) => {
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = React.useState(0);
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [currentEntity, setCurrentEntity] = React.useState<{ id: string; type: 'spotter' | 'artist' | 'venue' } | null>(null);
  const gradientColors = isVenue ? ['#FFD700', '#50C878'] : ['#ff00ff', '#2a2882'];

  React.useEffect(() => {
    getCurrentUser();
  }, []);

  React.useEffect(() => {
    if (currentUser) {
      fetchUnreadCount();
      fetchCurrentEntity();
    }
  }, [currentUser]);

  React.useEffect(() => {
    if (currentEntity) {
      fetchUnreadMessageCount();
    }
  }, [currentEntity]);

  // Manually refresh unread counts every 30 seconds
  React.useEffect(() => {
    if (!currentUser || !currentEntity) return;
    
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchUnreadMessageCount();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [currentUser, currentEntity, fetchUnreadCount, fetchUnreadMessageCount]);

  const getCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setCurrentUser(session.user);
      }
    } catch (error) {
      console.error('Error getting current user in ShowSpotHeader:', error);
    }
  };

  const fetchCurrentEntity = async () => {
    if (!currentUser) return;
    
    try {
      const result = await messagingService.getCurrentEntity(currentUser.id);
      if (result.success && result.data) {
        setCurrentEntity(result.data);
      }
    } catch (error) {
      console.error('Error fetching current entity:', error);
    }
  };

  const fetchUnreadCount = React.useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const result = await notificationService.getUnreadCount(currentUser.id);
      if (result.success) {
        setUnreadCount(result.count || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [currentUser]);

  const fetchUnreadMessageCount = React.useCallback(async () => {
    if (!currentEntity) return;
    
    try {
      const result = await messagingService.getUnreadMessageCount(
        currentEntity.id,
        currentEntity.type
      );
      if (result.success && result.data !== undefined) {
        setUnreadMessageCount(result.data);
      }
    } catch (error) {
      console.error('Error fetching unread message count:', error);
    }
  }, [currentEntity]);

  // Expose refresh function for manual updates
  React.useEffect(() => {
    if (currentUser) {
      // Store refresh function globally so other components can call it
      (global as any).refreshNotificationCount = fetchUnreadCount;
    }
  }, [currentUser, fetchUnreadCount]);
  
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: gradientColors[1] }]}>
      <LinearGradient
        colors={gradientColors}
        style={styles.headerContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        {/* Left side - Back button or ShowSpot logo */}
        <View style={styles.leftSection}>
          {showBackButton ? (
            <TouchableOpacity 
              style={styles.backButton}
              onPress={onBackPress}
            >
              <Text style={styles.backArrowText}>←</Text>
            </TouchableOpacity>
          ) : (
            <Image 
              style={styles.logoImage} 
              resizeMode="cover" 
              source={require("../assets/showspotlogo.png")} 
            />
          )}
        </View>
        
        {/* Center - ShowSpot text */}
        <View style={styles.centerSection}>
          <Text style={styles.showspotText}>ShowSpot</Text>
        </View>
        
        {/* Right side - Notification and Message icons */}
        <View style={styles.rightSection}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={onNotificationPress}
          >
            <NotificationIcon width={24} height={24} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.notificationDot} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={onMessagePress}
          >
            <MessageIcon width={24} height={24} color="#fff" />
            {unreadMessageCount > 0 && (
              <View style={styles.notificationDot} />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    // backgroundColor will be set dynamically
  },
  headerContainer: {
    width: "100%",
    height: 85,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  leftSection: {
    width: 70,
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-start",
  },
  centerSection: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  rightSection: {
    width: 80,
    height: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
  },
  logoImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  showspotText: {
    fontSize: 28,
    fontFamily: "Audiowide-Regular",
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 22,
  },
  backArrowText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4444',
    borderWidth: 1,
    borderColor: '#fff',
  },
});

export default ShowSpotHeader;