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
} from "react-native";
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { LinearGradient } from "expo-linear-gradient";
import { useMusicPlayer } from "./player";
import ShowSpotHeader from "./ShowSpotHeader";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
// iPhone 16 specific dimensions for gesture positioning - matching profile.tsx exactly
const IPHONE_16_HEIGHT = 852; // iPhone 16 screen height
const ACTUAL_TAB_BAR_HEIGHT = 85; // Bottom tab bar height
const GESTURE_AREA_HEIGHT = 95; // Our gesture area height
const HEADER_HEIGHT = 85;
const FOOTER_HEIGHT = 85;
const HANDLE_HEIGHT = 30;
const TAB_HEIGHT = 80;
const COLLAPSED_HEIGHT = 150; // Reduced to eliminate gap
const COLLAPSED_TRANSLATE_Y = SCREEN_HEIGHT - COLLAPSED_HEIGHT - FOOTER_HEIGHT;
// Optimized height for iPhone 16 - removes white gap
const IMAGE_SECTION_HEIGHT = 610; // Further increased to eliminate white space

interface Song {
  song_id: string;
  song_title: string;
  song_image: string;
  song_file: string;
  artist_id: string;
  spotter_id: string;
  song_price: string;
  created_at: string;
}

interface TabData {
  id: string;
  title: string;
  expanded: boolean;
  data?: any[];
}

interface BandMember {
  artist_id: string;
  artist_name: string;
  artist_profile_image?: string;
  accepted: boolean;
}

interface BandData {
  band_id: string;
  band_name: string;
  band_profile_picture: string;
  band_secondary_pictures: string[];
  band_members: string[];
  band_consensus: any[];
  band_status: string;
  band_description?: string;
  band_genre?: string;
  created_at: string;
  updated_at: string;
}

const BAND_TABS: TabData[] = [
  { id: "activeShows", title: "active shows", expanded: false },
  { id: "pendingShows", title: "pending shows", expanded: false },
  { id: "backliningShows", title: "backlining shows", expanded: false },
  { id: "performedShows", title: "performed shows", expanded: false },
  { id: "songs", title: "songs", expanded: false },
  { id: "albums", title: "albums", expanded: false },
  { id: "members", title: "members", expanded: false },
  { id: "info", title: "band info", expanded: false },
];

interface BandPublicProfileProps {
  route: {
    params: {
      band_id: string;
    };
  };
}

