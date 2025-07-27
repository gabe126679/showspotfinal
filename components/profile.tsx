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
// Optimized height for iPhone 16 - removes white gap
const IMAGE_SECTION_HEIGHT = 610; // Further increased to eliminate white space

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
  { id: "performedShows", title: "performed shows", expanded: false },
  { id: "songs", title: "songs", expanded: false },
  { id: "albums", title: "albums", expanded: false },
  { id: "bands", title: "bands", expanded: false },
  { id: "info", title: "artist info", expanded: false },
];

const VENUE_TABS: TabData[] = [
  { id: "activeShows", title: "active shows", expanded: false },
  { id: "pendingShows", title: "pending shows", expanded: false },
  { id: "backliningShows", title: "backlining shows", expanded: false },
  { id: "hostedShows", title: "hosted shows", expanded: false },
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
  
  // Full-screen image modal
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Handle image press for full-screen view
  const handleImagePress = (imageUri: string) => {
    setSelectedImage(imageUri);
    setShowImageModal(true);
  };
  
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

  // Bands data
  const [bands, setBands] = useState<any[]>([]);

  // Animation refs
  const panelTranslateY = useRef(new Animated.Value(COLLAPSED_TRANSLATE_Y)).current;
  const handleOpacity = useRef(new Animated.Value(1)).current;
  const nameOpacity = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;


  // Fetch songs for current profile
  const fetchSongs = async () => {
    try {
      // Venues don't have songs, so skip fetching for venue profiles
      if (activeProfile === 'venue') {
        console.log('Skipping song fetch for venue profile');
        setSongs([]);
        return;
      }

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
          .select("full_name, spotter_profile_picture, is_artist, is_venue")
          .eq("id", userId)
          .single();

        if (spotterError) throw spotterError;

        setSpotterName(spotterData.full_name || "Unnamed Spotter");
        setSpotterProfileImage(spotterData.spotter_profile_picture || null);
        setIsArtist(spotterData.is_artist);
        setIsVenue(spotterData.is_venue);

        // If artist, fetch artist data
        if (spotterData.is_artist) {
          const { data: artistInfo, error: artistError } = await supabase
            .from("artists")
            .select("*")
            .eq("spotter_id", userId)
            .single();

          if (artistError) throw artistError;
          if (artistInfo) {
            setArtistID(artistInfo.artist_id);
            setArtistData(artistInfo);
            setIsOwner(true);

            // Fetch bands for this artist
            const { data: artistBands, error: bandsError } = await supabase
              .from("bands")
              .select("*")
              .contains("band_members", [artistInfo.artist_id]);

            if (!bandsError && artistBands) {
              setBands(artistBands);
            }
          }
        }

        // If venue, fetch venue data
        if (spotterData.is_venue) {
          const { data: venueInfo, error: venueError } = await supabase
            .from("venues")
            .select("*")
            .eq("spotter_id", userId)
            .single();

          if (venueError) throw venueError;
          if (venueInfo) {
            setVenueID(venueInfo.venue_id);
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

  // Fetch songs when profile changes (skip venues)
  useEffect(() => {
    if (activeProfile && (artistID || activeProfile === 'spotter')) {
      fetchSongs();
    }
  }, [activeProfile, artistID]);

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
        name = artistData?.artist_name || 'Artist';
      } else if (activeProfile === 'venue') {
        name = venueData?.venue_name || 'Venue';
      }
      
      onProfileDataChange({
        name,
        type: activeProfile
      });
    }
  }, [activeProfile, spotterName, artistData?.artist_name, venueData?.venue_name, onProfileDataChange]);

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
        name: artistData?.artist_name || "Artist",
        image: artistData?.artist_profile_image,
        tabs: artistTabs,
        images: artistData ? [
          artistData.artist_profile_image, 
          ...(artistData.artist_secondary_images || [])
        ].filter(Boolean) : [],
      };
    } else {
      return {
        name: venueData?.venue_name || "Venue",
        image: venueData?.venue_profile_image,
        tabs: venueTabs,
        images: venueData ? [
          venueData.venue_profile_image, 
          ...(venueData.venue_secondary_images || [])
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
    <View style={styles.container}>
      <LinearGradient
        colors={["rgba(255, 0, 255, 0.8)", "rgba(42, 40, 130, 0.8)"]}
        style={StyleSheet.absoluteFillObject}
      />
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
                <TouchableOpacity key={`profile-image-${index}-${item?.substring(item.length - 10) || index}`} onPress={() => handleImagePress(item)}>
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
        
        {/* Name and Rating Overlay */}
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
          
          {/* Rating on bottom right - only for artists and venues */}
          {(activeProfile === 'artist' || activeProfile === 'venue') && (
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
                <Text style={styles.ratingText}>4.0</Text>
              </LinearGradient>
            </View>
          )}
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
                  ) : tab.id === "bands" && bands.length > 0 ? (
                    <ScrollView 
                      style={styles.songsList}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    >
                      {bands.map((band) => (
                        <TouchableOpacity 
                          key={band.band_id}
                          style={styles.bandItem}
                          onPress={() => navigation.navigate('BandPublicProfile', { band_id: band.band_id })}
                        >
                          <Image 
                            source={{ uri: band.band_profile_picture || 'https://via.placeholder.com/60' }}
                            style={styles.bandImage}
                          />
                          <View style={styles.bandInfo}>
                            <Text style={styles.bandName}>{band.band_name}</Text>
                            <Text style={styles.bandStatus}>Status: {band.band_status}</Text>
                            <Text style={styles.bandMembers}>
                              {band.band_members?.length || 0} members
                            </Text>
                          </View>
                          <Text style={styles.viewProfileText}>View →</Text>
                        </TouchableOpacity>
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
                    colors={["#32CD32", "#50C878"]}
                    style={styles.actionButtonGradient}
                  >
                    <TouchableOpacity onPress={() => navigation.navigate('ArtistPublicProfile' as never, { artist_id: artistData?.artist_id })}>
                      <Text style={styles.actionButtonText}>
                        View Public Profile
                      </Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </TouchableOpacity>
                
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
                    colors={["#87CEEB", "#4682B4"]}
                    style={styles.actionButtonGradient}
                  >
                    <TouchableOpacity onPress={() => navigation.navigate('VenuePublicProfile' as never, { venue_id: venueData?.venue_id })}>
                      <Text style={styles.actionButtonText}>
                        View Public Profile
                      </Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </TouchableOpacity>
                
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


      {/* Full-Screen Image Modal */}
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
      
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "flex-start",
    // Removed paddingBottom - TabNavigator handles footer spacing
  },
  containerBackground: {
    flex: 1,
    backgroundColor: 'rgba(255, 0, 255, 0.8)', // Brand gradient background fallback
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 10,
    zIndex: 20, // Above image section
    backgroundColor: 'transparent',
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
    width: SCREEN_WIDTH, // Explicit width instead of percentage
    position: "relative",
    backgroundColor: "#000",
    overflow: 'hidden', // Ensure no content exceeds boundaries
    marginTop: 110, // Push image section down 80px total
  },
  profileImage: {
    width: SCREEN_WIDTH, // Must match screen width for proper ScrollView pagination
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
  
  // Name and Rating Overlay
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
    tintColor: '#FFD700', // Gold color for filled stars
  },
  emptyStar: {
    tintColor: 'rgba(255, 255, 255, 0.3)', // Semi-transparent for empty stars
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
  
  // Sliding panel
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
  
  // Band styles
  bandItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bandImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  bandInfo: {
    flex: 1,
  },
  bandName: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  bandStatus: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    marginBottom: 2,
  },
  bandMembers: {
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    color: '#999',
  },
  viewProfileText: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#ff00ff',
    fontWeight: '600',
  },
  
  // Full-screen image modal styles
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

export default Profile;