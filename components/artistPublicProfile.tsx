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
import { useMusicPlayer } from "./player";
import ShowSpotHeader from "./ShowSpotHeader";
import TicketPurchaseModal from "./TicketPurchaseModal";
import SongPurchaseModal from "./SongPurchaseModal";
import AlbumPurchaseModal from "./AlbumPurchaseModal";
import ShowVoteButton from "./ShowVoteButton";
import RatingModal from "./RatingModal";
import { ratingService, RatingInfo } from '../services/ratingService';
import { followerService, FollowerInfo } from '../services/followerService';
import TipModal from "./TipModal";
import { formatShowDateTime } from '../utils/showDateDisplay';
import { albumService, Album } from '../services/albumService';

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
const IMAGE_SECTION_HEIGHT = 610; // Matching bandPublicProfile exactly

interface Song {
  song_id: string;
  song_title: string;
  song_image: string;
  song_file: string;
  artist_id: string;
  spotter_id: string;
  song_price: string;
  created_at: string;
  song_status: string;
  song_approved: boolean;
  song_type: string;
  band_id?: string;
}

interface TabData {
  id: string;
  title: string;
  expanded: boolean;
  data?: any[];
}

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

interface ArtistData {
  artist_id: string;
  artist_name: string;
  artist_profile_image: string;
  artist_secondary_images?: string[];
  spotter_id: string;
  artist_bio?: string;
  artist_genre?: string;
  artist_location?: string;
  created_at: string;
}

interface ArtistPublicProfileProps {
  route: {
    params: {
      artist_id: string;
    };
  };
}

