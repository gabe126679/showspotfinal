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
  FlatList,
} from "react-native";
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { LinearGradient } from "expo-linear-gradient";
import { useMusicPlayer } from "./player";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IPHONE_16_HEIGHT = 852;
const ACTUAL_TAB_BAR_HEIGHT = 85;
const GESTURE_AREA_HEIGHT = 95;
const HEADER_HEIGHT = 85;
const FOOTER_HEIGHT = 85;
const HANDLE_HEIGHT = 30;
const TAB_HEIGHT = 80;
const COLLAPSED_HEIGHT = 150;
const COLLAPSED_TRANSLATE_Y = SCREEN_HEIGHT - COLLAPSED_HEIGHT - FOOTER_HEIGHT;
const IMAGE_SECTION_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT;

interface TabData {
  id: string;
  title: string;
  expanded: boolean;
}

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
  const { playTrack } = useMusicPlayer();

  // State management
  const [bandData, setBandData] = useState<BandData | null>(null);
  const [bandMembers, setBandMembers] = useState<BandMember[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [tabs, setTabs] = useState<TabData[]>(BAND_TABS);

  // Animation setup - matching profile.tsx exactly
  const panelTranslateY = useRef(new Animated.Value(COLLAPSED_TRANSLATE_Y)).current;
  const handleOpacity = useRef(new Animated.Value(1)).current;
  const nameOpacity = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const [expanded, setExpanded] = useState(false);

  // Load band data
  const loadBandData = async () => {
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
          .order('created_at', { ascending: false });

        if (!songsError && bandSongs) {
          setSongs(bandSongs);
        }
      }

    } catch (error) {
      console.error('Error loading band data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBandData();
  }, [band_id]);

  // Animation functions - exactly matching profile.tsx
  const expandPanel = useCallback(() => {
    setExpanded(true);
    
    Animated.parallel([
      Animated.spring(panelTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
        overshootClamping: false,
      }),
      Animated.timing(handleOpacity, {
        toValue: 0,
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
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [panelTranslateY, handleOpacity, nameOpacity]);

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

  // Gesture handler for panel header swipe down
  const handlePanelGesture = useCallback((event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationY, velocityY } = event.nativeEvent;
      if (translationY > 50 || velocityY > 500) {
        collapsePanel();
      }
    }
  }, [collapsePanel]);

  // Tab management
  const toggleTab = (tabId: string) => {
    setTabs(prevTabs =>
      prevTabs.map(tab => ({
        ...tab,
        expanded: tab.id === tabId ? !tab.expanded : false,
      }))
    );
  };

  // Render functions
  const renderTabContent = (tab: TabData) => {
    if (!tab.expanded) return null;

    switch (tab.id) {
      case 'members':
        return (
          <View style={styles.tabContent}>
            {bandMembers.map((member, index) => (
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
            {songs.map((song, index) => (
              <TouchableOpacity
                key={song.song_id}
                style={styles.songItem}
                onPress={() => playTrack(song)}
              >
                <Image
                  source={{ uri: song.song_image || 'https://via.placeholder.com/60' }}
                  style={styles.songImage}
                />
                <View style={styles.songInfo}>
                  <Text style={styles.songTitle}>{song.song_title}</Text>
                  <Text style={styles.songPrice}>${song.song_price}</Text>
                </View>
              </TouchableOpacity>
            ))}
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
            <Text style={styles.placeholderText}>
              {tab.title} content coming soon...
            </Text>
          </View>
        );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2a2882" />
          <Text style={styles.loadingText}>Loading band profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!bandData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Band not found</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const images = [
    bandData.band_profile_picture,
    ...(bandData.band_secondary_pictures || [])
  ].filter(img => img && img.trim() !== '');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backArrow}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backArrowText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{bandData.band_name}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Image Section with PanResponder */}
      <Animated.View 
        style={styles.imageSection}
        {...panResponder.panHandlers}
      >
        {images.length > 0 ? (
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `image-${index}`}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setCurrentImageIndex(index);
            }}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.profileImage} />
            )}
          />
        ) : (
          <View style={styles.placeholderImageContainer}>
            <Text style={styles.placeholderImageText}>No Images</Text>
          </View>
        )}
        
        {/* Image indicators */}
        {images.length > 1 && (
          <View style={styles.imageIndicators}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.indicator,
                  index === currentImageIndex && styles.activeIndicator,
                ]}
              />
            ))}
          </View>
        )}

        {/* Swipe up handle - matching profile.tsx */}
        <Animated.View 
          style={[
            styles.swipeUpHandle,
            { opacity: handleOpacity }
          ]}
        >
          <View style={styles.handleBar} />
          <Text style={styles.swipeUpText}>swipe up</Text>
          <Text style={styles.swipeUpIndicator}>↑</Text>
        </Animated.View>
      </Animated.View>

      {/* Sliding panel - matching profile.tsx structure */}
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
          >
            <View style={styles.nameContainer}>
              <Animated.Text 
                style={[
                  styles.bandNameInPanel,
                  { opacity: nameOpacity }
                ]}
              >
                {bandData.band_name}
              </Animated.Text>
              <Text style={styles.swipeDownText}>swipe down</Text>
              <Text style={styles.swipeDownIndicator}>↓</Text>
            </View>

            {/* Band Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{bandMembers.length}</Text>
                <Text style={styles.statLabel}>Members</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{songs.length}</Text>
                <Text style={styles.statLabel}>Songs</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{tabs.length}</Text>
                <Text style={styles.statLabel}>Categories</Text>
              </View>
            </View>
          </LinearGradient>
        </PanGestureHandler>

        {/* Tabs */}
        <ScrollView
          ref={scrollViewRef}
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
                <Animated.Text style={[
                  styles.arrow,
                  {
                    transform: [{
                      rotate: tab.expanded ? "180deg" : "0deg"
                    }]
                  }
                ]}>
                  ▼
                </Animated.Text>
              </TouchableOpacity>
              {renderTabContent(tab)}
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#2a2882',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    backgroundColor: "#000",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  backArrow: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  backArrowText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    width: 40,
  },
  imageSection: {
    height: IMAGE_SECTION_HEIGHT,
    position: "relative",
  },
  profileImage: {
    width: SCREEN_WIDTH,
    height: IMAGE_SECTION_HEIGHT,
    resizeMode: "cover",
  },
  placeholderImageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_SECTION_HEIGHT,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderImageText: {
    color: '#666',
    fontSize: 18,
  },
  imageIndicators: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    marginHorizontal: 4,
  },
  activeIndicator: {
    backgroundColor: "rgba(255, 255, 255, 1)",
    width: 12,
    height: 12,
    borderRadius: 6,
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
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  panelHeader: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  nameContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  bandNameInPanel: {
    fontSize: 28,
    fontFamily: "Amiko-Bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  swipeDownText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    fontFamily: "Amiko-Regular",
    textTransform: "lowercase",
  },
  swipeDownIndicator: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "bold",
    marginTop: 4,
  },
  
  // Swipe up handle
  swipeUpHandle: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  handleBar: {
    width: 50,
    height: 5,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 3,
    marginBottom: 8,
  },
  swipeUpText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    fontFamily: "Amiko-Regular",
    textTransform: "lowercase",
    marginBottom: 4,
  },
  swipeUpIndicator: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "bold",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  statLabel: {
    color: "#b8b8ff",
    fontSize: 14,
    textTransform: "lowercase",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    marginHorizontal: 10,
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
  tabContent: {
    backgroundColor: "#f8f8f8",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
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
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  songImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  songPrice: {
    fontSize: 14,
    color: '#2a2882',
    marginTop: 2,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
  placeholderText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default BandPublicProfile;