const BandPublicProfile: React.FC<BandPublicProfileProps> = ({ route }) => {
  const { band_id } = route.params;
  const navigation = useNavigation();
  const router = useRouter();
  const { playSong } = useMusicPlayer();

  // Band data states
  const [bandData, setBandData] = useState<BandData | null>(null);
  const [bandMembers, setBandMembers] = useState<BandMember[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  
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
  
  // Tab state
  const [tabs, setTabs] = useState<TabData[]>(BAND_TABS);

  // Animation refs - matching profile.tsx exactly
  const panelTranslateY = useRef(new Animated.Value(COLLAPSED_TRANSLATE_Y)).current;
  const handleOpacity = useRef(new Animated.Value(1)).current;
  const nameOpacity = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fetch band data
  const fetchBandData = async () => {
    try {
      setLoading(true);

      // Get band data
      const { data: band, error: bandError } = await supabase
        .from('bands')
        .select('*')
        .eq('band_id', band_id)
        .single();

      if (bandError) throw bandError;
      setBandData(band);

      // Get band members details
      if (band.band_members && band.band_members.length > 0) {
        const { data: members, error: membersError } = await supabase
          .from('artists')
          .select('artist_id, artist_name, artist_profile_image')
          .in('artist_id', band.band_members);

        if (!membersError && members) {
          // Combine with consensus data to show accepted status
          const membersWithStatus = members.map(member => ({
            ...member,
            accepted: band.band_consensus?.find((c: any) => c.member === member.artist_id)?.accepted || false
          }));
          setBandMembers(membersWithStatus);
        }
      }

      // Get band songs (songs by any band member)
      if (band.band_members && band.band_members.length > 0) {
        const { data: bandSongs, error: songsError } = await supabase
          .from('songs')
          .select('*')
          .in('artist_id', band.band_members)
          .eq('song_status', 'active')
          .order('created_at', { ascending: false });

        if (!songsError && bandSongs) {
          setSongs(bandSongs);
        }
      }

      // Fade in animation - matching profile.tsx
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
      
    } catch (err) {
      console.error("Error fetching band data:", err);
      setError(err instanceof Error ? err.message : "Failed to load band profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBandData();
  }, [band_id, fadeAnim]);

  // Pan responder for gesture handling - exactly matching profile.tsx
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        if (Platform.OS === 'ios') {
          Vibration.vibrate(10);
        }
      },
      onPanResponderMove: (_, gestureState) => {
        const currentValue = expanded ? 0 : COLLAPSED_TRANSLATE_Y;
        const newValue = currentValue + gestureState.dy;
        const constrainedValue = Math.max(0, Math.min(COLLAPSED_TRANSLATE_Y, newValue));
        panelTranslateY.setValue(constrainedValue);
      },
      onPanResponderRelease: (_, gestureState) => {
        const SWIPE_THRESHOLD = 100;
        const velocity = gestureState.vy;
        
        const shouldExpand = !expanded && (
          gestureState.dy < -SWIPE_THRESHOLD || velocity < -0.5
        );
        const shouldCollapse = expanded && (
          gestureState.dy > SWIPE_THRESHOLD || velocity > 0.5
        );

        if (shouldExpand) {
          expandPanel();
        } else if (shouldCollapse) {
          collapsePanel();
        } else {
          const targetValue = expanded ? 0 : COLLAPSED_TRANSLATE_Y;
          Animated.spring(panelTranslateY, {
            toValue: targetValue,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
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
        useNativeDriver: true,
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
        useNativeDriver: true,
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

  // Gesture handler for panel header swipe down
  const handlePanelGesture = useCallback((event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationY, velocityY } = event.nativeEvent;
      
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
      prevTabs.map(tab =>
        tab.id === tabId
          ? { ...tab, expanded: !tab.expanded }
          : { ...tab, expanded: false }
      )
    );
  }, []);

  const handleSongPress = (song: Song) => {
    playSong(song, songs);
    navigation.navigate("Player" as never);
  };

  const SongItem: React.FC<{ song: Song }> = ({ song }) => (
    <View style={styles.songItem}>
      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>
          {song.song_title}
        </Text>
        <Text style={styles.songPrice}>${song.song_price}</Text>
      </View>
      <TouchableOpacity
        style={styles.playButton}
        onPress={() => handleSongPress(song)}
      >
        <Text style={styles.playButtonText}>▶️</Text>
      </TouchableOpacity>
    </View>
  );

  // Get current band data for display
  const getCurrentBandData = () => {
    if (!bandData) return { name: "Band", images: [] };
    
    return {
      name: bandData.band_name,
      images: [
        bandData.band_profile_picture, 
        ...(bandData.band_secondary_pictures || [])
      ].filter(Boolean),
    };
  };

  // Render tab content
  const renderTabContent = (tab: TabData) => {
    if (!tab.expanded) return null;

    switch (tab.id) {
      case 'members':
        return (
          <View style={styles.tabContent}>
            {bandMembers.map((member) => (
              <View key={member.artist_id} style={styles.memberItem}>
                <Image
                  source={{ 
                    uri: member.artist_profile_image || 'https://via.placeholder.com/50' 
                  }}
                  style={styles.memberImage}
                />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.artist_name}</Text>
                  <Text style={styles.memberStatus}>
                    {member.accepted ? 'Active Member' : 'Pending Approval'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        );

      case 'songs':
        return (
          <View style={styles.tabContent}>
            <ScrollView 
              style={styles.songsList}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {songs.map((song) => (
                <SongItem key={song.song_id} song={song} />
              ))}
            </ScrollView>
          </View>
        );

      case 'info':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.infoText}>
              Band Status: {bandData?.band_status}
            </Text>
            {bandData?.band_description && (
              <Text style={styles.infoText}>
                Description: {bandData.band_description}
              </Text>
            )}
            {bandData?.band_genre && (
              <Text style={styles.infoText}>
                Genre: {bandData.band_genre}
              </Text>
            )}
            <Text style={styles.infoText}>
              Created: {new Date(bandData?.created_at || '').toLocaleDateString()}
            </Text>
          </View>
        );

      default:
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabContentText}>
              {tab.title} content coming soon...
            </Text>
          </View>
        );
    }
  };

  // Render loading state - matching profile.tsx exactly
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#2a2882" />
        <View style={styles.loadingContainer}>
          <LinearGradient
            colors={["#ff00ff", "#2a2882"]}
            style={styles.loadingGradient}
          >
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Loading band profile...</Text>
          </LinearGradient>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state - matching profile.tsx exactly
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#2a2882" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setLoading(true);
              fetchBandData();
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentData = getCurrentBandData();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["rgba(255, 0, 255, 0.8)", "rgba(42, 40, 130, 0.8)"]}
        style={StyleSheet.absoluteFillObject}
      />
      <StatusBar barStyle="light-content" backgroundColor="#2a2882" />
      
      {/* Header */}
      <ShowSpotHeader 
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        onNotificationPress={() => {
          console.log('Notification pressed');
        }}
        onMessagePress={() => {
          console.log('Message pressed');
        }}
        isVenue={false}
      />

      {/* Profile image section - matching profile.tsx exactly */}
      <Animated.View 
        style={[styles.imageSection, { opacity: fadeAnim }]} 
        {...panResponder.panHandlers}
      >
        {currentData.images.length > 0 ? (
          currentData.images.length > 1 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
            >
              {currentData.images.map((item, index) => (
                <TouchableOpacity key={`band-image-${index}-${item?.substring(item.length - 10) || index}`} onPress={() => handleImagePress(item)}>
                  <Image 
                    source={{ uri: item }} 
                    style={styles.profileImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity onPress={() => handleImagePress(currentData.images[0])}>
              <Image 
                source={{ uri: currentData.images[0] }} 
                style={styles.profileImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )
        ) : (
          <LinearGradient
            colors={["#ff00ff20", "#2a288220"]}
            style={styles.imagePlaceholder}
          >
            <Text style={styles.placeholderText}>No Image</Text>
          </LinearGradient>
        )}
        
        {/* Name and Rating Overlay - matching profile.tsx exactly */}
        <Animated.View 
          style={[styles.nameRatingOverlay, { opacity: nameOpacity }]} 
          pointerEvents="none"
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
          
          {/* Rating on bottom right - bands get ratings */}
          <View style={styles.ratingContainer}>
            <LinearGradient
              colors={["rgba(0, 0, 0, 0.8)", "rgba(0, 0, 0, 0.4)"]}
              style={styles.ratingBackground}
            >
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Image
                    key={star}
                    source={require('../assets/star.png')}
                    style={[
                      styles.starIcon,
                      star <= 4 ? styles.filledStar : styles.emptyStar
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.ratingText}>4.2</Text>
            </LinearGradient>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Sliding panel - matching profile.tsx exactly */}
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
                <Animated.Text
                  style={[
                    styles.arrow,
                    {
                      transform: [
                        {
                          rotate: tab.expanded ? "180deg" : "0deg",
                        },
                      ],
                    },
                  ]}
                >
                  ▼
                </Animated.Text>
              </TouchableOpacity>
              
              {/* Tab content */}
              {renderTabContent(tab)}
            </View>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Full-Screen Image Modal - matching profile.tsx exactly */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalCloseArea}
            onPress={() => setShowImageModal(false)}
            activeOpacity={1}
          >
            <View style={styles.modalImageContainer}>
              {selectedImage && (
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              )}
            </View>
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
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "flex-start",
  },
  
  // Loading states - matching profile.tsx exactly
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingGradient: {
    padding: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Amiko-Regular",
    color: "#fff",
    marginTop: 15,
  },
  
  // Error states - matching profile.tsx exactly
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 50,
    marginBottom: 20,
  },
  errorMessage: {
    fontSize: 16,
    fontFamily: "Amiko-Regular",
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#ff00ff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 16,
    fontFamily: "Amiko-Regular",
    color: "#fff",
  },
  
  // Image section - matching profile.tsx exactly
  imageSection: {
    height: IMAGE_SECTION_HEIGHT,
    width: SCREEN_WIDTH,
    position: "relative",
    backgroundColor: "#000",
    overflow: 'hidden',
    marginTop: 0, // Move image up 70px total (was 80px, now 10px)
  },
  profileImage: {
    width: SCREEN_WIDTH,
    height: IMAGE_SECTION_HEIGHT,
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 18,
    fontFamily: "Amiko-Regular",
    color: "#999",
  },
  
  // Name and Rating Overlay - matching profile.tsx exactly
  nameRatingOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 15,
    zIndex: 6,
  },
  nameContainer: {
    flex: 1,
    marginRight: 15,
  },
  nameBackground: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  profileNameText: {
    fontSize: 22,
    fontFamily: "Audiowide-Regular",
    color: '#ffffff',
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  ratingContainer: {
    alignItems: 'flex-end',
  },
  ratingBackground: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  starIcon: {
    width: 16,
    height: 16,
    marginHorizontal: 1,
  },
  filledStar: {
    tintColor: '#FFD700',
  },
  emptyStar: {
    tintColor: 'rgba(255, 255, 255, 0.3)',
  },
  ratingText: {
    fontSize: 14,
    fontFamily: "Amiko-Regular",
    color: '#ffffff',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  
  // Sliding panel - matching profile.tsx exactly
  scrollablePanel: {
    position: "absolute",
    top: COLLAPSED_HEIGHT,
    left: 0,
    right: 0,
    bottom: FOOTER_HEIGHT - 170,
    backgroundColor: "#fff",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 15,
    zIndex: 10,
  },
  panelHeader: {
    paddingVertical: 15,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  nameTextInside: {
    fontSize: 24,
    fontFamily: "Audiowide-Regular",
    color: "#fff",
    textAlign: "center",
    flex: 1,
  },
  swipeDownIndicator: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "bold",
    position: "absolute",
    right: 20,
  },
  
  // Tabs - matching profile.tsx exactly
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
  tabContent: {
    backgroundColor: "#f8f8f8",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  tabContentText: {
    fontSize: 16,
    fontFamily: "Amiko-Regular",
    color: "#666",
    textAlign: "center",
    fontStyle: "italic",
  },
  
  // Song components - matching profile.tsx exactly
  songsList: {
    maxHeight: 300,
    marginBottom: 10,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  songInfo: {
    flex: 1,
    marginRight: 10,
  },
  songTitle: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#333',
    fontWeight: '500',
    marginBottom: 2,
  },
  songPrice: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#ff00ff',
    fontWeight: '600',
  },
  playButton: {
    backgroundColor: '#ff00ff',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonText: {
    fontSize: 16,
    color: '#fff',
  },
  
  // Band-specific styles
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  memberStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
  
  // Full-screen image modal styles - matching profile.tsx exactly
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalImage: {
    width: '100%',
    height: '80%',
    maxWidth: SCREEN_WIDTH - 40,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 1000,
  },
  backButtonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
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
});

export default BandPublicProfile;