const ArtistPublicProfile: React.FC<ArtistPublicProfileProps> = ({ route }) => {
  const { artist_id } = route.params;
  const navigation = useNavigation();
  const router = useRouter();
  const { playSong } = useMusicPlayer();

  // Artist data states
  const [artistData, setArtistData] = useState<ArtistData | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  
  // Shows data states
  const [activeShows, setActiveShows] = useState<any[]>([]);
  const [pendingShows, setPendingShows] = useState<any[]>([]);
  const [performedShows, setPerformedShows] = useState<any[]>([]);
  const [bands, setBands] = useState<any[]>([]);
  
  // Albums data
  const [albums, setAlbums] = useState<Album[]>([]);
  
  // Rating states
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingInfo, setRatingInfo] = useState<RatingInfo | null>(null);
  
  // Follower states
  const [followerInfo, setFollowerInfo] = useState<FollowerInfo | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  
  // Tip states
  const [showTipModal, setShowTipModal] = useState(false);
  
  // Common states - matching profile.tsx exactly
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  
  // Modal states
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedShow, setSelectedShow] = useState<any>(null);
  
  // Full-screen image modal - matching profile.tsx exactly
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Song purchase modal
  const [showSongModal, setShowSongModal] = useState(false);
  const [selectedSong, setSelectedSong] = useState<any>(null);
  
  // Album purchase modal
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  
  // Handle image press for full-screen view
  const handleImagePress = (imageUri: string) => {
    setSelectedImage(imageUri);
    setShowImageModal(true);
  };

  // Handle ticket purchase
  const handleTicketPurchase = (show: any) => {
    console.log('handleTicketPurchase called with show:', show);
    
    if (!show) {
      console.error('Show data is null or undefined');
      return;
    }
    
    const showDataForModal = {
      show_id: show.show_id,
      title: show.title || 'Unknown Show',
      ticket_price: parseFloat(show.ticket_price) || 0,
      show_date: show.show_date,
      show_time: show.show_time,
      venue_name: show.venue_name || 'Unknown Venue',
    };
    
    console.log('Setting showData for modal:', showDataForModal);
    setSelectedShow(showDataForModal);
    setShowTicketModal(true);
  };

  // Handle song purchase
  const handleSongPurchase = (song: Song) => {
    console.log('handleSongPurchase called with song:', song);
    
    if (!song || !artistData) {
      console.error('Song or artist data is null or undefined');
      return;
    }
    
    const songDataForModal = {
      song_id: song.song_id,
      song_title: song.song_title,
      song_image: song.song_image,
      song_file: song.song_file,
      song_price: song.song_price,
      song_type: 'artist' as const,
      song_artist: song.artist_id,
      artist_name: artistData.artist_name,
    };
    
    console.log('Setting songData for modal:', songDataForModal);
    setSelectedSong(songDataForModal);
    setShowSongModal(true);
  };

  // Handle album purchase
  const handleAlbumPurchase = (album: Album) => {
    console.log('handleAlbumPurchase called with album:', album);
    
    if (!album) {
      console.error('Album data is null or undefined');
      return;
    }
    
    setSelectedAlbum(album);
    setShowAlbumModal(true);
  };

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

  // Tabs state
  const [tabs, setTabs] = useState<TabData[]>(ARTIST_TABS);

  // Animation refs - matching bandPublicProfile.tsx exactly
  const panelTranslateY = useRef(new Animated.Value(COLLAPSED_TRANSLATE_Y)).current;
  const handleOpacity = useRef(new Animated.Value(1)).current;
  const nameOpacity = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Pan responder for swipe up gesture - matching bandPublicProfile.tsx exactly
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
        if (!expanded && gestureState.dy < 0) {
          // Only allow upward movement when collapsed
          const currentValue = expanded ? 0 : COLLAPSED_TRANSLATE_Y;
          const newValue = currentValue + gestureState.dy;
          const constrainedValue = Math.max(0, Math.min(COLLAPSED_TRANSLATE_Y, newValue));
          panelTranslateY.setValue(constrainedValue);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const SWIPE_THRESHOLD = 100;
        const shouldExpand = !expanded && (gestureState.dy < -SWIPE_THRESHOLD || gestureState.vy < -0.5);
        const shouldCollapse = expanded && (gestureState.dy > SWIPE_THRESHOLD || gestureState.vy > 0.5);

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

  // Fetch rating info for the artist
  const fetchRatingInfo = async (artistId: string, userId?: string) => {
    try {
      const result = await ratingService.getRatingInfo(artistId, 'artist', userId);
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
      Alert.alert('Not Logged In', 'Please log in to rate this artist.');
      return;
    }
    setShowRatingModal(true);
  };

  // Handle rating submitted
  const handleRatingSubmitted = (newRating: RatingInfo) => {
    setRatingInfo(newRating);
  };

  // Fetch follower info for the artist
  const fetchFollowerInfo = async (artistId: string, userId?: string) => {
    try {
      const result = await followerService.getFollowerInfo(artistId, 'artist', userId);
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
      Alert.alert('Not Logged In', 'Please log in to follow this artist.');
      return;
    }

    try {
      const result = await followerService.toggleFollow(artist_id, 'artist', currentUser.id);
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

  // Fetch artist data
  const fetchArtistData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      
      if (session?.user) {
        setCurrentUser(session.user);
        
        // Check if current user owns this artist profile
        const { data: userArtist } = await supabase
          .from('artists')
          .select('artist_id')
          .eq('spotter_id', session.user.id);
        
        const userArtistIds = userArtist?.map(a => a.artist_id) || [];
        setIsOwner(userArtistIds.includes(artist_id));
      }

      // Get artist data
      const { data: artist, error: artistError } = await supabase
        .from('artists')
        .select('*')
        .eq('artist_id', artist_id)
        .single();

      if (artistError) {
        throw new Error(`Failed to fetch artist: ${artistError.message}`);
      }

      if (artist) {
        setArtistData(artist);
      }

      // Get artist-specific songs (only show active approved artist songs)
      let songsQuery = supabase
        .from('songs')
        .select('*')
        .eq('artist_id', artist_id)
        .eq('song_type', 'artist')
        .eq('song_status', 'active')
        .eq('song_approved', true);

      const { data: artistSongs, error: songsError } = await songsQuery
        .order('created_at', { ascending: false });

      console.log('🎵 Artist songs query result:', { 
        artistSongs: artistSongs?.length || 0, 
        error: songsError 
      });

      if (!songsError && artistSongs) {
        setSongs(artistSongs);
        console.log('🎵 Songs set:', artistSongs.map(s => ({ 
          title: s.song_title, 
          status: s.song_status, 
          approved: s.song_approved 
        })));
      } else if (songsError) {
        console.log('Artist songs query failed:', songsError);
        setSongs([]);
      }

      // Fetch shows where this artist is a member
      await fetchArtistShows(artist_id);
      
      // Fetch albums for this artist
      await fetchArtistAlbums(artist_id);
      
      // Fetch bands this artist is a member of
      await fetchArtistBands(artist_id);

      // Fetch rating info for this artist
      await fetchRatingInfo(artist_id, session?.user?.id);

      // Fetch follower info for this artist
      await fetchFollowerInfo(artist_id, session?.user?.id);

      // Fade in animation - matching bandPublicProfile.tsx
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
      
    } catch (err: any) {
      console.error('Error fetching artist data:', err);
      setError(err.message || 'Failed to load artist data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch shows where this artist is a member
  const fetchArtistShows = async (artistId: string) => {
    try {
      console.log('🎭 Fetching shows for artist:', artistId);
      
      // Get shows for this artist (both pending and active)
      const { data: shows, error: showsError } = await supabase
        .from('shows')
        .select(`
          show_id,
          show_members,
          show_venue,
          show_status,
          venue_decision,
          show_date,
          show_time,
          show_preferred_date,
          show_preferred_time,
          show_ticket_price,
          created_at,
          venues:show_venue (
            venue_name,
            venue_profile_image
          )
        `)
        .in('show_status', ['pending', 'active', 'sold out']);

      if (!showsError && shows) {
        // Filter shows where this artist is a performer (either as solo artist or band member)
        const artistShows = shows.filter(show => {
          return show.show_members.some((member: any) => {
            if (member.show_member_type === 'artist') {
              return member.show_member_id === artistId;
            } else if (member.show_member_type === 'band' && member.show_member_consensus) {
              // Check if artist is in this band's consensus
              return member.show_member_consensus.some((consensus: any) => 
                consensus.show_band_member_id === artistId
              );
            }
            return false;
          });
        });

        // Separate shows by status
        const pendingShowsList = artistShows.filter(show => show.show_status === 'pending');
        const activeShowsList = artistShows.filter(show => show.show_status === 'active' || show.show_status === 'sold out');

        // Format pending shows for display
        const formattedPendingShows = pendingShowsList.map(show => {
          const venueName = show.venues?.venue_name || 'TBD';
          const venueImage = show.venues?.venue_profile_image;
          
          return {
            show_id: show.show_id,
            title: `Performance @ ${venueName}`,
            venue_name: venueName,
            venue_image: venueImage,
            show_date: show.show_date || show.show_preferred_date,
            show_time: show.show_time || show.show_preferred_time,
            ticket_price: show.show_ticket_price,
            venue_decision: show.venue_decision,
            show_status: show.show_status,
            created_at: show.created_at
          };
        });

        // Format active shows for display
        const formattedActiveShows = activeShowsList.map(show => {
          const venueName = show.venues?.venue_name || 'TBD';
          const venueImage = show.venues?.venue_profile_image;
          
          return {
            show_id: show.show_id,
            title: `Performance @ ${venueName}`,
            venue_name: venueName,
            venue_image: venueImage,
            show_date: show.show_date || show.show_preferred_date,
            show_time: show.show_time || show.show_preferred_time,
            ticket_price: show.show_ticket_price,
            venue_decision: show.venue_decision,
            show_status: show.show_status,
            created_at: show.created_at
          };
        });

        setPendingShows(formattedPendingShows);
        setActiveShows(formattedActiveShows);
        setPerformedShows([]); // Will implement later if needed
        
        console.log('🎭 Artist shows categorized:', {
          pending: formattedPendingShows.length,
          active: formattedActiveShows.length
        });
      } else if (showsError) {
        console.log('Shows query failed:', showsError);
        setPendingShows([]);
        setActiveShows([]);
        setPerformedShows([]);
      }
    } catch (error) {
      console.error('Error fetching artist shows:', error);
    }
  };

  // Fetch bands this artist is a member of
  const fetchArtistBands = async (artistId: string) => {
    try {
      console.log('🎸 Fetching bands for artist:', artistId);
      
      const { data: bands, error } = await supabase
        .from('bands')
        .select('*')
        .contains('band_members', [artistId])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching artist bands:', error);
        return;
      }

      console.log('🎸 Found bands for artist:', bands?.length || 0);
      setBands(bands || []);
    } catch (error) {
      console.error('Error fetching artist bands:', error);
    }
  };

  const fetchArtistAlbums = async (artistId: string) => {
    try {
      console.log('💿 Fetching albums for artist:', artistId);
      
      const result = await albumService.getArtistAlbums(artistId);
      
      if (result.success && result.data) {
        console.log('💿 Found albums for artist:', result.data.length);
        setAlbums(result.data);
      } else {
        console.error('Error fetching artist albums:', result.error);
        setAlbums([]);
      }
    } catch (error) {
      console.error('Error fetching artist albums:', error);
      setAlbums([]);
    }
  };

  useEffect(() => {
    fetchArtistData();
  }, [artist_id]);

  const handleSongPress = (song: Song) => {
    playSong(song, songs);
    // Navigate back to the tab navigator and then to Player
    try {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: 'BottomTabs',
              state: {
                routes: [
                  { name: 'MapHome' },
                  { name: 'Search' },
                  { name: 'Create' },
                  { name: 'Player' },
                  { name: 'Profile' }
                ],
                index: 3, // Player tab index
              },
            },
          ],
        })
      );
    } catch (error) {
      console.error('Navigation error:', error);
      // Simple fallback - just go back and let user navigate manually
      navigation.goBack();
    }
  };

  const SongItem: React.FC<{ song: Song }> = ({ song }) => (
    <View style={styles.songItem}>
      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>
          {song.song_title}
        </Text>
        <View style={styles.songPriceSection}>
          <Text style={styles.songPrice}>${song.song_price}</Text>
          <TouchableOpacity
            style={styles.songPurchaseButton}
            onPress={() => handleSongPurchase(song)}
          >
            <Text style={styles.songPurchaseButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity
        style={styles.playButton}
        onPress={() => handleSongPress(song)}
      >
        <Text style={styles.playButtonText}>▶️</Text>
      </TouchableOpacity>
    </View>
  );

  // Get current artist data for display
  const getCurrentArtistData = () => {
    if (!artistData) return { name: "Artist", images: [] };
    
    return {
      name: artistData.artist_name,
      images: [
        artistData.artist_profile_image, 
        ...(artistData.artist_secondary_images || [])
      ].filter(Boolean),
    };
  };

  // Render tab content - matching bandPublicProfile.tsx exactly
  const renderTabContent = (tabId?: string) => {
    switch (tabId) {
      case 'songs':
        return (
          <View style={styles.tabContent}>
            <ScrollView 
              style={styles.songsContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {songs.length > 0 ? (
                songs.map((song) => (
                  <SongItem key={song.song_id} song={song} />
                ))
              ) : (
                <Text style={styles.noSongsText}>
                  {isOwner 
                    ? "No songs uploaded yet. Upload your first song!" 
                    : "This artist hasn't uploaded any songs yet."
                  }
                </Text>
              )}
            </ScrollView>
          </View>
        );

      case 'albums':
        return (
          <View style={styles.tabContent}>
            <ScrollView 
              style={styles.albumsContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {albums.length > 0 ? (
                albums.map((album) => (
                  <View key={album.album_id} style={styles.albumItem}>
                    <Image
                      source={{ 
                        uri: getImageUrl(album.album_image) || 'https://via.placeholder.com/80'
                      }}
                      style={styles.albumImage}
                    />
                    <View style={styles.albumInfo}>
                      <Text style={styles.albumTitle}>{album.album_title}</Text>
                      <Text style={styles.albumDetails}>
                        {album.album_song_data?.length || 0} song{(album.album_song_data?.length || 0) !== 1 ? 's' : ''}
                      </Text>
                      <Text style={styles.albumPrice}>
                        {album.album_price === '0' ? 'Free' : `$${album.album_price}`}
                      </Text>
                      {album.album_status === 'pending' && (
                        <Text style={styles.albumPendingText}>Pending Approval</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.albumPurchaseButton}
                      onPress={() => handleAlbumPurchase(album)}
                      disabled={album.album_status !== 'active'}
                    >
                      <Text style={styles.albumPurchaseButtonText}>
                        {album.album_price === '0' ? 'Download' : 'Buy'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.noAlbumsText}>
                  {isOwner 
                    ? "No albums created yet. Create your first album!" 
                    : "This artist hasn't released any albums yet."
                  }
                </Text>
              )}
            </ScrollView>
          </View>
        );

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
                    <Image
                      source={{ 
                        uri: show.venue_image || 'https://via.placeholder.com/50' 
                      }}
                      style={styles.showImage}
                    />
                    <View style={styles.showInfo}>
                      <Text style={styles.showTitle}>{show.title}</Text>
                      <Text style={styles.showDetails}>
                        {show.show_date ? new Date(show.show_date).toLocaleDateString() : 'Date TBD'} 
                        {show.show_time ? ` at ${show.show_time}` : ''}
                      </Text>
                      <Text style={[
                        styles.showStatus,
                        { color: show.show_status === 'sold out' ? '#dc3545' : '#28a745' }
                      ]}>
                        {show.show_status === 'sold out' ? 'SOLD OUT' : 'Active Show'}
                      </Text>
                      {show.ticket_price && (
                        <View style={styles.ticketSection}>
                          <Text style={styles.ticketPrice}>${show.ticket_price}</Text>
                          {show.show_status !== 'sold out' ? (
                            <TouchableOpacity 
                              style={styles.buyTicketButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleTicketPurchase(show);
                              }}
                            >
                              <Text style={styles.buyTicketText}>Buy Ticket</Text>
                            </TouchableOpacity>
                          ) : (
                            <Text style={styles.soldOutText}>SOLD OUT</Text>
                          )}
                        </View>
                      )}
                    </View>
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
                    <Image
                      source={{ 
                        uri: show.venue_image || 'https://via.placeholder.com/50' 
                      }}
                      style={styles.showImage}
                    />
                    <View style={styles.showInfo}>
                      <Text style={styles.showTitle}>{show.title}</Text>
                      <Text style={styles.showDetails}>
                        {show.show_date ? new Date(show.show_date).toLocaleDateString() : 'Date TBD'} 
                        {show.show_time ? ` at ${show.show_time}` : ''}
                      </Text>
                      <Text style={[
                        styles.showStatus,
                        { color: show.venue_decision ? '#28a745' : '#ffc107' }
                      ]}>
                        {show.venue_decision ? 'Confirmed by Venue' : 'Pending Venue Approval'}
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
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noShowsText}>No pending shows</Text>
              )}
            </ScrollView>
          </View>
        );

      case 'performedShows':
        return (
          <View style={styles.tabContent}>
            <ScrollView 
              style={styles.showsContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {performedShows.length > 0 ? (
                performedShows.map((show) => (
                  <TouchableOpacity 
                    key={show.show_id} 
                    style={styles.showItem}
                    onPress={() => navigation.navigate('ShowBill' as never, { show_id: show.show_id } as never)}
                  >
                    <View style={styles.showInfo}>
                      <Text style={styles.showTitle}>{show.venues?.venue_name || 'Unknown Venue'}</Text>
                      <Text style={styles.showDate}>
                        {formatShowDateTime(show.show_date, show.show_time, show.show_preferred_date, show.show_preferred_time)}
                      </Text>
                      <Text style={styles.showStatus}>Status: {show.show_status}</Text>
                    </View>
                    <Text style={styles.showArrow}>→</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noShowsText}>No performed shows</Text>
              )}
            </ScrollView>
          </View>
        );

      case 'bands':
        return (
          <View style={styles.tabContent}>
            <ScrollView 
              style={styles.bandsContainer}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {bands.length > 0 ? (
                bands.map((band) => (
                  <TouchableOpacity 
                    key={band.band_id} 
                    style={styles.bandItem}
                    onPress={() => navigation.navigate('BandPublicProfile' as never, { band_id: band.band_id } as never)}
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
                    <Text style={styles.bandArrow}>→</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noBandsText}>Not a member of any bands</Text>
              )}
            </ScrollView>
          </View>
        );

      case 'info':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.infoText}>
              Artist Name: {artistData?.artist_name || 'Unknown'}
            </Text>
            {artistData?.artist_bio && (
              <Text style={styles.infoText}>
                Bio: {artistData.artist_bio}
              </Text>
            )}
            {artistData?.artist_genre && (
              <Text style={styles.infoText}>
                Genre: {artistData.artist_genre}
              </Text>
            )}
            {artistData?.artist_location && (
              <Text style={styles.infoText}>
                Location: {artistData.artist_location}
              </Text>
            )}
          </View>
        );

      default:
        return (
          <View style={styles.tabContent}>
            <Text style={styles.comingSoonText}>
              {ARTIST_TABS.find(tab => tab.id === tabId)?.title} - Coming Soon
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
            console.log('Notification pressed');
          }}
          onMessagePress={() => {
            navigation.navigate('MessagesPage' as never);
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading artist profile...</Text>
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
            console.log('Notification pressed');
          }}
          onMessagePress={() => {
            navigation.navigate('MessagesPage' as never);
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchArtistData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentData = getCurrentArtistData();

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
            console.log('Notification pressed');
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
                    <Image source={{ uri: imageUri }} style={styles.profileImage} />
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
          
        </Animated.View>

        {/* Rating button - positioned separately for better touch handling */}
        <TouchableOpacity 
          style={styles.ratingButton} 
          onPress={handleRatingPress}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={["rgba(0, 0, 0, 0.8)", "rgba(0, 0, 0, 0.4)"]}
            style={styles.ratingBackground}
          >
            <Text style={styles.ratingText}>
              {ratingInfo ? 
                '★'.repeat(Math.round(ratingInfo.currentRating)) + 
                '☆'.repeat(5 - Math.round(ratingInfo.currentRating))
                : '★★★★★'
              }
            </Text>
            <Text style={styles.reviewText}>
              {ratingInfo ? 
                `${ratingInfo.currentRating.toFixed(1)} (${ratingInfo.totalRaters} review${ratingInfo.totalRaters !== 1 ? 's' : ''})`
                : '5.0 (0 reviews)'
              }
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Tip button - positioned next to rating button */}
        {!isOwner && (
          <Animated.View style={[styles.tipButtonContainer, { opacity: nameOpacity }]}>
            <TouchableOpacity 
              style={styles.tipButtonOverlay} 
              onPress={() => setShowTipModal(true)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={["rgba(0, 0, 0, 0.8)", "rgba(0, 0, 0, 0.4)"]}
                style={styles.tipButtonBackground}
              >
                <Text style={styles.tipButtonText}>+</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

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
          >
            {tabs.map((tab) => (
              <View key={tab.id} style={styles.tabSection}>
                <TouchableOpacity
                  style={styles.tabHeader}
                  onPress={() => toggleTab(tab.id)}
                >
                  <Text style={styles.tabTitle}>{tab.title}</Text>
                  <Text style={[styles.tabIcon, { transform: [{ rotate: tab.expanded ? '180deg' : '0deg' }] }]}>
                    ▼
                  </Text>
                </TouchableOpacity>
                
                {tab.expanded && (
                  <View style={styles.tabContentExpanded}>
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
          >
            <Image 
              source={{ uri: selectedImage || '' }} 
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Song Purchase Modal */}
      <SongPurchaseModal
        visible={showSongModal}
        onClose={() => setShowSongModal(false)}
        songData={selectedSong}
        onPurchaseSuccess={() => {
          // Refresh after purchase
          console.log('Song purchased successfully');
        }}
      />

      {/* Ticket Purchase Modal */}
      <TicketPurchaseModal
        visible={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        showData={selectedShow}
        onPurchaseSuccess={() => {
          // Refresh shows data after purchase
          fetchArtistData();
        }}
      />

      {/* Album Purchase Modal */}
      <AlbumPurchaseModal
        visible={showAlbumModal}
        onClose={() => setShowAlbumModal(false)}
        album={selectedAlbum}
        onPurchaseComplete={() => {
          // Refresh after purchase
          console.log('Album purchased successfully');
        }}
      />

      {/* Rating Modal */}
      <RatingModal
        visible={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        entityId={artist_id}
        entityType="artist"
        entityName={artistData?.artist_name || 'Artist'}
        onRatingSubmitted={handleRatingSubmitted}
      />

      <TipModal
        visible={showTipModal}
        onClose={() => setShowTipModal(false)}
        recipientId={artist_id}
        recipientType="artist"
        recipientName={artistData?.artist_name || 'Artist'}
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
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  artistHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  artistName: {
    fontSize: 24,
    fontFamily: 'Audiowide-Regular',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
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
    paddingVertical: 10,
  },
  tabsScrollView: {
    paddingHorizontal: 20,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  activeTab: {
    backgroundColor: '#ff00ff',
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  tabContent: {
    flex: 1,
  },
  songsContainer: {
    flex: 1,
  },
  noSongsText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
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
  songPriceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  songPrice: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#ff00ff',
    fontWeight: '600',
  },
  songPurchaseButton: {
    backgroundColor: '#ff00ff',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  songPurchaseButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
    lineHeight: 14,
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
  ratingButton: {
    position: 'absolute',
    bottom: 140, // Position above the collapsed tabs panel
    right: 20,
    zIndex: 1000, // High z-index to ensure it's above image touch areas
    elevation: 10, // Android shadow/elevation
  },
  ratingBackground: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 16,
    color: '#FFD700',
    marginBottom: 2,
  },
  reviewText: {
    fontSize: 12,
    color: '#fff',
    fontFamily: 'Amiko-Regular',
  },
  // Tip button styles
  tipButtonContainer: {
    position: 'absolute',
    bottom: 140, // Same as rating button
    left: 20, // Position on the left side
    zIndex: 1000,
    elevation: 10,
  },
  tipButtonOverlay: {
    // Container for touch handling
  },
  tipButtonBackground: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    minHeight: 40,
  },
  tipButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
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
  tabSection: {
    marginBottom: 8,
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginHorizontal: 10,
  },
  tabTitle: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#333',
    fontWeight: '600',
  },
  tabIcon: {
    fontSize: 14,
    color: '#666',
  },
  tabContentExpanded: {
    backgroundColor: '#fff',
    marginHorizontal: 10,
    borderRadius: 8,
    marginTop: 4,
    padding: 15,
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
  // Bands styles
  bandsContainer: {
    flex: 1,
  },
  bandItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
  bandImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  bandInfo: {
    flex: 1,
    marginRight: 10,
  },
  bandName: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#333',
    fontWeight: '600',
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
  bandArrow: {
    fontSize: 18,
    color: '#2a2882',
    fontWeight: 'bold',
  },
  noBandsText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  // Show display styles
  showImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  showDetails: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    marginBottom: 2,
  },
  ticketSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  ticketPrice: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#28a745',
    fontWeight: '600',
    marginRight: 10,
  },
  buyTicketButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  buyTicketText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
  },
  soldOutText: {
    color: '#dc3545',
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
  },
  
  // Album styles
  albumsContainer: {
    maxHeight: 400,
  },
  albumItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    marginBottom: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  albumImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 15,
    backgroundColor: '#f0f0f0',
  },
  albumInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  albumTitle: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#333',
    fontWeight: '600',
    marginBottom: 4,
  },
  albumDetails: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    marginBottom: 2,
  },
  albumPrice: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#28a745',
    fontWeight: '600',
  },
  albumPendingText: {
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    color: '#ffc107',
    fontWeight: '600',
    marginTop: 2,
  },
  albumPurchaseButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  albumPurchaseButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
  },
  noAlbumsText: {
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
});

export default ArtistPublicProfile;