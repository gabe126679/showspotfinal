import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  FlatList,
  Dimensions,
  Animated,
  TextInput,
  ScrollView,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import PlaylistModal from './PlaylistModal';
import EmptyState from './EmptyState';
import { ToastManager } from './Toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Song {
  song_id: string;
  song_title: string;
  song_image: string;
  song_file: string;
  artist_id: string;
  spotter_id: string;
  song_price: string;
  created_at: string;
  song_type?: 'artist' | 'band';
  band_id?: string;
  // Optional pre-fetched names to avoid database lookups
  artist_name?: string;
  band_name?: string;
}


interface MusicPlayerContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  isShuffleOn: boolean;
  isRepeatOn: boolean;
  playlistQueue: Song[];
  currentIndex: number;
  playSong: (song: Song, playlist?: Song[]) => void;
  pauseSong: () => void;
  nextSong: () => void;
  previousSong: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  progress: number;
  duration: number;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | null>(null);

// Simple HTML5 Audio wrapper for Expo Go compatibility
class WebAudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private onProgress: ((currentTime: number, duration: number) => void) | null = null;
  private onEnded: (() => void) | null = null;
  private onStateChange: ((isPlaying: boolean) => void) | null = null;
  private progressInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Only create audio element on web/in browser context
    if (Platform.OS === 'web' || typeof Audio !== 'undefined') {
      try {
        this.audio = new Audio();
        this.setupEventListeners();
      } catch (error) {
        console.log('HTML5 Audio not available, using simulation mode');
        this.audio = null;
      }
    }
  }

  private setupEventListeners() {
    if (!this.audio) return;

    this.audio.addEventListener('loadedmetadata', () => {
      if (this.onProgress && this.audio) {
        this.onProgress(this.audio.currentTime, this.audio.duration);
      }
    });

    this.audio.addEventListener('timeupdate', () => {
      if (this.onProgress && this.audio) {
        this.onProgress(this.audio.currentTime, this.audio.duration);
      }
    });

    this.audio.addEventListener('ended', () => {
      if (this.onEnded) this.onEnded();
      if (this.onStateChange) this.onStateChange(false);
    });

    this.audio.addEventListener('play', () => {
      if (this.onStateChange) this.onStateChange(true);
    });

    this.audio.addEventListener('pause', () => {
      if (this.onStateChange) this.onStateChange(false);
    });
  }

  setEventHandlers(
    onProgress: (currentTime: number, duration: number) => void,
    onEnded: () => void,
    onStateChange: (isPlaying: boolean) => void
  ) {
    this.onProgress = onProgress;
    this.onEnded = onEnded;
    this.onStateChange = onStateChange;
  }

  async loadAndPlay(url: string): Promise<void> {
    if (this.audio) {
      // Real HTML5 Audio
      this.audio.src = url;
      try {
        await this.audio.play();
      } catch (error) {
        console.warn('Audio play failed, falling back to simulation:', error);
        this.simulatePlayback(url);
      }
    } else {
      // Simulate playback for non-web environments
      this.simulatePlayback(url);
    }
  }

  private simulatePlayback(url: string) {
    // Clear any existing interval
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    // Simulate 3-minute song
    const duration = 180; // seconds
    let currentTime = 0;
    
    if (this.onProgress) {
      this.onProgress(0, duration);
    }
    if (this.onStateChange) {
      this.onStateChange(true);
    }

    this.progressInterval = setInterval(() => {
      currentTime += 1;
      if (this.onProgress) {
        this.onProgress(currentTime, duration);
      }
      
      if (currentTime >= duration) {
        this.stop();
        if (this.onEnded) this.onEnded();
      }
    }, 1000);
  }

  async play(): Promise<void> {
    if (this.audio) {
      try {
        await this.audio.play();
      } catch (error) {
        console.warn('Audio play failed:', error);
      }
    } else if (this.progressInterval) {
      // Resume simulation
      if (this.onStateChange) this.onStateChange(true);
    }
  }

  pause(): void {
    if (this.audio) {
      this.audio.pause();
    } else {
      // Pause simulation
      if (this.progressInterval) {
        clearInterval(this.progressInterval);
        this.progressInterval = null;
      }
      if (this.onStateChange) this.onStateChange(false);
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    if (this.onStateChange) this.onStateChange(false);
  }

  getCurrentTime(): number {
    if (this.audio) {
      return this.audio.currentTime;
    }
    return 0;
  }

  getDuration(): number {
    if (this.audio) {
      return this.audio.duration || 0;
    }
    return 180; // Default to 3 minutes for simulation
  }

  isPlaying(): boolean {
    if (this.audio) {
      return !this.audio.paused && !this.audio.ended;
    }
    return this.progressInterval !== null;
  }

  destroy() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
    if (this.audio) {
      this.audio.pause();
      this.audio.removeEventListener('loadedmetadata', () => {});
      this.audio.removeEventListener('timeupdate', () => {});
      this.audio.removeEventListener('ended', () => {});
      this.audio.removeEventListener('play', () => {});
      this.audio.removeEventListener('pause', () => {});
    }
  }
}

