import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Image,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Animated,
  PanResponder,
  StatusBar,
  Platform,
  Vibration,
  Modal,
  Alert,
} from "react-native";
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { LinearGradient } from "expo-linear-gradient";
import ShowSpotHeader from "./ShowSpotHeader";
import ShowVoteButton from "./ShowVoteButton";
import RatingModal from "./RatingModal";
import { ratingService, RatingInfo } from '../services/ratingService';
import { followerService, FollowerInfo } from '../services/followerService';
import TipModal from "./TipModal";
import PaymentDisclaimer from "./PaymentDisclaimer";
import { formatShowDateTime } from '../utils/showDateDisplay';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
// iPhone 16 specific dimensions for gesture positioning - matching profile.tsx exactly
const IPHONE_16_HEIGHT = 852; // iPhone 16 screen height
const ACTUAL_TAB_BAR_HEIGHT = 85; // Bottom tab bar height
const GESTURE_AREA_HEIGHT = 95; // Our gesture area height
const HEADER_HEIGHT = 85;
const FOOTER_HEIGHT = 85;
const HANDLE_HEIGHT = 30;
const TAB_HEIGHT = 80;
const COLLAPSED_HEIGHT = 180;
const COLLAPSED_TRANSLATE_Y = SCREEN_HEIGHT - COLLAPSED_HEIGHT - FOOTER_HEIGHT;
// Optimized height for iPhone 16 - focus on images as primary visual
const IMAGE_SECTION_HEIGHT = 610; // Matching artistPublicProfile exactly

interface TabData {
  id: string;
  title: string;
  expanded: boolean;
  data?: any[];
}

const VENUE_TABS: TabData[] = [
  { id: "activeShows", title: "active shows", expanded: false },
  { id: "pendingShows", title: "pending shows", expanded: false },
  { id: "backliningShows", title: "backlining shows", expanded: false },
  { id: "hostedShows", title: "hosted shows", expanded: false },
  { id: "info", title: "venue info", expanded: false },
];

interface VenueData {
  venue_id: string;
  venue_name: string;
  venue_profile_image: string;
  venue_secondary_images?: string[];
  spotter_id: string;
  venue_bio?: string;
  venue_location?: string;
  venue_capacity?: number;
  venue_address?: string;
  venue_phone?: string;
  venue_email?: string;
  created_at: string;
}

interface VenuePublicProfileProps {
  route: {
    params: {
      venue_id: string;
    };
  };
}

