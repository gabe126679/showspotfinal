import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Modal, 
  FlatList, 
  Alert,
  Dimensions,
  Animated,
  TextInput,
  ScrollView
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import PlaylistModal from './PlaylistModal';

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

export const MusicPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffleOn, setIsShuffleOn] = useState(false);
  const [isRepeatOn, setIsRepeatOn] = useState(false);
  const [playlistQueue, setPlaylistQueue] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  const playbackStatusRef = useRef<any>(null);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

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
      
      // Stop current song if playing
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      // Set audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Get the proper audio URL
      const audioUrl = await getAudioUrl(song.song_file);

      console.log('Creating audio with URL:', audioUrl);

      // Create new sound object with better error handling
      const soundResult = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { 
          shouldPlay: false, // Don't auto-play initially for better debugging
          isLooping: isRepeatOn,
          volume: 1.0,
          rate: 1.0,
          shouldCorrectPitch: true,
        },
        (status) => {
          // Only log important status changes, not every progress update
          if (status.didJustFinish || !status.isLoaded || 
              (playbackStatusRef.current?.isPlaying !== status.isPlaying)) {
            console.log('Audio status update:', status);
          }
          playbackStatusRef.current = status;
          
          if (status.isLoaded) {
            setProgress(status.positionMillis || 0);
            setDuration(status.durationMillis || 0);
            setIsPlaying(status.isPlaying || false);
            
            // Handle song completion
            if (status.didJustFinish && !isRepeatOn) {
              nextSong();
            }
          } else if (!status.isLoaded) {
            const errorStatus = status as Audio.AVPlaybackStatusError;
            if (errorStatus.error) {
              console.error('Audio loading error:', errorStatus.error);
              Alert.alert('Playback Error', 'Could not load audio file');
            }
          }
        }
      );

      console.log('Sound object created:', soundResult);
      const newSound = soundResult.sound;

      // Check initial status
      const initialStatus = await newSound.getStatusAsync();
      console.log('Initial sound status:', initialStatus);

      if (initialStatus.isLoaded) {
        console.log('Sound loaded successfully, starting playback...');
        
        // Start playback manually
        await newSound.playAsync();
        
        setSound(newSound);
        setCurrentSong(song);
        setIsPlaying(true);
        
        // Set up playlist queue
        if (playlist.length > 0) {
          setPlaylistQueue(playlist);
          setCurrentIndex(playlist.findIndex(s => s.song_id === song.song_id));
        }

        console.log('Song should now be playing!');
      } else {
        console.error('Sound failed to load:', initialStatus);
        if (initialStatus.error) {
          console.error('Load error details:', initialStatus.error);
        }
        await newSound.unloadAsync();
        throw new Error('Audio file could not be loaded');
      }

    } catch (error) {
      console.error('Error playing song:', error);
      Alert.alert('Error', 'Could not play this song. Please try again.');
    }
  };

  const pauseSong = async () => {
    if (sound) {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await sound.pauseAsync();
            setIsPlaying(false);
          } else {
            await sound.playAsync();
            setIsPlaying(true);
          }
        }
      } catch (error) {
        console.error('Error pausing/playing song:', error);
      }
    }
  };

  const nextSong = async () => {
    if (playlistQueue.length > 0) {
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
    if (playlistQueue.length > 0) {
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
    const newRepeatState = !isRepeatOn;
    setIsRepeatOn(newRepeatState);
    if (sound) {
      sound.setIsLoopingAsync(newRepeatState);
    }
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
          // Check if this is a band song
          if (currentSong.song_type === 'band' && currentSong.band_id) {
            // Fetch band name for band songs
            const { data, error } = await supabase
              .from('bands')
              .select('band_name')
              .eq('band_id', currentSong.band_id)
              .single();

            if (error) throw error;
            setArtistName(data?.band_name || 'Unknown Band');
          } else {
            // Fetch artist name for individual artist songs
            const { data, error } = await supabase
              .from('artists')
              .select('artist_name')
              .eq('artist_id', currentSong.artist_id)
              .single();

            if (error) throw error;
            setArtistName(data?.artist_name || 'Unknown Artist');
          }
        } catch (error) {
          console.error('Error fetching artist/band name:', error);
          setArtistName(currentSong.song_type === 'band' ? 'Unknown Band' : 'Unknown Artist');
        }
      }
    };

    fetchArtistName();
  }, [currentSong?.artist_id, currentSong?.song_type, currentSong?.band_id]);

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

  const openPlaylistModal = () => {
    if (currentSong) {
      setShowPlaylistModal(true);
    }
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

  // Always show the player UI, even with no song

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.playerContent}>
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
            onPress={openPlaylistModal}
            disabled={!currentSong}
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
            <View style={styles.albumArtFrame}>
              <Image
                source={{ 
                  uri: currentSong ? getImageUrl(currentSong.song_image) : undefined 
                }}
                style={styles.albumArt}
                resizeMode="cover"
                defaultSource={require('../assets/icon.png')}
              />
              {currentSong && (
                <View style={styles.albumArtGlow} />
              )}
            </View>
          </View>
        </View>

        <View style={styles.songInfo}>
          <Text style={styles.songTitle}>
            {currentSong ? currentSong.song_title : 'No Song Playing'}
          </Text>
          <Text style={styles.artistName}>
            {currentSong ? artistName : 'Select a song from an artist profile'}
          </Text>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{formatTime(progress)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
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
              <View style={styles.progressThumb} />
            </View>
          </View>
        </View>

        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[
              styles.controlButton, 
              isShuffleOn && styles.controlButtonActive,
              !currentSong && styles.controlButtonDisabled
            ]}
            onPress={handleShufflePress}
            disabled={!currentSong}
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
            style={[styles.skipButton, !currentSong && styles.controlButtonDisabled]} 
            onPress={currentSong ? previousSong : undefined}
            disabled={!currentSong}
          >
            <View style={styles.previousIcon}>
              <View style={[styles.skipBar, !currentSong && styles.skipBarDisabled]} />
              <View style={[styles.skipTriangle, styles.skipTriangleLeft, !currentSong && styles.skipTriangleDisabled]} />
              <View style={[styles.skipTriangle, styles.skipTriangleLeft2, !currentSong && styles.skipTriangleDisabled]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.playButton, !currentSong && styles.playButtonDisabled]} 
            onPress={handlePlayPress}
            disabled={!currentSong}
            activeOpacity={0.8}
          >
            <Animated.View style={[
              styles.playButtonOuter, 
              !currentSong && styles.playButtonOuterDisabled,
              { transform: [{ scale: playButtonScale }] }
            ]}>
              <LinearGradient
                colors={currentSong ? ["#ff00ff", "#ff00ff"] : ["#ccc", "#999"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.playButtonGradient}
              >
                <View style={styles.playButtonInner}>
                  <LinearGradient
                    colors={currentSong ? ["#ffffff20", "#ffffff05"] : ["#ffffff10", "#ffffff05"]}
                    style={styles.playButtonInnerGradient}
                  >
                    {currentSong && isPlaying ? (
                      <View style={styles.pauseIcon}>
                        <View style={styles.pauseBar} />
                        <View style={styles.pauseBar} />
                      </View>
                    ) : (
                      <View style={styles.playTriangle} />
                    )}
                  </LinearGradient>
                </View>
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.skipButton, !currentSong && styles.controlButtonDisabled]} 
            onPress={currentSong ? nextSong : undefined}
            disabled={!currentSong}
          >
            <View style={styles.nextIcon}>
              <View style={[styles.skipTriangle, styles.skipTriangleRight, !currentSong && styles.skipTriangleDisabled]} />
              <View style={[styles.skipTriangle, styles.skipTriangleRight2, !currentSong && styles.skipTriangleDisabled]} />
              <View style={[styles.skipBar, !currentSong && styles.skipBarDisabled]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton, 
              isRepeatOn && styles.controlButtonActive,
              !currentSong && styles.controlButtonDisabled
            ]}
            onPress={handleRepeatPress}
            disabled={!currentSong}
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
      </View>

      {currentSong && (
        <PlaylistModal
          visible={showPlaylistModal}
          onClose={() => setShowPlaylistModal(false)}
          song={currentSong}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: "space-between", 
    backgroundColor: "#0a0a0f",
    paddingBottom: 120, // Account for bottom tab bar height + extra spacing
  },
  content: { 
    alignItems: "center", 
    marginTop: 100 
  },
  title: { 
    fontSize: 32, 
    fontWeight: "bold", 
    color: "#ffffff" 
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    marginTop: 10,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  playerContent: {
    flex: 1,
    paddingHorizontal: 25,
    paddingTop: 50,
    backgroundColor: "#0a0a0f",
  },
  playerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 40,
    paddingHorizontal: 5,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 20,
    color: "#ffffff",
    fontWeight: "600",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    color: "#888",
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  moreButtonDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ffffff",
  },
  albumArtContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  albumArtShadow: {
    shadowColor: "#ff00ff",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  albumArtFrame: {
    position: "relative",
    borderRadius: 25,
    overflow: "hidden",
    backgroundColor: "#1a1a1f",
    padding: 8,
  },
  albumArt: {
    width: SCREEN_WIDTH * 0.65,
    height: SCREEN_WIDTH * 0.65,
    borderRadius: 17,
    backgroundColor: '#2a2a2f',
  },
  albumArtGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 25,
    backgroundColor: "rgba(255, 0, 255, 0.1)",
    shadowColor: "#ff00ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  songInfo: {
    alignItems: "center",
    marginBottom: 35,
    paddingHorizontal: 25,
  },
  songTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  artistName: {
    fontSize: 18,
    color: "#888",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  progressContainer: {
    marginBottom: 35,
    paddingHorizontal: 15,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  timeText: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  progressBarContainer: {
    paddingHorizontal: 5,
  },
  progressBar: {
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 3,
    position: "relative",
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: "#ff00ff",
    borderRadius: 3,
    shadowColor: "#ff00ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  progressThumb: {
    position: "absolute",
    right: -6,
    top: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 40,
    paddingHorizontal: 25,
    maxWidth: SCREEN_WIDTH - 40,
    alignSelf: "center",
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  controlButtonActive: {
    backgroundColor: "rgba(255, 0, 255, 0.15)",
    borderColor: "rgba(255, 0, 255, 0.3)",
    shadowColor: "#ff00ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  controlButtonDisabled: {
    opacity: 0.3,
  },
  skipButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  playButton: {
    // No margin needed - handled by space-between
  },
  playButtonDisabled: {
    opacity: 0.5,
  },
  playButtonOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    shadowColor: "#ff00ff",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  playButtonOuterDisabled: {
    shadowOpacity: 0,
  },
  playButtonGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    padding: 2,
  },
  playButtonInner: {
    flex: 1,
    borderRadius: 38,
    overflow: 'hidden',
  },
  playButtonInnerGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#2a2882',
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 20,
    borderLeftColor: "#ffffff",
    borderTopWidth: 12,
    borderTopColor: "transparent",
    borderBottomWidth: 12,
    borderBottomColor: "transparent",
    marginLeft: 4,
  },
  pauseIcon: {
    flexDirection: "row",
    gap: 8,
  },
  pauseBar: {
    width: 6,
    height: 24,
    backgroundColor: "#ffffff",
    borderRadius: 3,
  },
  // Shuffle Icon
  shuffleIcon: {
    width: 24,
    height: 24,
    position: 'relative',
  },
  shuffleLine1: {
    position: 'absolute',
    width: 20,
    height: 2,
    backgroundColor: '#ffffff',
    top: 8,
    left: 2,
  },
  shuffleLine2: {
    position: 'absolute',
    width: 20,
    height: 2,
    backgroundColor: '#ffffff',
    bottom: 8,
    left: 2,
  },
  shuffleArrow1: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderLeftColor: '#ffffff',
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
    borderRightColor: '#ffffff',
    borderTopWidth: 3,
    borderTopColor: 'transparent',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    bottom: 5,
    left: 2,
  },
  iconActive: {
    transform: [{ scale: 1.1 }],
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
    marginRight: 2,
  },
  nextIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 2,
  },
  skipBar: {
    width: 3,
    height: 20,
    backgroundColor: '#ffffff',
    borderRadius: 1.5,
  },
  skipBarDisabled: {
    backgroundColor: '#555',
  },
  skipTriangle: {
    width: 0,
    height: 0,
  },
  skipTriangleLeft: {
    borderRightWidth: 12,
    borderRightColor: '#ffffff',
    borderTopWidth: 10,
    borderTopColor: 'transparent',
    borderBottomWidth: 10,
    borderBottomColor: 'transparent',
    marginRight: -2,
  },
  skipTriangleLeft2: {
    borderRightWidth: 12,
    borderRightColor: '#ffffff',
    borderTopWidth: 10,
    borderTopColor: 'transparent',
    borderBottomWidth: 10,
    borderBottomColor: 'transparent',
    marginRight: 3,
  },
  skipTriangleRight: {
    borderLeftWidth: 12,
    borderLeftColor: '#ffffff',
    borderTopWidth: 10,
    borderTopColor: 'transparent',
    borderBottomWidth: 10,
    borderBottomColor: 'transparent',
    marginLeft: -2,
  },
  skipTriangleRight2: {
    borderLeftWidth: 12,
    borderLeftColor: '#ffffff',
    borderTopWidth: 10,
    borderTopColor: 'transparent',
    borderBottomWidth: 10,
    borderBottomColor: 'transparent',
    marginLeft: 3,
  },
  skipTriangleDisabled: {
    borderLeftColor: '#555',
    borderRightColor: '#555',
  },
  // Repeat Icon
  repeatIcon: {
    width: 24,
    height: 24,
    position: 'relative',
  },
  repeatCircle: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRightColor: 'transparent',
    top: 2,
    left: 2,
    transform: [{ rotate: '45deg' }],
  },
  repeatCircleActive: {
    borderColor: '#ff00ff',
    borderRightColor: 'transparent',
  },
  repeatArrow: {
    position: 'absolute',
    width: 2,
    height: 8,
    backgroundColor: '#ffffff',
    top: 0,
    right: 4,
    transform: [{ rotate: '45deg' }],
  },
  repeatArrowActive: {
    backgroundColor: '#ff00ff',
  },
  repeatArrowHead1: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderLeftColor: '#ffffff',
    borderTopWidth: 3,
    borderTopColor: 'transparent',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    top: 0,
    right: 2,
  },
  repeatArrowHead2: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderLeftColor: '#ffffff',
    borderTopWidth: 3,
    borderTopColor: 'transparent',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    top: 3,
    right: 2,
  },
  repeatArrowHeadActive: {
    borderLeftColor: '#ff00ff',
  },
});

export default Player;