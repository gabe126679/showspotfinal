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
} from "react-native";
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { LinearGradient } from "expo-linear-gradient";
import SongUploadForm from "./SongUploadForm";
import { useMusicPlayer } from "./player";


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
// iPhone 16 specific dimensions for gesture positioning
const IPHONE_16_HEIGHT = 852; // iPhone 16 screen height
const ACTUAL_TAB_BAR_HEIGHT = 85; // Bottom tab bar height
const GESTURE_AREA_HEIGHT = 95; // Our gesture area height
const HEADER_HEIGHT = 85;
const FOOTER_HEIGHT = 85;
const HANDLE_HEIGHT = 30;
const TAB_HEIGHT = 80;
const COLLAPSED_HEIGHT = 150; // Reduced to eliminate gap
const COLLAPSED_TRANSLATE_Y = SCREEN_HEIGHT - COLLAPSED_HEIGHT - FOOTER_HEIGHT;
const IMAGE_SECTION_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT;

type ProfileType = 'spotter' | 'artist' | 'venue';

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

const SPOTTER_TABS: TabData[] = [
  { id: "upcoming", title: "upcoming shows", expanded: false },
  { id: "promoted", title: "promoted shows", expanded: false },
  { id: "attended", title: "attended shows", expanded: false },
  { id: "purchased", title: "purchased songs", expanded: false },
  { id: "playlists", title: "playlists", expanded: false },
  { id: "artists", title: "favorite artists", expanded: false },
  { id: "bands", title: "favorite bands", expanded: false },
  { id: "venues", title: "favorite venues", expanded: false },
  { id: "info", title: "spotter info", expanded: false },
];

const ARTIST_TABS: TabData[] = [
  { id: "activeShows", title: "active shows", expanded: false },
  { id: "pendingShows", title: "pending shows", expanded: false },
  { id: "backliningShows", title: "backlining shows", expanded: false },
  { id: "songs", title: "songs", expanded: false },
  { id: "albums", title: "albums", expanded: false },
  { id: "bands", title: "bands", expanded: false },
  { id: "info", title: "artist info", expanded: false },
];

const VENUE_TABS: TabData[] = [
  { id: "activeShows", title: "active shows", expanded: false },
  { id: "pendingShows", title: "pending shows", expanded: false },
  { id: "backliningShows", title: "backlining shows", expanded: false },
  { id: "songs", title: "songs", expanded: false },
  { id: "albums", title: "albums", expanded: false },
  { id: "bands", title: "bands", expanded: false },
  { id: "info", title: "venue info", expanded: false },
];

interface ProfileProps {
  onExpandPanelRef?: (expandFn: () => void) => void;
  onProfileDataChange?: (data: { name: string; type: 'spotter' | 'artist' | 'venue' }) => void;
}