const VenuePublicProfile: React.FC<VenuePublicProfileProps> = ({ route }) => {
  const { venue_id } = route.params;
  const navigation = useNavigation();
  const router = useRouter();

  // Venue data states
  const [venueData, setVenueData] = useState<VenueData | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  
  // Shows data states
  const [activeShows, setActiveShows] = useState<any[]>([]);
  const [pendingShows, setPendingShows] = useState<any[]>([]);
  const [hostedShows, setHostedShows] = useState<any[]>([]);
  
  // Rating states
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingInfo, setRatingInfo] = useState<RatingInfo | null>(null);
  
  // Follower states
  const [followerInfo, setFollowerInfo] = useState<FollowerInfo | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  
  // Tip states
  const [showTipModal, setShowTipModal] = useState(false);
  const [showPaymentDisclaimer, setShowPaymentDisclaimer] = useState(false);
  const [pendingAction, setPendingAction] = useState<{type: string, data?: any} | null>(null);
  
  // Common states - matching profile.tsx exactly
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  
  // Full-screen image modal - matching profile.tsx exactly
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Handle image press for full-screen view
  const handleImagePress = (imageUri: string) => {
    setSelectedImage(imageUri);
    setShowImageModal(true);
  };

  // Handle edit profile images
  const handleEditImages = () => {
    setShowImageModal(false);
    navigation.navigate('VenuePicture' as never);
  };

  // Tabs state
  const [tabs, setTabs] = useState<TabData[]>(VENUE_TABS);

  // Animation refs - matching bandPublicProfile.tsx exactly
  const panelTranslateY = useRef(new Animated.Value(COLLAPSED_TRANSLATE_Y)).current;
  const handleOpacity = useRef(new Animated.Value(1)).current;
  const nameOpacity = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Initialize gesture handlers and animations - matching bandPublicProfile.tsx exactly
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        if (Platform.OS === 'ios') {
          try {
            (Vibration as any).impact && (Vibration as any).impact('light');
          } catch (error) {
            // Fallback for older versions
            Vibration.vibrate(50);
          }
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!expanded && gestureState.dy < 0) {
          // Swipe up to expand
          const newValue = Math.max(0, COLLAPSED_TRANSLATE_Y + gestureState.dy);
          panelTranslateY.setValue(newValue);
        } else if (expanded && gestureState.dy > 0) {
          // Swipe down to collapse
          const newValue = Math.min(COLLAPSED_TRANSLATE_Y, gestureState.dy);
          panelTranslateY.setValue(newValue);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (!expanded && gestureState.dy < -50) {
          // Expand panel on swipe up
          expandPanel();
        } else if (expanded && gestureState.dy > 50) {
          // Collapse panel on swipe down
          collapsePanel();
        } else {
          // Snap back to current state
          Animated.spring(panelTranslateY, {
            toValue: expanded ? 0 : COLLAPSED_TRANSLATE_Y,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const expandPanel = useCallback(() => {
    setExpanded(true);
    
    Animated.parallel([
      Animated.spring(panelTranslateY, {
        toValue: 0,
        useNativeDriver: false,
        tension: 120,
        friction: 7,
        overshootClamping: false,
      }),
      Animated.timing(handleOpacity, {
        toValue: 0.6,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(nameOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [panelTranslateY, handleOpacity, nameOpacity]);

  const collapsePanel = useCallback(() => {
    setExpanded(false);
    
    // Collapse all tabs when panel closes
    setTabs(prevTabs => 
      prevTabs.map(tab => ({ ...tab, expanded: false }))
    );
    
    Animated.parallel([
      Animated.spring(panelTranslateY, {
        toValue: COLLAPSED_TRANSLATE_Y,
        useNativeDriver: false,
        tension: 110,
        friction: 8,
        overshootClamping: false,
      }),
      Animated.timing(handleOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(nameOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [panelTranslateY, handleOpacity, nameOpacity]);

  // Gesture handler for panel header swipe down - matching bandPublicProfile.tsx exactly
  const handlePanelGesture = useCallback((event: any) => {
    const { nativeEvent } = event;
    
    if (nativeEvent.state === State.END) {
      const { translationY, velocityY } = nativeEvent;
      
      // Only allow swipe down when panel is expanded
      if (expanded && (translationY > 50 || velocityY > 300)) {
        collapsePanel();
      }
    }
  }, [expanded, collapsePanel]);

  const toggleTab = useCallback((tabId: string) => {
    if (Platform.OS === 'ios') {
      Vibration.vibrate(10);
    }
    
    setTabs(prevTabs => 
      prevTabs.map(tab => ({
        ...tab,
        expanded: tab.id === tabId ? !tab.expanded : false
      }))
    );
  }, []);

  // Fetch venue data
  const fetchVenueData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      
      if (session?.user) {
        setCurrentUser(session.user);
        
        // Check if current user owns this venue profile
        const { data: userVenue } = await supabase
          .from('venues')
          .select('venue_id')
          .eq('spotter_id', session.user.id);
        
        const userVenueIds = userVenue?.map(v => v.venue_id) || [];
        setIsOwner(userVenueIds.includes(venue_id));
      }

      // Get venue data
      const { data: venue, error: venueError } = await supabase
        .from('venues')
        .select('*')
        .eq('venue_id', venue_id)
        .single();

      if (venueError) {
        throw new Error(`Failed to fetch venue: ${venueError.message}`);
      }

      if (venue) {
        console.log('Venue data fetched:', {
          venue_name: venue.venue_name,
          venue_profile_image: venue.venue_profile_image,
          venue_secondary_images: venue.venue_secondary_images,
          secondary_images_length: venue.venue_secondary_images?.length || 0
        });
        setVenueData(venue);
      }

      // Fetch shows hosted by this venue
      await fetchVenueShows(venue_id);

      // Fetch rating info for this venue
      await fetchRatingInfo(venue_id, session?.user?.id);

      // Fetch follower info for this venue
      await fetchFollowerInfo(venue_id, session?.user?.id);

      // Fade in animation - matching bandPublicProfile.tsx
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
      
    } catch (err: any) {
      console.error('Error fetching venue data:', err);
      setError(err.message || 'Failed to load venue data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch rating info for the venue
  const fetchRatingInfo = async (venueId: string, userId?: string) => {
    try {
      const result = await ratingService.getRatingInfo(venueId, 'venue', userId);
      if (result.success && result.data) {
        setRatingInfo(result.data);
      }
    } catch (error) {
      console.error('Error fetching rating info:', error);
    }
  };

  // Handle rating button press
  const handleRatingPress = () => {
    if (!currentUser) {
      Alert.alert('Not Logged In', 'Please log in to rate this venue.');
      return;
    }
    setShowRatingModal(true);
  };

  // Handle rating submitted
  const handleRatingSubmitted = (newRating: RatingInfo) => {
    setRatingInfo(newRating);
  };

  // Fetch follower info for the venue
  const fetchFollowerInfo = async (venueId: string, userId?: string) => {
    try {
      const result = await followerService.getFollowerInfo(venueId, 'venue', userId);
      if (result.success && result.data) {
        setFollowerInfo(result.data);
        setIsFollowing(result.data.userIsFollowing);
      }
    } catch (error) {
      console.error('Error fetching follower info:', error);
    }
  };

  // Handle follow button press
  const handleFollowPress = async () => {
    if (!currentUser) {
      Alert.alert('Not Logged In', 'Please log in to follow this venue.');
      return;
    }

    try {
      const result = await followerService.toggleFollow(venue_id, 'venue', currentUser.id);
      if (result.success && result.data) {
        setFollowerInfo(result.data);
        setIsFollowing(result.data.userIsFollowing);
      } else {
        Alert.alert('Error', result.error || 'Failed to update follow status');
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  // Fetch shows hosted by this venue
  const fetchVenueShows = async (venueId: string) => {
    try {
      console.log('🏛️ Fetching shows for venue:', venueId);
      
      // Get all shows where this venue is the host venue
      const { data: shows, error } = await supabase
        .from('shows')
        .select('*')
        .eq('show_venue', venueId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching venue shows:', error);
        return;
      }

      console.log('🏛️ Found shows for venue:', shows?.length || 0);

      if (shows) {
        // Separate shows by status
        const active = shows.filter(show => show.show_status === 'active');
        const pending = shows.filter(show => show.show_status === 'pending');
        // Clear hosted shows for now - will be populated later
        const hosted: any[] = [];
        
        setActiveShows(active);
        setPendingShows(pending);
        setHostedShows(hosted);

        console.log('🏛️ Venue shows categorized:', {
          active: active.length,
          pending: pending.length,
          hosted: hosted.length
        });
      }
    } catch (error) {
      console.error('Error fetching venue shows:', error);
    }
  };

  // Payment disclaimer handlers
  const handlePaymentAction = (actionType: string, actionData?: any) => {
    setPendingAction({ type: actionType, data: actionData });
    setShowPaymentDisclaimer(true);
  };

  const handlePaymentProceed = () => {
    setShowPaymentDisclaimer(false);
    
    if (pendingAction) {
      switch (pendingAction.type) {
        case 'tip':
          setShowTipModal(true);
          break;
      }
      setPendingAction(null);
    }
  };

  const handlePaymentCancel = () => {
    setShowPaymentDisclaimer(false);
    setPendingAction(null);
  };

  useEffect(() => {
    fetchVenueData();
  }, [venue_id]);

  // Get current venue data for display
  const getCurrentVenueData = () => {
    if (!venueData) return { name: "Venue", images: [] };
    
    // Ensure URLs are properly formatted
    const formatImageUrl = (url: string) => {
      if (!url) return null;
      // If already a full URL, return as is
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      // If it's a storage path, construct the full URL
      // This shouldn't be needed if getPublicUrl worked correctly, but just in case
      console.log('Raw image URL from database:', url);
      return url;
    };

    // Get profile image
    const profileImage = formatImageUrl(venueData.venue_profile_image);
    
    // Get secondary images, excluding the profile image to avoid duplicates
    const secondaryImages = (venueData.venue_secondary_images || [])
      .filter(img => img && img !== venueData.venue_profile_image)
      .map(formatImageUrl)
      .filter(Boolean);
    
    // Combine profile image first, then secondary images
    const allImages = profileImage ? [profileImage, ...secondaryImages] : secondaryImages;

    console.log('Venue images for display:', allImages);
    
    return {
      name: venueData.venue_name,
      images: allImages,
    };
  };

  // Render tab content - matching bandPublicProfile.tsx exactly
  const renderTabContent = (tabId?: string) => {
    switch (tabId) {
      case 'activeShows':
        return (
          <View style={styles.tabContent}>
            <ScrollView 
              style={styles.showsContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {activeShows.length > 0 ? (
                activeShows.map((show) => (
                  <TouchableOpacity 
                    key={show.show_id} 
                    style={styles.showItem}
                    onPress={() => navigation.navigate('ShowBill' as never, { show_id: show.show_id } as never)}
                  >
                    <View style={styles.showInfo}>
                      <Text style={styles.showTitle}>Show at {venueData?.venue_name}</Text>
                      <Text style={styles.showDate}>
                        {formatShowDateTime(show.show_date, show.show_time, show.show_preferred_date, show.show_preferred_time)}
                      </Text>
                      <Text style={styles.showStatus}>Status: {show.show_status}</Text>
                      <Text style={styles.showLineup}>
                        {show.show_members?.length || 0} performer(s)
                      </Text>
                    </View>
                    <Text style={styles.showArrow}>→</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noShowsText}>No active shows</Text>
              )}
            </ScrollView>
          </View>
        );

      case 'pendingShows':
        return (
          <View style={styles.tabContent}>
            <ScrollView 
              style={styles.showsContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {pendingShows.length > 0 ? (
                pendingShows.map((show) => (
                  <TouchableOpacity 
                    key={show.show_id} 
                    style={styles.showItem}
                    onPress={() => navigation.navigate('ShowBill' as never, { show_id: show.show_id } as never)}
                  >
                    <View style={styles.showInfo}>
                      <Text style={styles.showTitle}>Show at {venueData?.venue_name}</Text>
                      <Text style={styles.showDate}>
                        {formatShowDateTime(show.show_date, show.show_time, show.show_preferred_date, show.show_preferred_time)}
                      </Text>
                      <Text style={styles.showStatus}>Status: {show.show_status}</Text>
                      <Text style={styles.showLineup}>
                        {show.show_members?.length || 0} performer(s)
                      </Text>
                    </View>
                    <View style={styles.voteSection}>
                      <ShowVoteButton 
                        showId={show.show_id}
                        buttonStyle={styles.voteButton}
                        textStyle={styles.voteButtonText}
                        countStyle={styles.voteCountText}
                      />
                    </View>
                    <Text style={styles.showArrow}>→</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noShowsText}>No pending shows</Text>
              )}
            </ScrollView>
          </View>
        );

      case 'hostedShows':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.comingSoonText}>
              Hosted shows will appear here after the show date has passed
            </Text>
          </View>
        );

      case 'info':
        return (
          <View style={styles.tabContent}>
            <ScrollView 
              style={styles.infoContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              <Text style={styles.infoText}>
                Venue Name: {venueData?.venue_name || 'Unknown'}
              </Text>
              {venueData?.venue_location && (
                <Text style={styles.infoText}>
                  Location: {venueData.venue_location}
                </Text>
              )}
              {venueData?.venue_address && (
                <Text style={styles.infoText}>
                  Address: {typeof venueData.venue_address === 'object' 
                    ? venueData.venue_address.address || JSON.stringify(venueData.venue_address)
                    : venueData.venue_address}
                </Text>
              )}
              {venueData?.venue_capacity && (
                <Text style={styles.infoText}>
                  Capacity: {venueData.venue_capacity} people
                </Text>
              )}
              {venueData?.venue_phone && (
                <Text style={styles.infoText}>
                  Phone: {venueData.venue_phone}
                </Text>
              )}
              {venueData?.venue_email && (
                <Text style={styles.infoText}>
                  Email: {venueData.venue_email}
                </Text>
              )}
              {venueData?.venue_bio && (
                <Text style={styles.infoText}>
                  About: {venueData.venue_bio}
                </Text>
              )}
            </ScrollView>
          </View>
        );

      default:
        return (
          <View style={styles.tabContent}>
            <Text style={styles.comingSoonText}>
              {VENUE_TABS.find(tab => tab.id === tabId)?.title} - Coming Soon
            </Text>
          </View>
        );
    }
  };

  // Render loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={["#2a2882", "#ff00ff"]}
          style={StyleSheet.absoluteFillObject}
        />
        <ShowSpotHeader 
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          onNotificationPress={() => {
            navigation.navigate('NotificationsPage' as never);
          }}
          onMessagePress={() => {
            navigation.navigate('MessagesPage' as never);
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading venue profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={["#2a2882", "#ff00ff"]}
          style={StyleSheet.absoluteFillObject}
        />
        <ShowSpotHeader 
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          onNotificationPress={() => {
            navigation.navigate('NotificationsPage' as never);
          }}
          onMessagePress={() => {
            navigation.navigate('MessagesPage' as never);
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchVenueData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentData = getCurrentVenueData();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2a2882" />
      
      {/* Header */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={["#2a2882", "#ff00ff"]}
          style={StyleSheet.absoluteFillObject}
        />
        <ShowSpotHeader 
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          onNotificationPress={() => {
            navigation.navigate('NotificationsPage' as never);
          }}
          onMessagePress={() => {
            navigation.navigate('MessagesPage' as never);
          }}
        />
      </View>

      {/* Main content area with fixed height */}
      <View style={styles.mainContent} {...panResponder.panHandlers}>
        
        {/* Image section with fixed height */}
        <View style={styles.imageSection}>
          <ScrollView 
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
            style={styles.imageScrollView}
          >
            {currentData.images.length > 0 ? (
              currentData.images.map((imageUri, index) => (
                <View 
                  key={index}
                  style={styles.imageContainer}
                >
                  <TouchableOpacity 
                    style={styles.imageTouch}
                    onPress={() => handleImagePress(imageUri)}
                    activeOpacity={0.9}
                  >
                    <Image 
                      source={{ uri: imageUri }} 
                      style={styles.profileImage}
                      onError={(error) => {
                        console.error(`Image loading error for ${imageUri}:`, error);
                      }}
                      onLoad={() => {
                        console.log(`Image loaded successfully: ${imageUri}`);
                      }}
                    />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <View style={styles.imageContainer}>
                <View style={styles.placeholderImage}>
                  <Text style={styles.placeholderText}>No Image</Text>
                </View>
              </View>
            )}
          </ScrollView>
          
          {/* Follow button at top right */}
          <TouchableOpacity style={styles.followButton} onPress={handleFollowPress}>
            <LinearGradient
              colors={isFollowing ? ["#4CAF50", "#45a049"] : ["#ff00ff", "#2a2882"]}
              style={styles.followButtonGradient}
            >
              <Image 
                source={require('../assets/follow.png')} 
                style={[styles.followIcon, isFollowing && styles.followingIcon]}
              />
              <Text style={styles.followCount}>
                {followerInfo ? followerInfo.followerCount : 0}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Name and Rating Overlay - matching bandPublicProfile.tsx exactly */}
        <Animated.View 
          style={[styles.nameRatingOverlay, { opacity: nameOpacity }]} 
          pointerEvents="box-none"
        >
          {/* Name on bottom left */}
          <View style={styles.nameContainer}>
            <LinearGradient
              colors={["rgba(0, 0, 0, 0.8)", "rgba(0, 0, 0, 0.4)"]}
              style={styles.nameBackground}
            >
              <Text style={styles.profileNameText} numberOfLines={1}>
                {currentData.name}
              </Text>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Instagram-style Action Buttons */}
        <Animated.View style={[styles.modernActionContainer, { opacity: nameOpacity }]}>
          {/* Tip button on top - only show if not owner */}
          {!isOwner && (
            <TouchableOpacity 
              style={styles.instagramActionButton} 
              onPress={() => handlePaymentAction('tip')}
              activeOpacity={0.7}
            >
              <View style={styles.instagramButtonInner}>
                <Text style={styles.instagramPlusIcon}>+</Text>
                <Text style={styles.instagramButtonLabel}>Tip</Text>
              </View>
            </TouchableOpacity>
          )}
          
          {/* Rating button below */}
          <TouchableOpacity 
            style={styles.instagramActionButton} 
            onPress={handleRatingPress}
            activeOpacity={0.7}
          >
            <View style={styles.instagramButtonInner}>
              <Text style={styles.instagramStarIcon}>☆</Text>
              <Text style={styles.instagramButtonLabel}>Rating</Text>
              <Text style={styles.instagramRatingInfo}>
                {ratingInfo ? ratingInfo.currentRating.toFixed(1) : '0.0'} • {ratingInfo?.totalRaters || 0}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Sliding panel - matching bandPublicProfile.tsx exactly */}
        <Animated.View
          style={[
            styles.scrollablePanel,
            {
              transform: [{ translateY: panelTranslateY }],
            },
          ]}
        >
          {/* Name header inside panel with swipe down gesture */}
          <PanGestureHandler onHandlerStateChange={handlePanelGesture}>
            <LinearGradient
              colors={["#2a2882", "#ff00ff"]}
              style={styles.panelHeader}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.nameTextInside} numberOfLines={1}>
                {currentData.name}
              </Text>
              {/* Add subtle visual indicator for swipe down */}
              {expanded && (
                <Text style={styles.swipeDownIndicator}>▼</Text>
              )}
            </LinearGradient>
          </PanGestureHandler>

          {/* Scrollable tabs */}
          <ScrollView
            style={styles.tabsContainer}
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            {tabs.map((tab, index) => (
              <View key={tab.id} style={styles.tabContainer}>
                <TouchableOpacity
                  style={[
                    styles.dropdownTab,
                    tab.expanded && styles.dropdownTabExpanded,
                    index === tabs.length - 1 && styles.lastTab,
                  ]}
                  onPress={() => toggleTab(tab.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dropdownText}>{tab.title}</Text>
                  <Text style={[styles.arrow, { transform: [{ rotate: tab.expanded ? '180deg' : '0deg' }] }]}>
                    ▼
                  </Text>
                </TouchableOpacity>
                
                {tab.expanded && (
                  <View style={styles.dropdownContent}>
                    {renderTabContent(tab.id)}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

        </Animated.View>
      </View>

      {/* Full-screen image modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalContainer}>
          <TouchableOpacity 
            style={styles.imageModalBackground}
            onPress={() => setShowImageModal(false)}
            activeOpacity={1}
          >
            <Image 
              source={{ uri: selectedImage || '' }} 
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
            
            {/* Back button */}
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => setShowImageModal(false)}
            >
              <LinearGradient
                colors={["rgba(0, 0, 0, 0.8)", "rgba(0, 0, 0, 0.6)"]}
                style={styles.backButtonGradient}
              >
                <Text style={styles.backButtonText}>← Back</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            {/* Edit button - only show for venue owner */}
            {isOwner && (
              <TouchableOpacity 
                style={styles.editImageButton}
                onPress={handleEditImages}
              >
                <LinearGradient
                  colors={["#ff00ff", "#2a2882"]}
                  style={styles.editImageButtonGradient}
                >
                  <Text style={styles.editImageButtonText}>Edit Photos</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Rating Modal */}
      <RatingModal
        visible={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        entityId={venue_id}
        entityType="venue"
        entityName={venueData?.venue_name || 'Venue'}
        onRatingSubmitted={handleRatingSubmitted}
      />

      <TipModal
        visible={showTipModal}
        onClose={() => setShowTipModal(false)}
        recipientId={venue_id}
        recipientType="venue"
        recipientName={venueData?.venue_name || 'Venue'}
      />

      <PaymentDisclaimer
        visible={showPaymentDisclaimer}
        onClose={handlePaymentCancel}
        onProceed={handlePaymentProceed}
        action="tip"
        itemName={venueData?.venue_name}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2a2882',
    paddingTop: Platform.OS === 'ios' ? 44 : 0, // Status bar height
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT + (Platform.OS === 'ios' ? 44 : 0),
    zIndex: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Amiko-Regular',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Amiko-Regular',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
  },
  imageSection: {
    height: IMAGE_SECTION_HEIGHT,
    position: 'relative',
    marginTop: 105,
  },
  imageScrollView: {
    flex: 1,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_SECTION_HEIGHT,
  },
  imageTouch: {
    width: '100%',
    height: '100%',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Amiko-Regular',
  },
  scrollablePanel: {
    position: "absolute",
    top: COLLAPSED_HEIGHT - 50,
    left: 0,
    right: 0,
    bottom: FOOTER_HEIGHT - 170,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 15,
    zIndex: 10,
  },
  panelHeader: {
    paddingVertical: 32.5,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'relative',
  },
  nameTextInside: {
    fontSize: 24,
    fontFamily: "Audiowide-Regular",
    color: "#fff",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  swipeDownIndicator: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "bold",
    position: "absolute",
    left: 20,
  },
  ownerBadge: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ownerBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
  },
  tabsContainer: {
    flex: 1,
  },
  tabContainer: {
    backgroundColor: "#fff",
  },
  dropdownTab: {
    height: TAB_HEIGHT,
    borderBottomWidth: 1,
    borderColor: "#f0f0f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    backgroundColor: "#fff",
  },
  dropdownTabExpanded: {
    backgroundColor: "#f8f8f8",
    borderBottomColor: "#ff00ff",
  },
  lastTab: {
    borderBottomWidth: 0,
  },
  dropdownText: {
    fontSize: 18,
    fontFamily: "Amiko-Regular",
    color: "#333",
    textTransform: "capitalize",
    fontWeight: "500",
  },
  arrow: {
    fontSize: 16,
    color: "#ff00ff",
    fontWeight: "bold",
  },
  dropdownContent: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: "#f0f0f0",
  },
  tabContent: {
    flex: 1,
  },
  infoContainer: {
    flex: 1,
  },
  infoText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#333',
    marginBottom: 12,
    lineHeight: 24,
  },
  comingSoonText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 40,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalBackground: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  nameContainer: {
    position: 'absolute',
    bottom: 140, // Position above the collapsed tabs panel
    left: 20,
    zIndex: 10,
  },
  nameBackground: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  profileNameText: {
    fontSize: 20,
    fontFamily: 'Audiowide-Regular',
    color: '#fff',
  },
  // Modern action buttons styles - matching bandPublicProfile.tsx
  // Instagram-style action buttons
  modernActionContainer: {
    position: 'absolute',
    bottom: 140,
    right: 20,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 10,
  },
  instagramActionButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 60,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  instagramButtonInner: {
    alignItems: 'center',
  },
  instagramStarIcon: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '400',
    marginBottom: 2,
  },
  instagramPlusIcon: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '300',
    marginBottom: 2,
  },
  instagramButtonLabel: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
    fontFamily: 'Amiko-Regular',
    marginTop: 2,
  },
  instagramRatingInfo: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '400',
    fontFamily: 'Amiko-Regular',
    marginTop: 2,
    opacity: 0.9,
  },
  nameRatingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: IMAGE_SECTION_HEIGHT,
    justifyContent: 'flex-end',
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  followButton: {
    position: 'absolute',
    top: 40,
    right: 45,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  followButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
    marginBottom: 4,
  },
  followingIcon: {
    tintColor: '#fff',
  },
  followCount: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#fff',
    fontWeight: '600',
  },
  // Shows styles
  showsContainer: {
    flex: 1,
  },
  showItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  showInfo: {
    flex: 1,
    marginRight: 10,
  },
  showTitle: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#333',
    fontWeight: '600',
    marginBottom: 4,
  },
  showDate: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    marginBottom: 2,
  },
  showStatus: {
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    color: '#2a2882',
    fontWeight: '600',
  },
  showLineup: {
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    color: '#999',
    marginTop: 2,
  },
  showArrow: {
    fontSize: 18,
    color: '#2a2882',
    fontWeight: 'bold',
  },
  noShowsText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  
  // Vote section styles
  voteSection: {
    marginLeft: 10,
    justifyContent: 'center',
  },
  voteButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    minWidth: 70,
  },
  voteButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  voteCountText: {
    fontSize: 10,
    color: '#666',
  },
  
  // Modal button styles - matching profile.tsx
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 1000,
  },
  backButtonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 18,
    fontFamily: 'Amiko-Regular',
    color: '#fff',
    fontWeight: '600',
  },
  editImageButton: {
    position: 'absolute',
    bottom: 60,
    right: 20,
    zIndex: 1000,
  },
  editImageButtonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editImageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '700',
  },
});

export default VenuePublicProfile;