export const MusicPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffleOn, setIsShuffleOn] = useState(false);
  const [isRepeatOn, setIsRepeatOn] = useState(false);
  const [playlistQueue, setPlaylistQueue] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const playerRef = useRef<WebAudioPlayer | null>(null);
  const isTransitioningRef = useRef(false);

  useEffect(() => {
    // Initialize player
    playerRef.current = new WebAudioPlayer();
    
    playerRef.current.setEventHandlers(
      (currentTime, duration) => {
        setProgress(currentTime * 1000); // Convert to milliseconds
        setDuration(duration * 1000); // Convert to milliseconds
      },
      () => {
        // Song ended
        if (!isRepeatOn && !isTransitioningRef.current) {
          nextSong();
        } else if (isRepeatOn && playerRef.current) {
          playerRef.current.loadAndPlay(playerRef.current.audio?.src || '');
        }
      },
      (playing) => {
        setIsPlaying(playing);
      }
    );

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [isRepeatOn]);

  // Helper function to get proper audio URL
  const getAudioUrl = async (filePath: string): Promise<string> => {
    try {
      console.log('Getting audio URL for:', filePath);
      
      // If it's already a full URL, return it
      if (filePath.startsWith('http')) {
        return filePath;
      }

      // Since songs bucket is public, use public URL first
      const { data: publicData } = supabase.storage
        .from('songs')
        .getPublicUrl(filePath);
      
      if (publicData?.publicUrl) {
        console.log('Using public URL:', publicData.publicUrl);
        return publicData.publicUrl;
      }

      // Fallback to signed URL if public fails
      const { data, error } = await supabase.storage
        .from('songs')
        .createSignedUrl(filePath, 3600);

      if (error) {
        console.error('Error creating signed URL:', error);
        throw error;
      }

      if (!data?.signedUrl) {
        throw new Error('No signed URL returned');
      }

      console.log('Using signed URL:', data.signedUrl);
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting audio URL:', error);
      throw error;
    }
  };

  // Helper function to get image URL
  const getImageUrl = (imagePath: string): string => {
    if (!imagePath) return '';
    
    // If it's already a full URL, return it
    if (imagePath.startsWith('http')) {
      return imagePath;
    }

    // For public song-images bucket, use public URL
    const { data } = supabase.storage
      .from('song-images')
      .getPublicUrl(imagePath);

    return data.publicUrl;
  };

  const playSong = async (song: Song, playlist: Song[] = []) => {
    try {
      console.log('Playing song:', song.song_title);
      isTransitioningRef.current = true;
      
      // Stop current playback
      if (playerRef.current) {
        playerRef.current.stop();
      }

      // Get the proper audio URL
      const audioUrl = await getAudioUrl(song.song_file);
      console.log('Setting audio URL:', audioUrl);

      setCurrentSong(song);
      setProgress(0);
      
      // Set up playlist queue
      if (playlist.length > 0) {
        setPlaylistQueue(playlist);
        setCurrentIndex(playlist.findIndex(s => s.song_id === song.song_id));
      }

      // Start playback
      if (playerRef.current) {
        await playerRef.current.loadAndPlay(audioUrl);
      }

      isTransitioningRef.current = false;

    } catch (error) {
      console.error('Error playing song:', error);
      ToastManager.error('Could not play this song. Please try again.');
      isTransitioningRef.current = false;
    }
  };

  const pauseSong = async () => {
    if (playerRef.current) {
      if (playerRef.current.isPlaying()) {
        playerRef.current.pause();
      } else {
        playerRef.current.play();
      }
    }
  };

  const nextSong = async () => {
    if (playlistQueue.length > 0 && !isTransitioningRef.current) {
      let nextIndex;
      if (isShuffleOn) {
        nextIndex = Math.floor(Math.random() * playlistQueue.length);
      } else {
        nextIndex = (currentIndex + 1) % playlistQueue.length;
      }
      const nextSong = playlistQueue[nextIndex];
      setCurrentIndex(nextIndex);
      await playSong(nextSong, playlistQueue);
    }
  };

  const previousSong = async () => {
    if (playlistQueue.length > 0 && !isTransitioningRef.current) {
      let prevIndex;
      if (isShuffleOn) {
        prevIndex = Math.floor(Math.random() * playlistQueue.length);
      } else {
        prevIndex = currentIndex === 0 ? playlistQueue.length - 1 : currentIndex - 1;
      }
      const prevSong = playlistQueue[prevIndex];
      setCurrentIndex(prevIndex);
      await playSong(prevSong, playlistQueue);
    }
  };

  const toggleShuffle = () => {
    setIsShuffleOn(!isShuffleOn);
  };

  const toggleRepeat = () => {
    setIsRepeatOn(!isRepeatOn);
  };

  const contextValue: MusicPlayerContextType = {
    currentSong,
    isPlaying,
    isShuffleOn,
    isRepeatOn,
    playlistQueue,
    currentIndex,
    playSong,
    pauseSong,
    nextSong,
    previousSong,
    toggleShuffle,
    toggleRepeat,
    progress,
    duration,
  };

  return (
    <MusicPlayerContext.Provider value={contextValue}>
      {children}
    </MusicPlayerContext.Provider>
  );
};