const Profile: React.FC<ProfileProps> = ({ onExpandPanelRef, onProfileDataChange }) => {
  const navigation = useNavigation();
  const router = useRouter();
  const { playSong } = useMusicPlayer();

  // Profile type state
  const [activeProfile, setActiveProfile] = useState<ProfileType>('spotter');
  
  // Common states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  
  // Spotter data
  const [spotterName, setSpotterName] = useState("");
  const [spotterProfileImage, setSpotterProfileImage] = useState<string | null>(null);
  const [spotterTabs, setSpotterTabs] = useState<TabData[]>(SPOTTER_TABS);
  const [isArtist, setIsArtist] = useState(false);
  const [artistID, setArtistID] = useState<string | null>(null);

  // Artist data
  const [artistData, setArtistData] = useState<any>(null);
  const [artistTabs, setArtistTabs] = useState<TabData[]>(ARTIST_TABS);
  const [isOwner, setIsOwner] = useState(false);

  // Venue data
  const [venueData, setVenueData] = useState<any>(null);
  const [venueTabs, setVenueTabs] = useState<TabData[]>(VENUE_TABS);
  const [isVenue, setIsVenue] = useState(false);
  const [venueID, setVenueID] = useState<string | null>(null);

  // Song upload form state
  const [showSongUploadForm, setShowSongUploadForm] = useState(false);

  // Songs data
  const [songs, setSongs] = useState<Song[]>([]);

  // Animation refs
  const panelTranslateY = useRef(new Animated.Value(COLLAPSED_TRANSLATE_Y)).current;
  const handleOpacity = useRef(new Animated.Value(1)).current;
  const nameOpacity = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;


  // Fetch songs for current profile
  const fetchSongs = async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user?.id;
      if (!userId) return;

      let query = supabase
        .from("songs")
        .select("*")
        .eq("song_status", "active")
        .order("created_at", { ascending: false });

      if (activeProfile === 'artist' && artistID) {
        query = query.eq("artist_id", artistID);
      } else if (activeProfile === 'venue' && venueID) {
        query = query.eq("venue_id", venueID);
      } else if (activeProfile === 'spotter') {
        query = query.eq("spotter_id", userId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      console.log('Fetched songs:', data);
      if (data && data.length > 0) {
        console.log('First song file path:', data[0].song_file);
        console.log('First song image path:', data[0].song_image);
      }
      
      setSongs(data || []);
    } catch (error) {
      console.error("Error fetching songs:", error);
    }
  };

  // Fetch profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      setLoading(true);
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const userId = sessionData.session?.user?.id;
        if (!userId) throw new Error("No authenticated user");

        // Fetch spotter data
        const { data: spotterData, error: spotterError } = await supabase
          .from("spotters")
          .select("full_name, spotter_profile_picture, isArtist, isVenue")
          .eq("id", userId)
          .single();

        if (spotterError) throw spotterError;

        setSpotterName(spotterData.full_name || "Unnamed Spotter");
        setSpotterProfileImage(spotterData.spotter_profile_picture || null);
        setIsArtist(spotterData.isArtist);
        setIsVenue(spotterData.isVenue);

        // If artist, fetch artist data
        if (spotterData.isArtist) {
          const { data: artistInfo, error: artistError } = await supabase
            .from("artists")
            .select("*")
            .eq("spotterID", userId)
            .single();

          if (artistError) throw artistError;
          if (artistInfo) {
            setArtistID(artistInfo.artistID);
            setArtistData(artistInfo);
            setIsOwner(true);
          }
        }

        // If venue, fetch venue data
        if (spotterData.isVenue) {
          const { data: venueInfo, error: venueError } = await supabase
            .from("venues")
            .select("*")
            .eq("spotterID", userId)
            .single();

          if (venueError) throw venueError;
          if (venueInfo) {
            setVenueID(venueInfo.venueID);
            setVenueData(venueInfo);
            setIsOwner(true);
          }
        }

        // Fade in animation
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [fadeAnim]);

  // Fetch songs when profile changes
  useEffect(() => {
    if (activeProfile && (artistID || venueID || activeProfile === 'spotter')) {
      fetchSongs();
    }
  }, [activeProfile, artistID, venueID]);

  // Pan responder for gesture handling
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

  // Register expandPanel function with parent
  useEffect(() => {
    if (onExpandPanelRef) {
      onExpandPanelRef(expandPanel);
    }
  }, [expandPanel, onExpandPanelRef]);

  // Notify parent of current profile data changes
  useEffect(() => {
    if (onProfileDataChange) {
      let name = 'User';
      if (activeProfile === 'spotter') {
        name = spotterName || 'User';
      } else if (activeProfile === 'artist') {
        name = artistData?.artistName || 'Artist';
      } else if (activeProfile === 'venue') {
        name = venueData?.venueName || 'Venue';
      }
      
      onProfileDataChange({
        name,
        type: activeProfile
      });
    }
  }, [activeProfile, spotterName, artistData?.artistName, venueData?.venueName, onProfileDataChange]);

  const collapsePanel = useCallback(() => {
    setExpanded(false);
    
    // Collapse all tabs when panel closes
    setSpotterTabs(prevTabs => 
      prevTabs.map(tab => ({ ...tab, expanded: false }))
    );
    setArtistTabs(prevTabs => 
      prevTabs.map(tab => ({ ...tab, expanded: false }))
    );
    setVenueTabs(prevTabs => 
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
    
    if (activeProfile === 'spotter') {
      setSpotterTabs(prevTabs =>
        prevTabs.map(tab =>
          tab.id === tabId
            ? { ...tab, expanded: !tab.expanded }
            : { ...tab, expanded: false }
        )
      );
    } else if (activeProfile === 'artist') {
      setArtistTabs(prevTabs =>
        prevTabs.map(tab =>
          tab.id === tabId
            ? { ...tab, expanded: !tab.expanded }
            : { ...tab, expanded: false }
        )
      );
    } else {
      setVenueTabs(prevTabs =>
        prevTabs.map(tab =>
          tab.id === tabId
            ? { ...tab, expanded: !tab.expanded }
            : { ...tab, expanded: false }
        )
      );
    }
  }, [activeProfile]);

  const handleProfileSwitch = (profileType: ProfileType) => {
    if (profileType === 'artist' && !isArtist) {
      navigation.navigate("ArtistSignup" as never);
      return;
    }
    
    if (profileType === 'venue' && !isVenue) {
      navigation.navigate("VenueSignup" as never);
      return;
    }
    
    setActiveProfile(profileType);
    // Close panel when switching profiles
    collapsePanel();
  };

  const handleVenuePress = () => {
    navigation.navigate("VenueSignup" as never);
  };

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

  // Get current profile data
  const getCurrentProfileData = () => {
    if (activeProfile === 'spotter') {
      return {
        name: spotterName,
        image: spotterProfileImage,
        tabs: spotterTabs,
        images: spotterProfileImage ? [spotterProfileImage] : [],
      };
    } else if (activeProfile === 'artist') {
      return {
        name: artistData?.artistName || "Artist",
        image: artistData?.artistProfileImage,
        tabs: artistTabs,
        images: artistData ? [
          artistData.artistProfileImage, 
          ...(artistData.artistSecondaryImages || [])
        ].filter(Boolean) : [],
      };
    } else {
      return {
        name: venueData?.venueName || "Venue",
        image: venueData?.venueProfileImage,
        tabs: venueTabs,
        images: venueData ? [
          venueData.venueProfileImage, 
          ...(venueData.venueSecondaryImages || [])
        ].filter(Boolean) : [],
      };
    }
  };

  // Render loading state
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
            <Text style={styles.loadingText}>Loading your profile...</Text>
          </LinearGradient>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
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
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentData = getCurrentProfileData();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2a2882" />
      
      {/* Header with profile type navigation - Modern Card Style */}
      <View style={styles.modernHeader}>
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.95)", "rgba(248, 248, 248, 0.95)"]}
          style={styles.headerCard}
        >
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={[
                styles.modernHeaderButton,
                activeProfile === 'artist' && isArtist && styles.activeModernButton
              ]}
              onPress={() => handleProfileSwitch('artist')}
            >
              <Text style={styles.buttonIcon}>🎵</Text>
              <Text style={[
                styles.modernHeaderButtonText,
                activeProfile === 'artist' && isArtist && styles.activeModernButtonText
              ]}>
                Artist
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.modernHeaderButton,
                activeProfile === 'spotter' && styles.activeModernButton
              ]}
              onPress={() => handleProfileSwitch('spotter')}
            >
              <Text style={styles.buttonIcon}>👤</Text>
              <Text style={[
                styles.modernHeaderButtonText,
                activeProfile === 'spotter' && styles.activeModernButtonText
              ]}>
                Spotter
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.modernHeaderButton,
                activeProfile === 'venue' && isVenue && styles.activeModernButton
              ]}
              onPress={() => handleProfileSwitch('venue')}
            >
              <Text style={styles.buttonIcon}>🏢</Text>
              <Text style={[
                styles.modernHeaderButtonText,
                activeProfile === 'venue' && isVenue && styles.activeModernButtonText
              ]}>
                Venue
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      {/* Profile image section */}
      <Animated.View 
        style={[styles.imageSection, { opacity: fadeAnim }]} 
      >
        {currentData.images.length > 0 ? (
          activeProfile === 'artist' && currentData.images.length > 1 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
            >
              {currentData.images.map((item, index) => (
                <Image 
                  key={`profile-image-${index}-${item?.substring(item.length - 10) || index}`}
                  source={{ uri: item }} 
                  style={styles.profileImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <Image 
              source={{ uri: currentData.images[0] }} 
              style={styles.profileImage}
              resizeMode="cover"
            />
          )
        ) : (
          <LinearGradient
            colors={["#ff00ff20", "#2a288220"]}
            style={styles.imagePlaceholder}
          >
            <Text style={styles.placeholderText}>No Image</Text>
          </LinearGradient>
        )}
        
        {/* Floating Stats Card */}
        <Animated.View 
          style={[styles.floatingStatsCard, { opacity: nameOpacity }]} 
          pointerEvents="none"
        >
          <LinearGradient
            colors={activeProfile === 'venue' 
              ? ["rgba(80, 200, 120, 0.9)", "rgba(255, 215, 0, 0.9)"] 
              : ["rgba(42, 40, 130, 0.9)", "rgba(255, 0, 255, 0.9)"]
            }
            style={styles.statsGradient}
          >
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{currentData.tabs.length}</Text>
                <Text style={styles.statLabel}>Categories</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {activeProfile === 'artist' ? (songs.length || 0) : 
                   activeProfile === 'venue' ? '5+' : '12'}
                </Text>
                <Text style={styles.statLabel}>
                  {activeProfile === 'artist' ? 'Songs' : 
                   activeProfile === 'venue' ? 'Events' : 'Playlists'}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>

      {/* Sliding panel */}
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
            colors={activeProfile === 'venue' ? ["#50C878", "#FFD700"] : ["#2a2882", "#ff00ff"]}
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
          {currentData.tabs.map((tab, index) => (
            <View key={tab.id} style={styles.tabContainer}>
              <TouchableOpacity
                style={[
                  styles.dropdownTab,
                  tab.expanded && styles.dropdownTabExpanded,
                  index === currentData.tabs.length - 1 && styles.lastTab,
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
              {tab.expanded && (
                <View style={styles.tabContent}>
                  {tab.id === "songs" && songs.length > 0 ? (
                    <ScrollView 
                      style={styles.songsList}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    >
                      {songs.map((song) => (
                        <SongItem key={song.song_id} song={song} />
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.tabContentText}>
                      {((activeProfile === 'artist' || activeProfile === 'venue') && isOwner) 
                        ? `Editable ${tab.title} section.`
                        : `No ${tab.title} yet`
                      }
                    </Text>
                  )}
                  {((activeProfile === 'spotter' && tab.id === "playlists") || 
                    (activeProfile === 'artist' && tab.id === "songs" && isOwner) ||
                    (activeProfile === 'venue' && tab.id === "songs" && isOwner)) && (
                    <TouchableOpacity 
                      style={styles.addButton}
                      onPress={() => {
                        if (activeProfile === 'spotter') {
                          // Handle playlist creation
                          console.log('Add playlist');
                        } else {
                          // Open song upload form
                          setShowSongUploadForm(true);
                        }
                      }}
                    >
                      <Text style={styles.addButtonText}>
                        + {activeProfile === 'spotter' ? 'Add Playlist' : 'Upload Song'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ))}
          
          {/* Action buttons - show for all profiles */}
          <View style={styles.actionButtons}>
            {activeProfile === 'spotter' ? (
              <>
                <TouchableOpacity style={styles.actionButton}>
                  <LinearGradient
                    colors={["#ff00ff", "#2a2882"]}
                    style={styles.actionButtonGradient}
                  >
                    <TouchableOpacity onPress={() => handleProfileSwitch('artist')}>
                      <Text style={styles.actionButtonText}>
                        {isArtist ? 'Switch to Artist Profile' : 'Become an Artist'}
                      </Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.actionButton}>
                  <LinearGradient
                    colors={["#2a2882", "#ff00ff"]}
                    style={styles.actionButtonGradient}
                  >
                    <TouchableOpacity onPress={() => handleProfileSwitch('venue')}>
                      <Text style={styles.actionButtonText}>
                        {isVenue ? 'Switch to Venue Profile' : 'Become a Venue'}
                      </Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.signOutButton}>
                  <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
              </>
            ) : activeProfile === 'artist' ? (
              <>
                <TouchableOpacity style={styles.actionButton}>
                  <LinearGradient
                    colors={["#ff00ff", "#2a2882"]}
                    style={styles.actionButtonGradient}
                  >
                    <TouchableOpacity onPress={() => handleProfileSwitch('spotter')}>
                      <Text style={styles.actionButtonText}>
                        Switch to Spotter Profile
                      </Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.actionButton}>
                  <LinearGradient
                    colors={["#2a2882", "#ff00ff"]}
                    style={styles.actionButtonGradient}
                  >
                    <TouchableOpacity onPress={() => handleProfileSwitch('venue')}>
                      <Text style={styles.actionButtonText}>
                        {isVenue ? 'Switch to Venue Profile' : 'Become a Venue'}
                      </Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.signOutButton}>
                  <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.actionButton}>
                  <LinearGradient
                    colors={["#FFD700", "#50C878"]}
                    style={styles.actionButtonGradient}
                  >
                    <TouchableOpacity onPress={() => handleProfileSwitch('spotter')}>
                      <Text style={styles.actionButtonText}>
                        Switch to Spotter Profile
                      </Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.actionButton}>
                  <LinearGradient
                    colors={["#50C878", "#FFD700"]}
                    style={styles.actionButtonGradient}
                  >
                    <TouchableOpacity onPress={() => handleProfileSwitch('artist')}>
                      <Text style={styles.actionButtonText}>
                        {isArtist ? 'Switch to Artist Profile' : 'Become an Artist'}
                      </Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.signOutButton}>
                  <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </Animated.View>


      {/* Song Upload Form Modal */}
      <SongUploadForm
        visible={showSongUploadForm}
        onClose={() => {
          setShowSongUploadForm(false);
          // Refresh songs list after upload
          fetchSongs();
        }}
        artistData={activeProfile === 'artist' ? artistData : venueData}
      />
      
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "flex-start",
    paddingBottom: 85, // Just account for bottom tab bar now
  },
  
  // Loading states
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
  
  // Error states
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
  
  // Modern Header
  modernHeader: {
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 10,
  },
  headerCard: {
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  headerButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  modernHeaderButton: {
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 15,
    backgroundColor: "transparent",
    minWidth: 80,
  },
  activeModernButton: {
    backgroundColor: "rgba(255, 0, 255, 0.1)",
    borderWidth: 2,
    borderColor: "#ff00ff",
  },
  buttonIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  modernHeaderButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    letterSpacing: 0.3,
  },
  activeModernButtonText: {
    color: "#ff00ff",
    fontWeight: "700",
  },
  
  // Old Header (keeping for reference)
  header: {
    height: HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  headerButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  activeHeaderButton: {
    backgroundColor: "#ff00ff",
  },
  activeVenueHeaderButton: {
    backgroundColor: "#FFD700",
  },
  headerButtonText: {
    fontSize: 18,
    fontFamily: "Amiko-Regular",
    color: "#b4b3b3",
    fontWeight: "600",
  },
  activeHeaderButtonText: {
    color: "#fff",
  },
  
  // Image section
  imageSection: {
    height: IMAGE_SECTION_HEIGHT,
    width: "100%",
    position: "relative",
    backgroundColor: "#000",
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
  nameOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 5,
  },
  nameGradient: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    paddingRight: 20,
    paddingBottom: 20,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  nameText: {
    fontSize: 20,
    fontFamily: "Audiowide-Regular",
    color: "#fff",
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  
  // Floating Stats Card
  floatingStatsCard: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    zIndex: 6,
  },
  statsGradient: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 15,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 20,
  },
  
  // Sliding panel
  scrollablePanel: {
    position: "absolute",
    top: COLLAPSED_HEIGHT,
    left: 0,
    right: 0,
    bottom: FOOTER_HEIGHT,
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
  gestureHandle: {
    height: HANDLE_HEIGHT,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
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
  
  // Tabs
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
  addButton: {
    backgroundColor: "#ff00ff",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginTop: 10,
    alignSelf: "center",
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: "Amiko-Regular",
    color: "#fff",
    fontWeight: "600",
  },
  
  // Action buttons
  actionButtons: {
    padding: 20,
    gap: 15,
  },
  actionButton: {
    marginBottom: 10,
  },
  actionButtonGradient: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  actionButtonText: {
    fontSize: 18,
    fontFamily: "Amiko-Regular",
    color: "#fff",
    fontWeight: "600",
  },
  signOutButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#ff00ff",
    alignItems: "center",
    marginTop: 10,
  },
  signOutText: {
    fontSize: 18,
    fontFamily: "Amiko-Regular",
    color: "#ff00ff",
    fontWeight: "600",
  },
  
  
  // Song components
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
});

export default Profile;