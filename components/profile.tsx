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
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { LinearGradient } from "expo-linear-gradient";
import SongUploadForm from "./SongUploadForm";
import { useMusicPlayer } from "./player";
import { songPurchaseService, SongPurchase } from "../services/songPurchaseService";
import { ticketService, TicketWithShow } from "../services/ticketService";
import QRCodeModal from "./QRCodeModal";
import { formatShowDate } from '../utils/dateUtils';
import { playlistService, Playlist } from "../services/playlistService";
import PlaylistCreationModal from "./PlaylistCreationModal";
import { albumService, Album, AlbumPurchase } from "../services/albumService";
import AlbumCreationModal from "./AlbumCreationModal";

// Helper function to get proper image URL from Supabase storage
const getImageUrl = (imagePath: string): string => {
  if (!imagePath) return '';
  
  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  const { data } = supabase.storage
    .from('song-images')
    .getPublicUrl(imagePath);

  return data.publicUrl;
};


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
  { id: "purchasedAlbums", title: "purchased albums", expanded: false },
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
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  
  // QR code modal
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketWithShow | null>(null);

  // Playlist creation modal
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  
  // Album creation modal
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  
  // Handle image press for full-screen view
  const handleImagePress = (imageUri: string, index: number = 0) => {
    setSelectedImage(imageUri);
    setSelectedImageIndex(index);
    setShowImageModal(true);
  };

  // Handle edit profile images
  const handleEditImages = () => {
    setShowImageModal(false);
    // Navigate based on active profile type
    if (activeProfile === 'spotter') {
      navigation.navigate('Picture' as never);
    } else if (activeProfile === 'artist') {
      navigation.navigate('ArtistPicture' as never);
    } else if (activeProfile === 'venue') {
      navigation.navigate('VenuePicture' as never);
    }
  };

  // Handle ticket press to show QR code
  const handleTicketPress = (ticket: TicketWithShow) => {
    setSelectedTicket(ticket);
    setShowQRModal(true);
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

  // Shows data states
  const [activeShows, setActiveShows] = useState<any[]>([]);
  const [pendingShows, setPendingShows] = useState<any[]>([]);

  // Purchased songs data
  const [purchasedSongs, setPurchasedSongs] = useState<SongPurchase[]>([]);
  
  // Playlists data
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [expandedPlaylists, setExpandedPlaylists] = useState<Set<string>>(new Set());
  
  // Albums data
  const [albums, setAlbums] = useState<Album[]>([]);
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  
  // Purchased albums data
  const [purchasedAlbums, setPurchasedAlbums] = useState<AlbumPurchase[]>([]);
  
  // Tickets data
  const [tickets, setTickets] = useState<TicketWithShow[]>([]);

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

            // Fetch shows for this artist
            await fetchArtistShows(artistInfo.artist_id);

            // Fetch albums for this artist
            await fetchAlbums(artistInfo.artist_id, 'artist');

            // Fetch bands for this artist
            const { data: artistBands, error: bandsError } = await supabase
              .from("bands")
              .select("*")
              .contains("band_members", [artistInfo.artist_id]);

            if (!bandsError && artistBands) {
              setBands(artistBands);
              // If artist is part of bands, also fetch band albums
              for (const band of artistBands) {
                const bandAlbumsResult = await albumService.getBandAlbums(band.band_id);
                if (bandAlbumsResult.success && bandAlbumsResult.data) {
                  setAlbums(prev => [...prev, ...bandAlbumsResult.data!]);
                }
              }
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

            // Fetch shows for this venue
            await fetchVenueShows(venueInfo.venue_id);
          }
        }

        // Fetch purchased songs for spotter profile
        await fetchPurchasedSongs(userId);
        
        // Fetch playlists for spotter profile
        await fetchPlaylists(userId);
        
        // Fetch purchased albums for spotter profile
        await fetchPurchasedAlbums(userId);
        
        // Fetch tickets for spotter profile
        await fetchTickets(userId);

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

  const fetchPurchasedSongs = async (userId: string) => {
    try {
      console.log('Profile - Fetching purchased songs for user:', userId);
      const result = await songPurchaseService.getUserPurchasedSongs(userId);
      console.log('Profile - Purchase service result:', result);
      
      if (result.success && result.songs) {
        setPurchasedSongs(result.songs);
        console.log('Profile - Purchased songs loaded:', result.songs.length);
        if (result.songs.length > 0) {
          console.log('Profile - First song example:', result.songs[0]);
        }
      } else {
        console.error('Profile - Error fetching purchased songs:', result.error);
        setPurchasedSongs([]);
      }
    } catch (error) {
      console.error('Profile - Error fetching purchased songs:', error);
      setPurchasedSongs([]);
    }
  };

  const fetchTickets = async (userId: string) => {
    try {
      const result = await ticketService.getUserTickets(userId);
      if (result.success && result.data) {
        setTickets(result.data);
        console.log('Tickets loaded:', result.data.length);
      } else {
        console.error('Error fetching tickets:', result.error);
        setTickets([]);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setTickets([]);
    }
  };

  // Fetch playlists for spotter
  const fetchPlaylists = async (userId: string) => {
    try {
      const result = await playlistService.getUserPlaylists(userId);
      if (result.success && result.data) {
        setPlaylists(result.data);
        console.log('Playlists loaded:', result.data.length);
      } else {
        console.error('Error fetching playlists:', result.error);
        setPlaylists([]);
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
      setPlaylists([]);
    }
  };

  // Fetch albums for artist/band
  const fetchAlbums = async (artistId: string, albumType: 'artist' | 'band') => {
    try {
      const result = albumType === 'artist' 
        ? await albumService.getArtistAlbums(artistId)
        : await albumService.getBandAlbums(artistId);
      
      if (result.success && result.data) {
        setAlbums(result.data);
        console.log('Albums loaded:', result.data.length);
      } else {
        console.error('Error fetching albums:', result.error);
        setAlbums([]);
      }
    } catch (error) {
      console.error('Error fetching albums:', error);
      setAlbums([]);
    }
  };

  // Fetch purchased albums for spotter
  const fetchPurchasedAlbums = async (userId: string) => {
    try {
      const result = await albumService.getUserPurchasedAlbums(userId);
      if (result.success && result.data) {
        setPurchasedAlbums(result.data);
        console.log('Purchased albums loaded:', result.data.length);
      } else {
        console.error('Error fetching purchased albums:', result.error);
        setPurchasedAlbums([]);
      }
    } catch (error) {
      console.error('Error fetching purchased albums:', error);
      setPurchasedAlbums([]);
    }
  };

  // Fetch shows for artist profiles
  const fetchArtistShows = async (artistId: string) => {
    try {
      console.log('🎭 Fetching shows for artist:', artistId);
      
      // Get all shows where this artist is a member
      const { data: shows, error } = await supabase
        .from('shows')
        .select(`
          *,
          venues:show_venue(venue_name, venue_profile_image)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching artist shows:', error);
        return;
      }

      console.log('🎭 Found shows:', shows?.length || 0);

      if (shows) {
        // Filter shows where this artist is a member
        const artistShows = shows.filter(show => {
          return show.show_members?.some((member: any) => {
            if (member.show_member_type === 'artist') {
              return member.show_member_id === artistId;
            }
            return false;
          });
        });

        // Separate by status
        const active = artistShows.filter(show => show.show_status === 'active');
        const pending = artistShows.filter(show => show.show_status === 'pending');
        
        setActiveShows(active);
        setPendingShows(pending);

        console.log('🎭 Artist shows categorized:', {
          active: active.length,
          pending: pending.length
        });
      }
    } catch (error) {
      console.error('Error fetching artist shows:', error);
    }
  };

  // Fetch shows for venue profiles
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
        
        setActiveShows(active);
        setPendingShows(pending);

        console.log('🏛️ Venue shows categorized:', {
          active: active.length,
          pending: pending.length
        });
      }
    } catch (error) {
      console.error('Error fetching venue shows:', error);
    }
  };

  // Fetch songs when profile changes (skip venues)
  useEffect(() => {
    if (activeProfile && (artistID || activeProfile === 'spotter')) {
      fetchSongs();
    }
  }, [activeProfile, artistID]);

  // Auto-refresh purchased songs when returning to this screen
  useFocusEffect(
    useCallback(() => {
      if (activeProfile === 'spotter') {
        // Refresh purchased songs and tickets when screen comes into focus
        const fetchDataOnFocus = async () => {
          try {
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) return;
            
            const userId = sessionData.session?.user?.id;
            if (userId) {
              await fetchPurchasedSongs(userId);
              await fetchPurchasedAlbums(userId);
              await fetchTickets(userId);
            }
          } catch (error) {
            console.error('Error refreshing data on focus:', error);
          }
        };
        
        fetchDataOnFocus();
      }
    }, [activeProfile])
  );

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

  // Sign out handler
  const handleSignOut = async () => {
    try {
      console.log('Signing out user...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
      } else {
        console.log('Successfully signed out');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Welcome' as never }],
        });
      }
    } catch (error) {
      console.error('Unexpected error during sign out:', error);
    }
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
                <TouchableOpacity key={`profile-image-${index}-${item?.substring(item.length - 10) || index}`} onPress={() => handleImagePress(item, index)}>
                  <View style={styles.imageWrapper}>
                    <Image 
                      source={{ uri: item }} 
                      style={styles.profileImage}
                      resizeMode="cover"
                    />
                    {/* Small edit indicator */}
                    <View style={styles.editIndicator}>
                      <Text style={styles.editIndicatorText}>✎</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity onPress={() => handleImagePress(currentData.images[0], 0)}>
              <View style={styles.imageWrapper}>
                <Image 
                  source={{ uri: currentData.images[0] }} 
                  style={styles.profileImage}
                  resizeMode="cover"
                />
                {/* Small edit indicator */}
                <View style={styles.editIndicator}>
                  <Text style={styles.editIndicatorText}>✎</Text>
                </View>
              </View>
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
                  ) : tab.id === "upcoming" && tickets.length > 0 ? (
                    <ScrollView 
                      style={styles.showsList}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    >
                      {tickets.map((ticket) => (
                        <TouchableOpacity 
                          key={ticket.ticket_id}
                          style={styles.ticketItem}
                          onPress={() => handleTicketPress(ticket)}
                        >
                          <Image 
                            source={{ 
                              uri: ticket.shows.venues?.venue_profile_image || 'https://via.placeholder.com/50' 
                            }}
                            style={styles.showImage}
                          />
                          <View style={styles.showInfo}>
                            <Text style={styles.showTitle}>
                              {ticket.shows.venues?.venue_name || 'Venue TBD'}
                            </Text>
                            <Text style={styles.showDetails}>
                              {formatShowDate(ticket.shows.show_date)} 
                              {ticket.shows.show_time ? ` at ${ticket.shows.show_time}` : ''}
                            </Text>
                            <Text style={[
                              styles.ticketPrice,
                              { color: '#28a745' }
                            ]}>
                              ${ticket.ticket_price} • {ticket.ticket_status === 'scanned' ? 'Used' : 'Valid'}
                            </Text>
                            <Text style={styles.ticketInstructions}>
                              Tap to view QR code
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : tab.id === "purchased" && purchasedSongs.length > 0 ? (
                    <ScrollView 
                      style={styles.songsList}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    >
                      {purchasedSongs.map((purchase) => (
                        <TouchableOpacity 
                          key={`${purchase.song_id}-${purchase.purchase_date}`}
                          style={styles.songPurchaseItem}
                          onPress={() => {
                            // Play the purchased song
                            const songData = {
                              song_id: purchase.song_id,
                              song_title: purchase.song_title,
                              song_image: purchase.song_image,
                              song_file: purchase.song_file,
                              artist_id: purchase.song_artist,
                              spotter_id: purchase.song_artist, // Use the song's artist ID
                              song_price: purchase.song_price,
                              created_at: purchase.purchase_date,
                              song_status: 'active',
                              song_approved: true,
                              song_type: purchase.song_type,
                            };
                            
                            // Convert all purchased songs to the song format for playlist
                            const playlist = purchasedSongs.map(p => ({
                              song_id: p.song_id,
                              song_title: p.song_title,
                              song_image: p.song_image,
                              song_file: p.song_file,
                              artist_id: p.song_artist,
                              spotter_id: p.song_artist, // Use the song's artist ID
                              song_price: p.song_price,
                              created_at: p.purchase_date,
                              song_status: 'active',
                              song_approved: true,
                              song_type: p.song_type,
                            }));
                            
                            playSong(songData, playlist);
                            console.log('Playing purchased song:', purchase.song_title);
                          }}
                        >
                          <Image 
                            source={{ 
                              uri: getImageUrl(purchase.song_image) || 'https://via.placeholder.com/50' 
                            }}
                            style={styles.bandImage}
                          />
                          <View style={styles.bandInfo}>
                            <Text style={styles.bandName}>
                              {purchase.song_title}
                            </Text>
                            <Text style={styles.bandStatus}>
                              by {purchase.artist_name || purchase.band_name || 'Unknown Artist'}
                            </Text>
                            <Text style={styles.bandMembers}>
                              {purchase.purchase_type === 'free' ? 'Free' : `$${purchase.song_price}`} • 
                              {formatShowDate(purchase.purchase_date)}
                            </Text>
                            <Text style={styles.songType}>
                              {purchase.song_type === 'band' ? '🎸 Band Song' : '🎤 Artist Song'}
                            </Text>
                          </View>
                          <View style={styles.playButtonContainer}>
                            <Text style={styles.playButtonIcon}>▶️</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : tab.id === "activeShows" && activeShows.length > 0 ? (
                    <ScrollView 
                      style={styles.showsList}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    >
                      {activeShows.map((show) => (
                        <TouchableOpacity 
                          key={show.show_id}
                          style={styles.showItem}
                          onPress={() => navigation.navigate('ShowBill' as never, { show_id: show.show_id } as never)}
                        >
                          <View style={styles.showInfo}>
                            <Text style={styles.showTitle}>
                              {activeProfile === 'venue' 
                                ? `Show at ${venueData?.venue_name || 'Your Venue'}`
                                : `Show at ${show.venues?.venue_name || 'Unknown Venue'}`
                              }
                            </Text>
                            <Text style={styles.showDate}>
                              {show.show_date || show.show_preferred_date} at {show.show_time || show.show_preferred_time}
                            </Text>
                            <Text style={styles.showStatus}>Status: {show.show_status}</Text>
                            <Text style={styles.showLineup}>
                              {show.show_members?.length || 0} performer(s)
                            </Text>
                          </View>
                          <Text style={styles.showArrow}>→</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : tab.id === "pendingShows" && pendingShows.length > 0 ? (
                    <ScrollView 
                      style={styles.showsList}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    >
                      {pendingShows.map((show) => (
                        <TouchableOpacity 
                          key={show.show_id}
                          style={styles.showItem}
                          onPress={() => navigation.navigate('ShowBill' as never, { show_id: show.show_id } as never)}
                        >
                          <View style={styles.showInfo}>
                            <Text style={styles.showTitle}>
                              {activeProfile === 'venue' 
                                ? `Show at ${venueData?.venue_name || 'Your Venue'}`
                                : `Show at ${show.venues?.venue_name || 'Unknown Venue'}`
                              }
                            </Text>
                            <Text style={styles.showDate}>
                              {show.show_date || show.show_preferred_date} at {show.show_time || show.show_preferred_time}
                            </Text>
                            <Text style={styles.showStatus}>Status: {show.show_status}</Text>
                            <Text style={styles.showLineup}>
                              {show.show_members?.length || 0} performer(s)
                            </Text>
                          </View>
                          <Text style={styles.showArrow}>→</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : tab.id === "purchasedAlbums" && purchasedAlbums.length > 0 ? (
                    <ScrollView 
                      style={styles.albumsList}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    >
                      {purchasedAlbums.map((purchase) => {
                        const isExpanded = expandedAlbums.has(purchase.album_id);
                        return (
                          <View key={purchase.album_id}>
                            <TouchableOpacity 
                              style={styles.albumItem}
                              onPress={() => {
                                const newExpanded = new Set(expandedAlbums);
                                if (isExpanded) {
                                  newExpanded.delete(purchase.album_id);
                                } else {
                                  newExpanded.add(purchase.album_id);
                                }
                                setExpandedAlbums(newExpanded);
                              }}
                            >
                              <View style={styles.albumImageContainer}>
                                {purchase.album_image ? (
                                  <Image 
                                    source={{ uri: getImageUrl(purchase.album_image) }}
                                    style={styles.albumImage}
                                  />
                                ) : (
                                  <View style={styles.albumPlaceholder}>
                                    <Text style={styles.albumPlaceholderText}>🎵</Text>
                                  </View>
                                )}
                              </View>
                              <View style={styles.albumInfo}>
                                <Text style={styles.albumName}>{purchase.album_title}</Text>
                                <Text style={styles.albumArtist}>
                                  by {purchase.artist_name || purchase.band_name || 'Unknown Artist'}
                                </Text>
                                <Text style={styles.albumSongCount}>
                                  {purchase.album_song_data.length} song{purchase.album_song_data.length !== 1 ? 's' : ''}
                                </Text>
                                <Text style={styles.albumPrice}>
                                  {purchase.purchase_type === 'free' ? 'Free' : `$${purchase.purchase_price}`} • 
                                  {formatShowDate(purchase.purchase_date)}
                                </Text>
                              </View>
                              <View style={styles.albumExpandButton}>
                                <Text style={styles.albumExpandIcon}>
                                  {isExpanded ? '▼' : '▶'}
                                </Text>
                              </View>
                            </TouchableOpacity>
                            
                            {isExpanded && (
                              <View style={styles.albumSongs}>
                                {purchase.album_song_data.map((song, index) => (
                                  <TouchableOpacity
                                    key={song.song_id}
                                    style={styles.albumSongItem}
                                    onPress={() => {
                                      const songToPlay = {
                                        song_id: song.song_id,
                                        song_title: song.song_title,
                                        song_image: song.song_image || '',
                                        song_file: song.song_file,
                                        artist_id: song.song_artist || song.song_band || '',
                                        spotter_id: spotterName || '',
                                        song_price: '0',
                                        created_at: new Date().toISOString(),
                                        song_type: song.song_type,
                                        band_id: song.song_band,
                                      };
                                      const albumSongs = purchase.album_song_data.map(s => ({
                                        song_id: s.song_id,
                                        song_title: s.song_title,
                                        song_image: s.song_image || '',
                                        song_file: s.song_file,
                                        artist_id: s.song_artist || s.song_band || '',
                                        spotter_id: spotterName || '',
                                        song_price: '0',
                                        created_at: new Date().toISOString(),
                                        song_type: s.song_type,
                                        band_id: s.song_band,
                                      }));
                                      playSong(songToPlay, albumSongs);
                                    }}
                                  >
                                    <Text style={styles.albumSongNumber}>{index + 1}</Text>
                                    {song.song_image && (
                                      <Image 
                                        source={{ uri: getImageUrl(song.song_image) }}
                                        style={styles.albumSongImage}
                                      />
                                    )}
                                    <View style={styles.albumSongInfo}>
                                      <Text style={styles.albumSongTitle}>{song.song_title}</Text>
                                      <Text style={styles.albumSongArtist}>
                                        {song.artist_name || song.band_name || 'Unknown Artist'}
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                ))}
                                {purchase.album_song_data.length === 0 && (
                                  <Text style={styles.emptyAlbumText}>No songs in this album yet</Text>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                  ) : tab.id === "playlists" && playlists.length > 0 ? (
                    <ScrollView 
                      style={styles.playlistsList}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    >
                      {playlists.map((playlist) => {
                        const isExpanded = expandedPlaylists.has(playlist.playlist_id);
                        return (
                          <View key={playlist.playlist_id}>
                            <TouchableOpacity 
                              style={styles.playlistItem}
                              onPress={() => {
                                const newExpanded = new Set(expandedPlaylists);
                                if (isExpanded) {
                                  newExpanded.delete(playlist.playlist_id);
                                } else {
                                  newExpanded.add(playlist.playlist_id);
                                }
                                setExpandedPlaylists(newExpanded);
                              }}
                            >
                              <View style={styles.playlistImageContainer}>
                                {playlist.playlist_image ? (
                                  <Image 
                                    source={{ uri: getImageUrl(playlist.playlist_image) }}
                                    style={styles.playlistImage}
                                  />
                                ) : (
                                  <View style={styles.playlistPlaceholder}>
                                    <Text style={styles.playlistPlaceholderText}>🎵</Text>
                                  </View>
                                )}
                              </View>
                              <View style={styles.playlistInfo}>
                                <Text style={styles.playlistName}>{playlist.playlist_name}</Text>
                                <Text style={styles.playlistSongCount}>
                                  {playlist.playlist_songs.length} song{playlist.playlist_songs.length !== 1 ? 's' : ''}
                                </Text>
                                <Text style={styles.playlistDate}>
                                  Created {formatShowDate(playlist.created_at)}
                                </Text>
                              </View>
                              <View style={styles.playlistExpandButton}>
                                <Text style={styles.playlistExpandIcon}>
                                  {isExpanded ? '▼' : '▶'}
                                </Text>
                              </View>
                              <TouchableOpacity style={styles.playlistMenuButton}>
                                <Text style={styles.playlistMenuIcon}>⋯</Text>
                              </TouchableOpacity>
                            </TouchableOpacity>
                            
                            {isExpanded && (
                              <View style={styles.playlistSongs}>
                                {playlist.playlist_song_data.map((song, index) => (
                                  <TouchableOpacity
                                    key={song.song_id}
                                    style={styles.playlistSongItem}
                                    onPress={() => {
                                      const songToPlay = {
                                        song_id: song.song_id,
                                        song_title: song.song_title,
                                        song_image: song.song_image || '',
                                        song_file: song.song_file,
                                        artist_id: song.song_artist || song.song_band || '',
                                        spotter_id: spotterName || '',
                                        song_price: '0',
                                        created_at: new Date().toISOString(),
                                        song_type: song.song_type,
                                        band_id: song.song_band,
                                      };
                                      const playlistSongs = playlist.playlist_song_data.map(s => ({
                                        song_id: s.song_id,
                                        song_title: s.song_title,
                                        song_image: s.song_image || '',
                                        song_file: s.song_file,
                                        artist_id: s.song_artist || s.song_band || '',
                                        spotter_id: spotterName || '',
                                        song_price: '0',
                                        created_at: new Date().toISOString(),
                                        song_type: s.song_type,
                                        band_id: s.song_band,
                                      }));
                                      playSong(songToPlay, playlistSongs);
                                    }}
                                  >
                                    <Text style={styles.playlistSongNumber}>{index + 1}</Text>
                                    {song.song_image && (
                                      <Image 
                                        source={{ uri: getImageUrl(song.song_image) }}
                                        style={styles.playlistSongImage}
                                      />
                                    )}
                                    <View style={styles.playlistSongInfo}>
                                      <Text style={styles.playlistSongTitle}>{song.song_title}</Text>
                                      <Text style={styles.playlistSongArtist}>
                                        {song.artist_name || song.band_name || 'Unknown Artist'}
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                ))}
                                {playlist.playlist_song_data.length === 0 && (
                                  <Text style={styles.emptyPlaylistText}>No songs in this playlist yet</Text>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                  ) : tab.id === "albums" && albums.length > 0 ? (
                    <ScrollView 
                      style={styles.albumsList}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled={true}
                    >
                      {albums.map((album) => {
                        const isExpanded = expandedAlbums.has(album.album_id);
                        return (
                          <View key={album.album_id}>
                            <TouchableOpacity 
                              style={styles.albumItem}
                              onPress={() => {
                                const newExpanded = new Set(expandedAlbums);
                                if (isExpanded) {
                                  newExpanded.delete(album.album_id);
                                } else {
                                  newExpanded.add(album.album_id);
                                }
                                setExpandedAlbums(newExpanded);
                              }}
                            >
                              <View style={styles.albumImageContainer}>
                                {album.album_image ? (
                                  <Image 
                                    source={{ uri: getImageUrl(album.album_image) }}
                                    style={styles.albumImage}
                                  />
                                ) : (
                                  <View style={styles.albumPlaceholder}>
                                    <Text style={styles.albumPlaceholderText}>🎵</Text>
                                  </View>
                                )}
                              </View>
                              <View style={styles.albumInfo}>
                                <Text style={styles.albumName}>{album.album_title}</Text>
                                <Text style={styles.albumSongCount}>
                                  {album.album_song_data.length} song{album.album_song_data.length !== 1 ? 's' : ''}
                                </Text>
                                <Text style={styles.albumPrice}>
                                  ${album.album_price} • {album.album_status}
                                </Text>
                                <Text style={styles.albumDate}>
                                  Created {formatShowDate(album.created_at)}
                                </Text>
                                {album.album_type === 'band' && album.album_status === 'pending' && (
                                  <Text style={styles.albumPendingText}>
                                    Awaiting band approval
                                  </Text>
                                )}
                              </View>
                              <View style={styles.albumExpandButton}>
                                <Text style={styles.albumExpandIcon}>
                                  {isExpanded ? '▼' : '▶'}
                                </Text>
                              </View>
                              <TouchableOpacity style={styles.albumMenuButton}>
                                <Text style={styles.albumMenuIcon}>⋯</Text>
                              </TouchableOpacity>
                            </TouchableOpacity>
                            
                            {isExpanded && (
                              <View style={styles.albumSongs}>
                                {album.album_song_data.map((song, index) => (
                                  <TouchableOpacity
                                    key={song.song_id}
                                    style={styles.albumSongItem}
                                    onPress={() => {
                                      const songToPlay = {
                                        song_id: song.song_id,
                                        song_title: song.song_title,
                                        song_image: song.song_image || '',
                                        song_file: song.song_file,
                                        artist_id: song.song_artist || song.song_band || '',
                                        spotter_id: spotterName || '',
                                        song_price: '0',
                                        created_at: new Date().toISOString(),
                                        song_type: song.song_type,
                                        band_id: song.song_band,
                                      };
                                      const albumSongs = album.album_song_data.map(s => ({
                                        song_id: s.song_id,
                                        song_title: s.song_title,
                                        song_image: s.song_image || '',
                                        song_file: s.song_file,
                                        artist_id: s.song_artist || s.song_band || '',
                                        spotter_id: spotterName || '',
                                        song_price: '0',
                                        created_at: new Date().toISOString(),
                                        song_type: s.song_type,
                                        band_id: s.song_band,
                                      }));
                                      playSong(songToPlay, albumSongs);
                                    }}
                                  >
                                    <Text style={styles.albumSongNumber}>{index + 1}</Text>
                                    {song.song_image && (
                                      <Image 
                                        source={{ uri: getImageUrl(song.song_image) }}
                                        style={styles.albumSongImage}
                                      />
                                    )}
                                    <View style={styles.albumSongInfo}>
                                      <Text style={styles.albumSongTitle}>{song.song_title}</Text>
                                      <Text style={styles.albumSongArtist}>
                                        {song.artist_name || song.band_name || 'Unknown Artist'}
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                ))}
                                {album.album_song_data.length === 0 && (
                                  <Text style={styles.emptyAlbumText}>No songs in this album yet</Text>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
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
                    (activeProfile === 'artist' && (tab.id === "songs" || tab.id === "albums") && isOwner) ||
                    (activeProfile === 'venue' && tab.id === "songs" && isOwner)) && (
                    <TouchableOpacity 
                      style={styles.addButton}
                      onPress={() => {
                        if (activeProfile === 'spotter') {
                          // Open playlist creation modal
                          setShowPlaylistModal(true);
                        } else if (tab.id === "albums") {
                          // Open album creation modal
                          setShowAlbumModal(true);
                        } else {
                          // Open song upload form
                          setShowSongUploadForm(true);
                        }
                      }}
                    >
                      <Text style={styles.addButtonText}>
                        + {activeProfile === 'spotter' ? 'Add Playlist' : tab.id === 'albums' ? 'Create Album' : 'Upload Song'}
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
                
                <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
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
                
                <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
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
                
                <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
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
            
            {/* Edit button - only show for user's own profile */}
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

      {/* QR Code Modal */}
      <QRCodeModal
        visible={showQRModal}
        onClose={() => setShowQRModal(false)}
        ticket={selectedTicket}
      />

      {/* Playlist Creation Modal */}
      <PlaylistCreationModal
        visible={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        onPlaylistCreated={async () => {
          // Refresh playlists after creation
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await fetchPlaylists(user.id);
          }
        }}
        purchasedSongs={purchasedSongs}
      />

      {/* Album Creation Modal */}
      {(activeProfile === 'artist' || activeProfile === 'venue') && (
        <AlbumCreationModal
          visible={showAlbumModal}
          onClose={() => setShowAlbumModal(false)}
          onAlbumCreated={async () => {
            // Refresh albums after creation
            if (activeProfile === 'artist' && artistID) {
              await fetchAlbums(artistID, 'artist');
            } else if (activeProfile === 'venue' && venueID) {
              await fetchAlbums(venueID, 'band');
            }
          }}
          artistData={activeProfile === 'artist' ? artistData : venueData}
          albumType={activeProfile === 'artist' ? 'artist' : 'band'}
          songs={songs}
        />
      )}
      
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
  imageWrapper: {
    position: 'relative',
    width: SCREEN_WIDTH,
    height: IMAGE_SECTION_HEIGHT,
  },
  editIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ff00ff',
  },
  editIndicatorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  songPurchaseItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
  songType: {
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    marginTop: 2,
  },
  playButtonContainer: {
    backgroundColor: '#ff00ff',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  playButtonIcon: {
    fontSize: 16,
    color: '#fff',
  },
  // Ticket styles
  showsList: {
    flex: 1,
  },
  ticketItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ticketPrice: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    marginBottom: 2,
  },
  ticketInstructions: {
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    fontStyle: 'italic',
  },
  // Show styles
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
  // Playlist styles
  playlistsList: {
    flex: 1,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  playlistImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  playlistImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  playlistPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistPlaceholderText: {
    fontSize: 24,
    color: '#6c757d',
  },
  playlistInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  playlistName: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#333',
    fontWeight: '600',
    marginBottom: 2,
  },
  playlistSongCount: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    marginBottom: 2,
  },
  playlistDate: {
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    color: '#999',
  },
  playlistMenuButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistMenuIcon: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },
  playlistExpandButton: {
    padding: 10,
    marginRight: 5,
  },
  playlistExpandIcon: {
    fontSize: 12,
    color: '#888',
  },
  playlistSongs: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    marginTop: -10,
    marginBottom: 10,
  },
  playlistSongItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  playlistSongNumber: {
    width: 25,
    fontSize: 14,
    color: '#888',
    marginRight: 10,
  },
  playlistSongImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
    backgroundColor: '#333',
  },
  playlistSongInfo: {
    flex: 1,
  },
  playlistSongTitle: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    marginBottom: 2,
  },
  playlistSongArtist: {
    fontSize: 12,
    color: '#888',
  },
  emptyPlaylistText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  
  // Album styles
  albumsList: {
    flex: 1,
  },
  albumItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  albumImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  albumImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  albumPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumPlaceholderText: {
    fontSize: 24,
    color: '#6c757d',
  },
  albumInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  albumName: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#333',
    fontWeight: '600',
    marginBottom: 2,
  },
  albumArtist: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    marginBottom: 2,
  },
  albumSongCount: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    marginBottom: 2,
  },
  albumPrice: {
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    color: '#28a745',
    fontWeight: '600',
  },
  albumDate: {
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    color: '#999',
  },
  albumPendingText: {
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    color: '#ffc107',
    fontWeight: '600',
    marginTop: 2,
  },
  albumMenuButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumMenuIcon: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },
  albumExpandButton: {
    padding: 10,
    marginRight: 5,
  },
  albumExpandIcon: {
    fontSize: 12,
    color: '#888',
  },
  albumSongs: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    marginTop: -10,
    marginBottom: 10,
  },
  albumSongItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  albumSongNumber: {
    width: 25,
    fontSize: 14,
    color: '#888',
    marginRight: 10,
  },
  albumSongImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
    backgroundColor: '#333',
  },
  albumSongInfo: {
    flex: 1,
  },
  albumSongTitle: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    marginBottom: 2,
  },
  albumSongArtist: {
    fontSize: 12,
    color: '#888',
  },
  emptyAlbumText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 20,
  },
});

export default Profile;