export const useMusicPlayer = () => {
  const context = useContext(MusicPlayerContext);
  if (!context) {
    throw new Error('useMusicPlayer must be used within a MusicPlayerProvider');
  }
  return context;
};


const Player = () => {
  const navigation = useNavigation();
  const {
    currentSong,
    isPlaying,
    isShuffleOn,
    isRepeatOn,
    pauseSong,
    nextSong,
    previousSong,
    toggleShuffle,
    toggleRepeat,
    progress,
    duration,
  } = useMusicPlayer();

  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [artistName, setArtistName] = useState('Unknown Artist');
  const progressAnimation = useRef(new Animated.Value(0)).current;
  
  // Animation values for button presses
  const playButtonScale = useRef(new Animated.Value(1)).current;
  const shuffleButtonScale = useRef(new Animated.Value(1)).current;
  const repeatButtonScale = useRef(new Animated.Value(1)).current;

  // Get artist name from database
  useEffect(() => {
    const fetchArtistName = async () => {
      if (currentSong?.artist_id) {
        try {
          // First check if names are already available in the song object (pre-fetched)
          if (currentSong.artist_name || currentSong.band_name) {
            const displayName = currentSong.song_type === 'band' 
              ? (currentSong.band_name || currentSong.artist_name || 'Unknown Band')
              : (currentSong.artist_name || currentSong.band_name || 'Unknown Artist');
            setArtistName(displayName);
            return;
          }

          // Fallback to database lookup if names aren't pre-fetched
          // Check if this is a band song
          if (currentSong.song_type === 'band' && currentSong.band_id) {
            // Fetch band name for band songs
            const { data, error } = await supabase
              .from('bands')
              .select('band_name')
              .eq('band_id', currentSong.band_id)
              .maybeSingle();

            if (error) {
              console.error('Error fetching band:', error);
              setArtistName('Unknown Band');
            } else {
              setArtistName(data?.band_name || 'Unknown Band');
            }
          } else {
            // Fetch artist name for individual artist songs
            const { data, error } = await supabase
              .from('artists')
              .select('artist_name')
              .eq('artist_id', currentSong.artist_id)
              .maybeSingle();

            if (error) {
              console.error('Error fetching artist:', error);
              setArtistName('Unknown Artist');
            } else {
              setArtistName(data?.artist_name || 'Unknown Artist');
            }
          }
        } catch (error) {
          console.error('Error fetching artist/band name:', error);
          setArtistName(currentSong.song_type === 'band' ? 'Unknown Band' : 'Unknown Artist');
        }
      }
    };

    fetchArtistName();
  }, [currentSong?.artist_id, currentSong?.song_type, currentSong?.band_id, currentSong?.artist_name, currentSong?.band_name]);

  // Update progress animation
  useEffect(() => {
    if (duration > 0) {
      const progressPercentage = (progress / duration) * 100;
      Animated.timing(progressAnimation, {
        toValue: progressPercentage,
        duration: 100,
        useNativeDriver: false,
      }).start();
    }
  }, [progress, duration]);

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Animation handlers
  const animateButtonPress = (scale: Animated.Value) => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePlayPress = () => {
    if (currentSong) {
      animateButtonPress(playButtonScale);
      pauseSong();
    }
  };

  const handleShufflePress = () => {
    if (currentSong) {
      animateButtonPress(shuffleButtonScale);
      toggleShuffle();
    }
  };

  const handleRepeatPress = () => {
    if (currentSong) {
      animateButtonPress(repeatButtonScale);
      toggleRepeat();
    }
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

  // Navigate to artist/band profile
  const navigateToArtistProfile = async () => {
    setShowOptionsModal(false);

    if (!currentSong) {
      ToastManager.error('No song is currently playing');
      return;
    }

    try {
      // Check if this is a band song
      if (currentSong.song_type === 'band') {
        console.log('This is a band song, looking up band...');
        console.log('Song band_id:', currentSong.band_id);
        console.log('Song artist_id:', currentSong.artist_id);

        let band = null;

        // First try to find band by the song's band_id
        if (currentSong.band_id) {
          const { data: bandByBandId } = await supabase
            .from('bands')
            .select('band_id')
            .eq('band_id', currentSong.band_id)
            .maybeSingle();
          band = bandByBandId;
          if (band) console.log('Found band by band_id');
        }

        // If not found, try using artist_id as band_id (sometimes stored in wrong field)
        if (!band && currentSong.artist_id) {
          console.log('Trying artist_id as band_id:', currentSong.artist_id);
          const { data: bandByArtistId } = await supabase
            .from('bands')
            .select('band_id')
            .eq('band_id', currentSong.artist_id)
            .maybeSingle();
          band = bandByArtistId;
          if (band) console.log('Found band using artist_id as band_id');
        }

        // If still not found, try finding by band_creator
        if (!band && currentSong.spotter_id) {
          console.log('Trying to find band by creator:', currentSong.spotter_id);
          const { data: bandByCreator } = await supabase
            .from('bands')
            .select('band_id')
            .eq('band_creator', currentSong.spotter_id)
            .maybeSingle();
          band = bandByCreator;
          if (band) console.log('Found band by creator');
        }

        if (band) {
          console.log('Found band, navigating to:', band.band_id);
          navigation.navigate('BandPublicProfile' as never, { band_id: band.band_id } as never);
        } else {
          ToastManager.error('Could not find the band profile');
        }
      } else {
        // For artist songs, find the artist by spotter_id since
        // the song's artist_id might not directly match the artists table
        let { data: artist } = await supabase
          .from('artists')
          .select('artist_id')
          .eq('artist_id', currentSong.artist_id)
          .maybeSingle();

        // If not found, try by spotter_id (the user who uploaded the song)
        if (!artist && currentSong.spotter_id) {
          console.log('Trying to find artist by spotter_id:', currentSong.spotter_id);
          const { data: artistBySpotter } = await supabase
            .from('artists')
            .select('artist_id')
            .eq('spotter_id', currentSong.spotter_id)
            .maybeSingle();
          artist = artistBySpotter;
        }

        if (artist) {
          console.log('Found artist, navigating to:', artist.artist_id);
          navigation.navigate('ArtistPublicProfile' as never, { artist_id: artist.artist_id } as never);
        } else {
          ToastManager.error('Could not find the artist profile');
        }
      }
    } catch (error) {
      console.error('Error finding artist/band:', error);
      ToastManager.error('Could not load profile');
    }
  };

  // Open add to playlist
  const handleAddToPlaylist = () => {
    setShowOptionsModal(false);
    setShowPlaylistModal(true);
  };

  // If no song is playing, show empty state
  if (!currentSong) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.playerHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Now Playing</Text>
          </View>

          <View style={styles.moreButton} />
        </View>

        <EmptyState
          icon="music"
          title="No Song Playing"
          subtitle="Discover local artists and bands, then tap a song to start playing. Your music journey begins with a single tap!"
          actionLabel="Explore Artists"
          onAction={() => navigation.navigate('BottomTabs' as never, { screen: 'Search' } as never)}
          style={styles.emptyStateContainer}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        <View style={styles.playerHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Now Playing</Text>
          </View>

          <TouchableOpacity
            style={styles.moreButton}
            onPress={() => setShowOptionsModal(true)}
          >
            <View style={styles.moreButtonDots}>
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.albumArtContainer}>
          <View style={styles.albumArtShadow}>
            <Image
              source={{
                uri: getImageUrl(currentSong.song_image)
              }}
              style={styles.albumArt}
              resizeMode="cover"
              defaultSource={require('../assets/icon.png')}
            />
          </View>
        </View>

        <View style={styles.songInfo}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {currentSong.song_title}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {artistName}
          </Text>

          {/* View Artist Link - Spotify style */}
          <TouchableOpacity
              style={styles.viewArtistButton}
              onPress={navigateToArtistProfile}
            >
              <Text style={styles.viewArtistText}>View Artist</Text>
              <Text style={styles.viewArtistArrow}>›</Text>
            </TouchableOpacity>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnimation.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                      extrapolate: 'clamp',
                    }),
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.progressThumb,
                  {
                    left: progressAnimation.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}
                />
            </View>
          </View>
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{formatTime(progress)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>

        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              isShuffleOn && styles.controlButtonActive
            ]}
            onPress={handleShufflePress}
            activeOpacity={0.8}
          >
            <Animated.View style={[
              styles.shuffleIcon, 
              isShuffleOn && styles.iconActive,
              { transform: [{ scale: shuffleButtonScale }] }
            ]}>
              <View style={[styles.shuffleLine1, isShuffleOn && styles.lineActive]} />
              <View style={[styles.shuffleLine2, isShuffleOn && styles.lineActive]} />
              <View style={[styles.shuffleArrow1, isShuffleOn && styles.arrowActive]} />
              <View style={[styles.shuffleArrow2, isShuffleOn && styles.arrowActive]} />
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={previousSong}
          >
            <View style={styles.previousIcon}>
              <View style={styles.skipBar} />
              <View style={[styles.skipTriangle, styles.skipTriangleLeft]} />
              <View style={[styles.skipTriangle, styles.skipTriangleLeft2]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayPress}
            activeOpacity={0.9}
          >
            <Animated.View style={[
              styles.playButtonOuter,
              { transform: [{ scale: playButtonScale }] }
            ]}>
              {isPlaying ? (
                <View style={styles.pauseIcon}>
                  <View style={styles.pauseBar} />
                  <View style={styles.pauseBar} />
                </View>
              ) : (
                <View style={styles.playTriangle} />
              )}
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={nextSong}
          >
            <View style={styles.nextIcon}>
              <View style={[styles.skipTriangle, styles.skipTriangleRight]} />
              <View style={[styles.skipTriangle, styles.skipTriangleRight2]} />
              <View style={styles.skipBar} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              isRepeatOn && styles.controlButtonActive
            ]}
            onPress={handleRepeatPress}
            activeOpacity={0.8}
          >
            <Animated.View style={[
              styles.repeatIcon, 
              isRepeatOn && styles.iconActive,
              { transform: [{ scale: repeatButtonScale }] }
            ]}>
              <View style={[styles.repeatCircle, isRepeatOn && styles.repeatCircleActive]} />
              <View style={[styles.repeatArrow, isRepeatOn && styles.repeatArrowActive]} />
              <View style={[styles.repeatArrowHead1, isRepeatOn && styles.repeatArrowHeadActive]} />
              <View style={[styles.repeatArrowHead2, isRepeatOn && styles.repeatArrowHeadActive]} />
            </Animated.View>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Options Modal */}
      <Modal
        visible={showOptionsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <TouchableOpacity
          style={styles.optionsModalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsModal(false)}
        >
          <View style={styles.optionsModalContent}>
            <View style={styles.optionsModalHandle} />

            {/* View Artist/Band Option */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={navigateToArtistProfile}
            >
              <View style={styles.optionIconContainer}>
                <Text style={styles.optionIcon}>👤</Text>
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>
                  View {currentSong?.song_type === 'band' ? 'Band' : 'Artist'}
                </Text>
                <Text style={styles.optionSubtitle}>{artistName}</Text>
              </View>
              <Text style={styles.optionArrow}>›</Text>
            </TouchableOpacity>

            {/* Add to Playlist Option */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleAddToPlaylist}
            >
              <View style={styles.optionIconContainer}>
                <Text style={styles.optionIcon}>➕</Text>
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Add to Playlist</Text>
                <Text style={styles.optionSubtitle}>Save this song for later</Text>
              </View>
              <Text style={styles.optionArrow}>›</Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.optionCancelButton}
              onPress={() => setShowOptionsModal(false)}
            >
              <Text style={styles.optionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <PlaylistModal
        visible={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        song={currentSong}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40, // Minimal padding since footer is hidden on player
  },
  emptyStateContainer: {
    flex: 1,
    marginTop: 40,
  },
  playerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 28,
    color: "#ffffff",
    fontWeight: "300",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.5)",
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: 'Amiko-SemiBold',
  },
  moreButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  moreButtonDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  albumArtContainer: {
    alignItems: "center",
    marginBottom: 32,
    marginTop: 10,
  },
  albumArtShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  albumArt: {
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 0.85,
    borderRadius: 8,
    backgroundColor: '#1a1a1f',
  },
  songInfo: {
    alignItems: "center",
    marginBottom: 28,
    paddingHorizontal: 30,
  },
  songTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: 0.3,
    fontFamily: 'Amiko-Bold',
  },
  artistName: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
    letterSpacing: 0.2,
    fontFamily: 'Amiko-Regular',
    marginBottom: 12,
  },
  viewArtistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.3)',
  },
  viewArtistText: {
    fontSize: 13,
    color: '#ff00ff',
    fontWeight: '600',
    fontFamily: 'Amiko-SemiBold',
    letterSpacing: 0.3,
  },
  viewArtistArrow: {
    fontSize: 18,
    color: '#ff00ff',
    marginLeft: 4,
    fontWeight: '300',
  },
  progressContainer: {
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 2,
    position: "relative",
    overflow: "visible",
  },
  progressFill: {
    height: 4,
    backgroundColor: "#ffffff",
    borderRadius: 2,
  },
  progressThumb: {
    position: "absolute",
    right: -6,
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.5)",
    fontWeight: "500",
    fontFamily: 'Amiko-Regular',
    letterSpacing: 0.3,
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
    paddingHorizontal: 20,
    gap: 24,
  },
  controlButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  controlButtonActive: {
    // Active state indicator handled by icon color change
  },
  controlButtonDisabled: {
    opacity: 0.3,
  },
  skipButton: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  playButton: {
    marginHorizontal: 16,
  },
  playButtonDisabled: {
    opacity: 0.5,
  },
  playButtonOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  playButtonOuterDisabled: {
    backgroundColor: "#555",
    shadowOpacity: 0,
  },
  playButtonGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  playButtonInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  playButtonInnerGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: 72,
    borderRadius: 36,
    backgroundColor: "#ffffff",
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 22,
    borderLeftColor: "#0a0a0f",
    borderTopWidth: 13,
    borderTopColor: "transparent",
    borderBottomWidth: 13,
    borderBottomColor: "transparent",
    marginLeft: 5,
  },
  pauseIcon: {
    flexDirection: "row",
    gap: 6,
  },
  pauseBar: {
    width: 6,
    height: 22,
    backgroundColor: "#0a0a0f",
    borderRadius: 2,
  },
  // Shuffle Icon
  shuffleIcon: {
    width: 24,
    height: 24,
    position: 'relative',
  },
  shuffleLine1: {
    position: 'absolute',
    width: 18,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    top: 8,
    left: 3,
    borderRadius: 1,
  },
  shuffleLine2: {
    position: 'absolute',
    width: 18,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    bottom: 8,
    left: 3,
    borderRadius: 1,
  },
  shuffleArrow1: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderLeftColor: 'rgba(255, 255, 255, 0.6)',
    borderTopWidth: 3,
    borderTopColor: 'transparent',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    top: 5,
    right: 2,
  },
  shuffleArrow2: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderRightWidth: 5,
    borderRightColor: 'rgba(255, 255, 255, 0.6)',
    borderTopWidth: 3,
    borderTopColor: 'transparent',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    bottom: 5,
    left: 2,
  },
  iconActive: {
    // Scale handled inline
  },
  lineActive: {
    backgroundColor: '#ff00ff',
  },
  arrowActive: {
    borderLeftColor: '#ff00ff',
    borderRightColor: '#ff00ff',
  },
  // Skip Icons
  previousIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skipBar: {
    width: 3,
    height: 18,
    backgroundColor: '#ffffff',
    borderRadius: 1.5,
  },
  skipBarDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  skipTriangle: {
    width: 0,
    height: 0,
  },
  skipTriangleLeft: {
    borderRightWidth: 14,
    borderRightColor: '#ffffff',
    borderTopWidth: 9,
    borderTopColor: 'transparent',
    borderBottomWidth: 9,
    borderBottomColor: 'transparent',
    marginRight: -3,
  },
  skipTriangleLeft2: {
    borderRightWidth: 14,
    borderRightColor: '#ffffff',
    borderTopWidth: 9,
    borderTopColor: 'transparent',
    borderBottomWidth: 9,
    borderBottomColor: 'transparent',
    marginRight: 2,
  },
  skipTriangleRight: {
    borderLeftWidth: 14,
    borderLeftColor: '#ffffff',
    borderTopWidth: 9,
    borderTopColor: 'transparent',
    borderBottomWidth: 9,
    borderBottomColor: 'transparent',
    marginLeft: 2,
  },
  skipTriangleRight2: {
    borderLeftWidth: 14,
    borderLeftColor: '#ffffff',
    borderTopWidth: 9,
    borderTopColor: 'transparent',
    borderBottomWidth: 9,
    borderBottomColor: 'transparent',
    marginLeft: -3,
  },
  skipTriangleDisabled: {
    borderLeftColor: 'rgba(255, 255, 255, 0.3)',
    borderRightColor: 'rgba(255, 255, 255, 0.3)',
  },
  // Repeat Icon
  repeatIcon: {
    width: 24,
    height: 24,
    position: 'relative',
  },
  repeatCircle: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderRightColor: 'transparent',
    top: 3,
    left: 3,
    transform: [{ rotate: '45deg' }],
  },
  repeatCircleActive: {
    borderColor: '#ff00ff',
    borderRightColor: 'transparent',
  },
  repeatArrow: {
    position: 'absolute',
    width: 2,
    height: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    top: 1,
    right: 5,
    transform: [{ rotate: '45deg' }],
    borderRadius: 1,
  },
  repeatArrowActive: {
    backgroundColor: '#ff00ff',
  },
  repeatArrowHead1: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(255, 255, 255, 0.6)',
    borderTopWidth: 3,
    borderTopColor: 'transparent',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    top: 0,
    right: 3,
  },
  repeatArrowHead2: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(255, 255, 255, 0.6)',
    borderTopWidth: 3,
    borderTopColor: 'transparent',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    top: 3,
    right: 3,
  },
  repeatArrowHeadActive: {
    borderLeftColor: '#ff00ff',
  },
  // Options Modal styles
  optionsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  optionsModalContent: {
    backgroundColor: '#1a1a1f',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  optionsModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 0, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionIcon: {
    fontSize: 20,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: 'Amiko-SemiBold',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: 'Amiko-Regular',
  },
  optionArrow: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '300',
  },
  optionCancelButton: {
    marginTop: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  optionCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Amiko-SemiBold',
  },
});

export default Player;