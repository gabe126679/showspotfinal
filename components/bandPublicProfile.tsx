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
import SongPurchaseModal from "./SongPurchaseModal";
import AlbumPurchaseModal from "./AlbumPurchaseModal";
import SongUploadForm from "./SongUploadForm";
import ShowVoteButton from "./ShowVoteButton";
import { backlinesService } from "../services/backlinesService";
import RatingModal from "./RatingModal";
import { ratingService, RatingInfo } from '../services/ratingService';
import { followerService, FollowerInfo } from '../services/followerService';
import TipModal from "./TipModal";
import PaymentDisclaimer from "./PaymentDisclaimer";
import AlbumCreationModal from "./AlbumCreationModal";
import AlbumImageUploadModal from "./AlbumImageUploadModal";
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
  const [albums, setAlbums] = useState<Album[]>([]);
  const [backliningShows, setBackliningShows] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserArtistId, setCurrentUserArtistId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isBandMember, setIsBandMember] = useState(false);
  
  // Shows data states
  const [activeShows, setActiveShows] = useState<any[]>([]);
  const [pendingShows, setPendingShows] = useState<any[]>([]);
  const [performedShows, setPerformedShows] = useState<any[]>([]);
  
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
  
  // Song upload form state
  const [showSongUploadForm, setShowSongUploadForm] = useState(false);
  
  // Album creation modal state
  const [showAlbumCreationModal, setShowAlbumCreationModal] = useState(false);
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  
  // Album image upload modal state
  const [showAlbumImageUploadModal, setShowAlbumImageUploadModal] = useState(false);
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [editingAlbumTitle, setEditingAlbumTitle] = useState<string>('');
  const [currentAlbumImage, setCurrentAlbumImage] = useState<string | undefined>(undefined);
  
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

  // Handle edit profile images
  const handleEditImages = () => {
    setShowImageModal(false);
    navigation.navigate('BandPicture' as never);
  };

  // Handle song purchase
  const handleSongPurchase = (song: Song) => {
    console.log('handleSongPurchase called with song:', song);
    
    if (!song || !bandData) {
      console.error('Song or band data is null or undefined');
      return;
    }
    
    const songDataForModal = {
      song_id: song.song_id,
      song_title: song.song_title,
      song_image: song.song_image,
      song_file: song.song_file,
      song_price: song.song_price,
      song_type: 'band' as const,
      song_artist: bandData.band_id,
      band_name: bandData.band_name,
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
        case 'song':
          handleSongPurchase(pendingAction.data);
          break;
        case 'album':
          handleAlbumPurchase(pendingAction.data);
          break;
      }
      setPendingAction(null);
    }
  };

  const handlePaymentCancel = () => {
    setShowPaymentDisclaimer(false);
    setPendingAction(null);
  };
  
  // Tab state
  const [tabs, setTabs] = useState<TabData[]>(BAND_TABS);

  // Animation refs - matching profile.tsx exactly
  const panelTranslateY = useRef(new Animated.Value(COLLAPSED_TRANSLATE_Y)).current;
  const handleOpacity = useRef(new Animated.Value(1)).current;
  const nameOpacity = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fetch rating info for the band
  const fetchRatingInfo = async (bandId: string, userId?: string) => {
    try {
      const result = await ratingService.getRatingInfo(bandId, 'band', userId);
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
      Alert.alert('Not Logged In', 'Please log in to rate this band.');
      return;
    }
    setShowRatingModal(true);
  };

  // Handle rating submitted
  const handleRatingSubmitted = (newRating: RatingInfo) => {
    setRatingInfo(newRating);
  };

  // Fetch follower info for the band
  const fetchFollowerInfo = async (bandId: string, userId?: string) => {
    try {
      const result = await followerService.getFollowerInfo(bandId, 'band', userId);
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
      Alert.alert('Not Logged In', 'Please log in to follow this band.');
      return;
    }

    try {
      const result = await followerService.toggleFollow(band_id, 'band', currentUser.id);
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

  // Fetch band data
  const fetchBandData = async () => {
    try {
      setLoading(true);

      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentUser(session?.user);

      // Get band data
      const { data: band, error: bandError } = await supabase
        .from('bands')
        .select('*')
        .eq('band_id', band_id)
        .single();

      if (bandError) throw bandError;
      setBandData(band);

      // Initialize permission variables
      let isCreator = false;
      let isMember = false;
      let userArtistIdInBand = null;

      // Check if current user is band creator or member
      if (session?.user) {
        // Check if user is band creator (by spotter_id)
        isCreator = band.band_creator === session.user.id;
        setIsOwner(isCreator);

        // Check if user is a band member (by artist_id)
        // First, get the user's artist profile(s)
        const { data: userArtist } = await supabase
          .from('artists')
          .select('artist_id')
          .eq('spotter_id', session.user.id);
        
        const userArtistIds = userArtist?.map(a => a.artist_id) || [];
        
        // Check if any of user's artist IDs are in the band members array
        if (band.band_members && band.band_members.length > 0 && userArtistIds.length > 0) {
          for (const artistId of userArtistIds) {
            if (band.band_members.includes(artistId)) {
              isMember = true;
              userArtistIdInBand = artistId;
              break;
            }
          }
        }
        
        setIsBandMember(isMember);
        
        // If user is not a band member but is the owner, we need to find their artist ID
        if (!userArtistIdInBand && isCreator && userArtistIds.length > 0) {
          // Use the first artist ID for the band creator
          userArtistIdInBand = userArtistIds[0];
        }
        
        setCurrentUserArtistId(userArtistIdInBand);
        
        console.log('Band permissions check:', {
          userId: session.user.id,
          bandCreator: band.band_creator,
          isOwner: isCreator,
          userArtistIds,
          bandMembers: band.band_members,
          isBandMember: isMember,
          currentUserArtistId: userArtistIdInBand,
          shouldShowEditButton: isCreator || isMember
        });
      }

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

      // Get band-specific songs
      // Band members can see pending songs, non-members only see approved songs
      let songsQuery = supabase
        .from('songs')
        .select('*')
        .eq('band_id', band_id);

      if (isBandMember || isOwner) {
        // Band members see all songs (pending and active)
        songsQuery = songsQuery.in('song_status', ['pending', 'active']);
      } else {
        // Non-members only see approved active songs
        songsQuery = songsQuery
          .eq('song_status', 'active')
          .eq('song_approved', true);
      }

      const { data: bandSongs, error: songsError } = await songsQuery
        .order('created_at', { ascending: false });

      console.log('🎵 Band songs query result:', { 
        isBandMember, 
        isOwner, 
        bandSongs: bandSongs?.length || 0, 
        error: songsError 
      });

      if (!songsError && bandSongs) {
        setSongs(bandSongs);
        console.log('🎵 Songs set:', bandSongs.map(s => ({ 
          title: s.song_title, 
          status: s.song_status, 
          approved: s.song_approved 
        })));
      } else if (songsError) {
        // If band_id column doesn't exist yet, fallback to empty array
        console.log('Band songs query failed (band_id column may not exist yet):', songsError);
        setSongs([]);
      }

      // Fetch shows where this band is a member
      await fetchBandShows(band_id);

      // Fetch band albums - pass the permission flags we just calculated
      await fetchBandAlbums(band_id, isMember, isCreator);

      // Fetch rating info for this band
      await fetchRatingInfo(band_id, session?.user?.id);

      // Fetch follower info for this band
      await fetchFollowerInfo(band_id, session?.user?.id);
      
      // Fetch backlining shows for this band
      await fetchBackliningShows(band_id);

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

  // Fetch shows where this band is a member
  const fetchBandShows = async (bandId: string) => {
    try {
      console.log('🎭 Fetching shows for band:', bandId);
      
      // Get shows for this band (both pending and active)
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
        // Filter shows where this band is a performer
        const bandShows = shows.filter(show => {
          return show.show_members.some((member: any) => {
            if (member.show_member_type === 'band') {
              return member.show_member_id === bandId;
            }
            return false;
          });
        });

        // Separate shows by status
        const pendingShowsList = bandShows.filter(show => show.show_status === 'pending');
        const activeShowsList = bandShows.filter(show => show.show_status === 'active' || show.show_status === 'sold out');

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
        
        console.log('🎭 Band shows categorized:', {
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
      console.error('Error fetching band shows:', error);
    }
  };

  // Fetch band albums
  const fetchBandAlbums = async (bandId: string, isMember: boolean = false, isCreator: boolean = false) => {
    try {
      console.log('🎵 Fetching albums for band:', bandId);
      
      const result = await albumService.getBandAlbums(bandId);
      
      if (result.success && result.data) {
        // Band members can see pending albums, non-members only see active albums
        const filteredAlbums = (isMember || isCreator) 
          ? result.data 
          : result.data.filter(album => album.album_status === 'active');
        
        setAlbums(filteredAlbums);
        console.log('🎵 Band albums fetched:', filteredAlbums.length);
      } else {
        console.log('Failed to fetch band albums:', result.error);
        setAlbums([]);
      }
    } catch (error) {
      console.error('Error fetching band albums:', error);
      setAlbums([]);
    }
  };

  // Fetch backlining shows for this band
  const fetchBackliningShows = async (bandId: string) => {
    try {
      console.log('🎸 Fetching backlining shows for band:', bandId);
      
      const result = await backlinesService.getBackliningShows(bandId, 'band');
      
      if (result.success && result.data) {
        console.log('🎸 Found backlining shows for band:', result.data.length);
        setBackliningShows(result.data);
      } else {
        console.error('Error fetching backlining shows:', result.error);
        setBackliningShows([]);
      }
    } catch (error) {
      console.error('Error fetching backlining shows:', error);
      setBackliningShows([]);
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
    <View style={[styles.songItem, song.song_status === 'pending' && styles.pendingSongItem]}>
      <View style={styles.songInfo}>
        <View style={styles.songTitleContainer}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {song.song_title}
          </Text>
          {song.song_status === 'pending' && (
            <Text style={styles.pendingLabel}>PENDING APPROVAL</Text>
          )}
        </View>
        <View style={styles.songPriceSection}>
          <Text style={styles.songPrice}>${song.song_price}</Text>
          {song.song_status === 'active' && (
            <TouchableOpacity
              style={styles.songPurchaseButton}
              onPress={() => handlePaymentAction('song', song)}
            >
              <Text style={styles.songPurchaseButtonText}>+</Text>
            </TouchableOpacity>
          )}
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

  // Get current band data for display
  const getCurrentBandData = () => {
    if (!bandData) return { name: "Band", images: [] };
    
    // Get profile image
    const profileImage = bandData.band_profile_picture;
    
    // Get secondary images, excluding the profile image to avoid duplicates
    const secondaryImages = (bandData.band_secondary_pictures || [])
      .filter(img => img && img !== bandData.band_profile_picture);
    
    // Combine profile image first, then secondary images
    const allImages = profileImage ? [profileImage, ...secondaryImages] : secondaryImages;
    
    return {
      name: bandData.band_name,
      images: allImages.filter(Boolean),
    };
  };

  // Get album image with fallback to band profile image
  const getAlbumImageUrl = (album: Album): string => {
    if (album.album_image) {
      // If album has its own image, use it
      if (album.album_image.startsWith('http')) {
        return album.album_image;
      }
      // Assume it's a storage path
      const { data } = supabase.storage
        .from('song-images') // or wherever album images are stored
        .getPublicUrl(album.album_image);
      return data.publicUrl;
    }
    
    // Fallback to band profile image
    if (bandData?.band_profile_picture) {
      return bandData.band_profile_picture;
    }
    
    // Final fallback
    return 'https://via.placeholder.com/150';
  };

  // Toggle album expansion
  const toggleAlbumExpansion = (albumId: string) => {
    setExpandedAlbums(prev => {
      const newSet = new Set(prev);
      if (newSet.has(albumId)) {
        newSet.delete(albumId);
      } else {
        newSet.add(albumId);
      }
      return newSet;
    });
  };

  // Album image upload handlers
  const handleAlbumImageUploaded = (imageUrl: string) => {
    // Update the local album state
    setAlbums(prevAlbums => 
      prevAlbums.map(album => 
        album.album_id === editingAlbumId 
          ? { ...album, album_image: imageUrl }
          : album
      )
    );
    // Close modal and reset state
    setShowAlbumImageUploadModal(false);
    setEditingAlbumId(null);
    setEditingAlbumTitle('');
    setCurrentAlbumImage(undefined);
  };

  const handleAlbumImageUploadClose = () => {
    setShowAlbumImageUploadModal(false);
    setEditingAlbumId(null);
    setEditingAlbumTitle('');
    setCurrentAlbumImage(undefined);
  };

  // Render tab content
  const renderTabContent = (tab: TabData) => {
    if (!tab.expanded) return null;

    switch (tab.id) {
      case 'members':
        return (
          <View style={styles.tabContent}>
            {bandMembers.map((member) => (
              <TouchableOpacity 
                key={member.artist_id} 
                style={styles.memberItem}
                onPress={() => navigation.navigate('ArtistPublicProfile', { artist_id: member.artist_id })}
              >
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
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'songs':
        return (
          <View style={styles.tabContent}>
            {/* Add Song button for band members */}
            {(isOwner || isBandMember) && (
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => setShowSongUploadForm(true)}
              >
                <Text style={styles.addButtonText}>+ Upload Song</Text>
              </TouchableOpacity>
            )}
            
            <ScrollView 
              style={styles.songsList}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {songs.length > 0 ? (
                songs.map((song) => (
                  <SongItem key={song.song_id} song={song} />
                ))
              ) : (
                <Text style={styles.noSongsText}>
                  {(isOwner || isBandMember) 
                    ? "No songs uploaded yet. Upload your first band song!" 
                    : "This band hasn't uploaded any songs yet."
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
                    <View style={styles.showInfo}>
                      <Text style={styles.showTitle}>{show.venue_name || 'TBD'}</Text>
                      <Text style={styles.showDate}>
                        {show.show_date} at {show.show_time}
                      </Text>
                      <Text style={styles.showStatus}>Status: {show.show_status}</Text>
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
                      <Text style={styles.showTitle}>{show.venue_name || 'TBD'}</Text>
                      <Text style={styles.showDate}>
                        {show.show_date} at {show.show_time}
                      </Text>
                      <Text style={styles.showStatus}>Status: {show.show_status}</Text>
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
                      <Text style={styles.showTitle}>{show.venue_name || 'TBD'}</Text>
                      <Text style={styles.showDate}>
                        {show.show_date} at {show.show_time}
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

      case 'albums':
        return (
          <View style={styles.tabContent}>
            {/* Add Album button for band members */}
            {(isOwner || isBandMember) && (
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => {
                  console.log('Create Album clicked. Current user artist ID:', currentUserArtistId);
                  if (!currentUserArtistId) {
                    Alert.alert('Error', 'Unable to create album. Your artist profile is not properly linked to this band.');
                    return;
                  }
                  setShowAlbumCreationModal(true);
                }}
              >
                <Text style={styles.addButtonText}>+ Create Album</Text>
              </TouchableOpacity>
            )}
            
            <ScrollView 
              style={styles.albumsList}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {albums.length > 0 ? (
                albums.map((album) => (
                  <View key={album.album_id} style={[styles.albumItemContainer, album.album_status === 'pending' && styles.pendingAlbumContainer]}>
                    <TouchableOpacity 
                      style={styles.albumHeader} 
                      onPress={() => toggleAlbumExpansion(album.album_id)}
                      activeOpacity={0.7}
                    >
                      <Image 
                        source={{ uri: getAlbumImageUrl(album) }}
                        style={styles.albumImage}
                        resizeMode="cover"
                      />
                      <View style={styles.albumInfo}>
                        <View style={styles.albumTitleContainer}>
                          <Text style={styles.albumTitle} numberOfLines={1}>
                            {album.album_title}
                          </Text>
                          {album.album_status === 'pending' && (
                            <Text style={styles.pendingLabel}>PENDING APPROVAL</Text>
                          )}
                        </View>
                        <Text style={styles.albumDetails}>
                          {album.album_song_data.length} song{album.album_song_data.length !== 1 ? 's' : ''} • ${album.album_price}
                        </Text>
                      </View>
                      <View style={styles.albumActions}>
                        {(isOwner || isBandMember) && (
                          <TouchableOpacity
                            style={styles.albumEditImageButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              setEditingAlbumId(album.album_id);
                              setEditingAlbumTitle(album.album_title);
                              setCurrentAlbumImage(album.album_image);
                              setShowAlbumImageUploadModal(true);
                            }}
                          >
                            <Text style={styles.albumEditImageButtonText}>📷</Text>
                          </TouchableOpacity>
                        )}
                        {album.album_status === 'active' && (
                          <TouchableOpacity
                            style={styles.albumPurchaseButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handlePaymentAction('album', album);
                            }}
                          >
                            <Text style={styles.albumPurchaseButtonText}>Buy</Text>
                          </TouchableOpacity>
                        )}
                        <Text style={[styles.expandArrow, expandedAlbums.has(album.album_id) && styles.expandArrowRotated]}>
                          ▼
                        </Text>
                      </View>
                    </TouchableOpacity>
                    
                    {/* Expanded album content - show songs */}
                    {expandedAlbums.has(album.album_id) && (
                      <View style={styles.albumSongsContainer}>
                        <Text style={styles.albumSongsTitle}>Songs in this album:</Text>
                        {album.album_song_data.map((song, index) => (
                          <TouchableOpacity 
                            key={`${song.song_id}-${index}`}
                            style={styles.albumSongItem}
                            onPress={() => {
                              // Create a song object for playback
                              const songForPlay = {
                                song_id: song.song_id,
                                song_title: song.song_title,
                                song_file: song.song_file,
                                song_image: song.song_image,
                                song_price: '0', // Playing from album
                                artist_id: song.song_artist || '',
                                spotter_id: song.song_artist || '',
                                created_at: new Date().toISOString(),
                                song_type: song.song_type
                              };
                              handleSongPress(songForPlay);
                            }}
                          >
                            <View style={styles.albumSongInfo}>
                              <Text style={styles.albumSongTitle}>{song.song_title}</Text>
                              <Text style={styles.albumSongArtist}>
                                {song.song_type === 'band' ? song.band_name : song.artist_name}
                              </Text>
                            </View>
                            <TouchableOpacity style={styles.albumSongPlayButton}>
                              <Text style={styles.albumSongPlayText}>▶️</Text>
                            </TouchableOpacity>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.noAlbumsText}>
                  {(isOwner || isBandMember) 
                    ? "No albums created yet. Create your first band album!" 
                    : "This band hasn't created any albums yet."
                  }
                </Text>
              )}
            </ScrollView>
          </View>
        );

      case 'backliningShows':
        return (
          <View style={styles.tabContent}>
            {backliningShows.length > 0 ? (
              <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                {backliningShows.map((show, index) => (
                  <TouchableOpacity
                    key={show.show_id}
                    style={styles.showItem}
                    onPress={() => {
                      navigation.navigate('ShowBill' as never, {
                        show_id: show.show_id
                      } as never);
                    }}
                  >
                    <View style={styles.showImageContainer}>
                      <Image
                        source={{
                          uri: show.venue_profile_image || 'https://via.placeholder.com/80x80'
                        }}
                        style={styles.showVenueImage}
                      />
                    </View>
                    <View style={styles.showInfoContainer}>
                      <Text style={styles.showVenueName}>{show.venue_name}</Text>
                      <Text style={styles.showDate}>
                        {new Date(show.show_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                        {show.show_time && ` at ${show.show_time}`}
                      </Text>
                      <View style={styles.showStatusContainer}>
                        <View style={[
                          styles.statusDot,
                          show.show_status === 'active' && show.venue_decision
                            ? styles.activeStatus
                            : styles.pendingStatus
                        ]} />
                        <Text style={styles.showStatus}>
                          {show.show_status === 'active' && show.venue_decision
                            ? 'Confirmed Show'
                            : 'Pending Venue Approval'
                          }
                        </Text>
                      </View>
                    </View>
                    <View style={styles.showActionsContainer}>
                      <ShowVoteButton
                        showId={show.show_id}
                        backlineArtist={band_id}
                        backlineArtistType="band"
                        onVoteUpdate={() => {
                          // Optionally refresh data after vote
                          console.log('Vote updated for backline');
                        }}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.noDataContainer}>
                <Text style={styles.noDataText}>
                  {(isOwner || isBandMember)
                    ? "This band hasn't applied to backline any shows yet." 
                    : "This band isn't backlining any shows yet."
                  }
                </Text>
              </View>
            )}
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
          navigation.navigate('NotificationsPage' as never);
        }}
        onMessagePress={() => {
          navigation.navigate('MessagesPage' as never);
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
                <View key={`band-image-${index}-${item?.substring(item.length - 10) || index}`} style={styles.imageContainer}>
                  <TouchableOpacity 
                    style={styles.imageTouch}
                    onPress={() => handleImagePress(item)}
                    activeOpacity={0.9}
                  >
                    <Image 
                      source={{ uri: item }} 
                      style={styles.profileImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                </View>
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
          // Make placeholder pressable for band members to upload image
          (isOwner || isBandMember) ? (
            <TouchableOpacity
              style={styles.imagePlaceholderTouchable}
              onPress={() => navigation.navigate('BandPicture', { band_id })}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#ff00ff20", "#2a288220"]}
                style={styles.imagePlaceholder}
              >
                <Text style={styles.placeholderIcon}>📷</Text>
                <Text style={styles.placeholderText}>No Image</Text>
                <Text style={styles.placeholderSubtext}>Tap to upload</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <LinearGradient
              colors={["#ff00ff20", "#2a288220"]}
              style={styles.imagePlaceholder}
            >
              <Text style={styles.placeholderText}>No Image</Text>
            </LinearGradient>
          )
        )}

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
            <View style={styles.panelHeaderContent}>
              {/* Band name and music icon on the right */}
              <View style={styles.rightBandInfo}>
                <Text style={styles.nameTextInside} numberOfLines={1}>
                  {currentData.name}
                </Text>
                <Text style={styles.musicIcon}>🎵</Text>
              </View>
              
              {/* Add subtle visual indicator for swipe down */}
              {expanded && (
                <Text style={styles.swipeDownIndicator}>▼</Text>
              )}
            </View>
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
          
          {/* Action buttons - matching profile.tsx exactly */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton}>
              <LinearGradient
                colors={["#ff00ff", "#2a2882"]}
                style={styles.actionButtonGradient}
              >
                <TouchableOpacity onPress={() => navigation.navigate("BottomTabs" as never)}>
                  <Text style={styles.actionButtonText}>
                    View Artist Profile
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton}>
              <LinearGradient
                colors={["#2a2882", "#ff00ff"]}
                style={styles.actionButtonGradient}
              >
                <TouchableOpacity onPress={() => navigation.navigate("BottomTabs" as never)}>
                  <Text style={styles.actionButtonText}>
                    View Spotter Profile
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.signOutButton}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
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
            
            {/* Edit button - show for band owner, any band member, or temporarily for any logged-in user */}
            {(isOwner || isBandMember || currentUser) && (
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

      {/* Song Upload Form Modal */}
      <SongUploadForm
        visible={showSongUploadForm}
        onClose={() => {
          setShowSongUploadForm(false);
          // Refresh songs list after upload with small delay for DB consistency
          setTimeout(() => {
            fetchBandData();
          }, 500);
        }}
        artistData={null}
        bandData={bandData}
        bandId={band_id}
      />

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

      {/* Rating Modal */}
      <RatingModal
        visible={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        entityId={band_id}
        entityType="band"
        entityName={bandData?.band_name || 'Band'}
        onRatingSubmitted={handleRatingSubmitted}
      />

      <TipModal
        visible={showTipModal}
        onClose={() => setShowTipModal(false)}
        recipientId={band_id}
        recipientType="band"
        recipientName={bandData?.band_name || 'Band'}
      />

      <PaymentDisclaimer
        visible={showPaymentDisclaimer}
        onClose={handlePaymentCancel}
        onProceed={handlePaymentProceed}
        action={
          pendingAction?.type === 'tip' ? 'tip' :
          pendingAction?.type === 'song' ? 'purchase the song' :
          pendingAction?.type === 'album' ? 'purchase the album' :
          'make a purchase'
        }
        itemName={
          pendingAction?.type === 'tip' ? bandData?.band_name :
          pendingAction?.type === 'song' ? pendingAction?.data?.title :
          pendingAction?.type === 'album' ? pendingAction?.data?.title :
          undefined
        }
      />

      {/* Album Creation Modal */}
      <AlbumCreationModal
        visible={showAlbumCreationModal}
        onClose={() => setShowAlbumCreationModal(false)}
        onAlbumCreated={() => {
          // Refresh albums list after creation
          setTimeout(() => {
            fetchBandAlbums(band_id, isBandMember, isOwner);
          }, 500);
        }}
        artistData={{
          ...bandData,
          artist_id: currentUserArtistId || '', // Pass the current user's artist ID for proper album creation
        }}
        albumType="band"
        songs={songs.filter(song => song.song_status === 'active')} // Only active songs can be added to albums
      />

      {/* Album Purchase Modal */}
      <AlbumPurchaseModal
        visible={showAlbumModal}
        onClose={() => setShowAlbumModal(false)}
        album={selectedAlbum}
        onPurchaseComplete={() => {
          // Refresh after purchase
          console.log('Band album purchased successfully');
        }}
      />

      {/* Album Image Upload Modal */}
      {editingAlbumId && (
        <AlbumImageUploadModal
          visible={showAlbumImageUploadModal}
          onClose={handleAlbumImageUploadClose}
          albumId={editingAlbumId}
          albumTitle={editingAlbumTitle}
          onImageUploaded={handleAlbumImageUploaded}
          currentImageUrl={currentAlbumImage}
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
    marginTop: -20,//ve image up 15px from natural position
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
    width: SCREEN_WIDTH,
    height: IMAGE_SECTION_HEIGHT,
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 18,
    fontFamily: "Amiko-Regular",
    color: "#999",
    marginBottom: 8,
  },
  imagePlaceholderTouchable: {
    width: "100%",
    height: "100%",
  },
  placeholderSubtext: {
    fontSize: 14,
    fontFamily: "Amiko-Regular",
    color: "#666",
    fontStyle: 'italic',
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
  ratingButton: {
    position: 'absolute',
    bottom: 140, // Position above the collapsed tabs panel
    right: 20,
    zIndex: 1000, // High z-index to ensure it's above image touch areas
    elevation: 10, // Android shadow/elevation
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
    paddingVertical: 32.5, // Expanded by 35px (was 15, now 32.5 = 17.5px on each side)
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  panelHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end", // Push content to the right
    width: "100%",
    paddingRight: 10, // 5-10px back from edge
  },
  rightBandInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: -10, // Move band name and music icon up 10px
  },
  nameTextInside: {
    fontSize: 24,
    fontFamily: "Audiowide-Regular",
    color: "#fff",
    textAlign: "right",
    marginRight: 8, // Space between name and music icon
  },
  musicIcon: {
    fontSize: 20,
    color: "#fff",
  },
  swipeDownIndicator: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "bold",
    position: "absolute",
    left: 20, // Move to left side since content is now on right
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
  addButton: {
    backgroundColor: '#ff00ff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#fff',
    fontWeight: '600',
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
  pendingSongItem: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  songTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingLabel: {
    fontSize: 10,
    fontFamily: 'Amiko-Regular',
    color: '#856404',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  
  // Album styles
  albumsList: {
    maxHeight: 400,
    marginBottom: 10,
  },
  albumItemContainer: {
    backgroundColor: '#fff',
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  pendingAlbumContainer: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  albumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  albumImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
    backgroundColor: '#f0f0f0',
  },
  albumInfo: {
    flex: 1,
    marginRight: 10,
  },
  albumTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  albumTitle: {
    fontSize: 18,
    fontFamily: 'Amiko-Regular',
    color: '#333',
    fontWeight: '600',
    marginBottom: 4,
    flex: 1,
  },
  albumDetails: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#666',
  },
  albumActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  albumPurchaseButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  albumPurchaseButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
    fontFamily: 'Amiko-Regular',
  },
  albumEditImageButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  albumEditImageButtonText: {
    fontSize: 14,
    color: '#fff',
  },
  expandArrow: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    transform: [{ rotate: '0deg' }],
  },
  expandArrowRotated: {
    transform: [{ rotate: '180deg' }],
  },
  albumSongsContainer: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  albumSongsTitle: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  albumSongItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    marginBottom: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  albumSongInfo: {
    flex: 1,
    marginRight: 10,
  },
  albumSongTitle: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  albumSongArtist: {
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    color: '#666',
  },
  albumSongPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff00ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumSongPlayText: {
    fontSize: 12,
    color: '#fff',
  },
  noAlbumsText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
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
  
  // Action buttons - matching profile.tsx exactly
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
  
  // Follow button styles
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
    zIndex: 100,
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
  
  // Modern rating modal styles
  modernRatingContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modernStarsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  modernStar: {
    padding: 4,
  },
  modernStarFilled: {
    color: '#FFD700',
  },
  modernStarEmpty: {
    color: '#E0E0E0',
  },
  modernRatingText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  showImageContainer: {
    marginRight: 15,
  },
  showVenueImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  showInfoContainer: {
    flex: 1,
    marginRight: 15,
  },
  showVenueName: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  showDate: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    marginBottom: 6,
  },
  showStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  activeStatus: {
    backgroundColor: '#28a745',
  },
  pendingStatus: {
    backgroundColor: '#ffc107',
  },
  showStatus: {
    fontSize: 12,
    fontFamily: 'Amiko-Regular',
    color: '#2a2882',
    fontWeight: '600',
  },
  showActionsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noDataText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default BandPublicProfile;