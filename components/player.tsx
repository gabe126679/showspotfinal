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
  Animated
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';

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
}

interface Playlist {
  id: string;
  playlist_name: string;
  spotter_id: string;
  created_at: string;
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

const PlaylistModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  song: Song;
}> = ({ visible, onClose, song }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchPlaylists();
    }
  }, [visible]);

  const fetchPlaylists = async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from('playlists')
        .select('*')
        .eq('spotter_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlaylists(data || []);
    } catch (error) {
      console.error('Error fetching playlists:', error);
    }
  };

  const addToPlaylist = async (playlistId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('playlist_songs')
        .insert({
          playlist_id: playlistId,
          song_id: song.song_id,
          added_at: new Date().toISOString(),
        });

      if (error) throw error;
      
      Alert.alert('Success', 'Song added to playlist!');
      onClose();
    } catch (error) {
      console.error('Error adding to playlist:', error);
      Alert.alert('Error', 'Could not add song to playlist');
    } finally {
      setLoading(false);
    }
  };

  const createNewPlaylist = async () => {
    Alert.prompt(
      'Create New Playlist',
      'Enter playlist name:',
      async (playlistName) => {
        if (!playlistName?.trim()) return;

        try {
          setLoading(true);
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;

          const userId = sessionData.session?.user?.id;
          if (!userId) return;

          const { data, error } = await supabase
            .from('playlists')
            .insert({
              playlist_name: playlistName,
              spotter_id: userId,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (error) throw error;
          
          await addToPlaylist(data.id);
        } catch (error) {
          console.error('Error creating playlist:', error);
          Alert.alert('Error', 'Could not create playlist');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add to Playlist</Text>
          
          <FlatList
            data={playlists}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.playlistItem}
                onPress={() => addToPlaylist(item.id)}
                disabled={loading}
              >
                <Text style={styles.playlistName}>{item.playlist_name}</Text>
              </TouchableOpacity>
            )}
            style={styles.playlistsList}
          />

          <View style={styles.newPlaylistSection}>
            <Text style={styles.newPlaylistTitle}>Create New Playlist</Text>
            <TouchableOpacity
              style={styles.createPlaylistButton}
              onPress={createNewPlaylist}
              disabled={loading}
            >
              <Text style={styles.createPlaylistText}>+ Create New Playlist</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
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
            onPress={currentSong ? toggleShuffle : undefined}
            disabled={!currentSong}
          >
            <Text style={[
              styles.controlButtonText, 
              isShuffleOn && styles.controlButtonTextActive,
              !currentSong && styles.controlButtonTextDisabled
            ]}>
              🔀
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.controlButton, !currentSong && styles.controlButtonDisabled]} 
            onPress={currentSong ? previousSong : undefined}
            disabled={!currentSong}
          >
            <Text style={[styles.controlButtonText, !currentSong && styles.controlButtonTextDisabled]}>⏮</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.playButton, !currentSong && styles.playButtonDisabled]} 
            onPress={currentSong ? pauseSong : undefined}
            disabled={!currentSong}
          >
            <View style={styles.playButtonShadow}>
              <LinearGradient
                colors={currentSong ? ["#ff00ff", "#2a2882"] : ["#ccc", "#999"]}
                style={styles.playButtonGradient}
              >
                <View style={styles.playButtonIcon}>
                  {currentSong && isPlaying ? (
                    <View style={styles.pauseIcon}>
                      <View style={styles.pauseBar} />
                      <View style={styles.pauseBar} />
                    </View>
                  ) : (
                    <View style={styles.playIcon} />
                  )}
                </View>
              </LinearGradient>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.controlButton, !currentSong && styles.controlButtonDisabled]} 
            onPress={currentSong ? nextSong : undefined}
            disabled={!currentSong}
          >
            <Text style={[styles.controlButtonText, !currentSong && styles.controlButtonTextDisabled]}>⏭</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton, 
              isRepeatOn && styles.controlButtonActive,
              !currentSong && styles.controlButtonDisabled
            ]}
            onPress={currentSong ? toggleRepeat : undefined}
            disabled={!currentSong}
          >
            <Text style={[
              styles.controlButtonText, 
              isRepeatOn && styles.controlButtonTextActive,
              !currentSong && styles.controlButtonTextDisabled
            ]}>
              🔁
            </Text>
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  controlButtonActive: {
    backgroundColor: "rgba(255, 0, 255, 0.2)",
    shadowColor: "#ff00ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  controlButtonDisabled: {
    opacity: 0.3,
  },
  controlButtonText: {
    fontSize: 20,
    color: "#ffffff",
  },
  controlButtonTextActive: {
    color: "#ff00ff",
  },
  controlButtonTextDisabled: {
    color: "#555",
  },
  playButton: {
    // No margin needed - handled by space-between
  },
  playButtonDisabled: {
    opacity: 0.5,
  },
  playButtonShadow: {
    shadowColor: "#ff00ff",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 15,
  },
  playButtonGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
  },
  playButtonIcon: {
    justifyContent: "center",
    alignItems: "center",
  },
  playIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 16,
    borderLeftColor: "#ffffff",
    borderTopWidth: 10,
    borderTopColor: "transparent",
    borderBottomWidth: 10,
    borderBottomColor: "transparent",
    marginLeft: 3,
  },
  pauseIcon: {
    flexDirection: "row",
    gap: 6,
  },
  pauseBar: {
    width: 5,
    height: 20,
    backgroundColor: "#ffffff",
    borderRadius: 2.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1a1a1f",
    borderRadius: 25,
    padding: 25,
    width: SCREEN_WIDTH * 0.9,
    maxHeight: "70%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 25,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 25,
    letterSpacing: 0.5,
  },
  playlistsList: {
    maxHeight: 200,
    marginBottom: 25,
  },
  playlistItem: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  playlistName: {
    fontSize: 17,
    color: "#ffffff",
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  newPlaylistSection: {
    marginBottom: 25,
  },
  newPlaylistTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 15,
    letterSpacing: 0.3,
  },
  createPlaylistButton: {
    backgroundColor: "rgba(255, 0, 255, 0.9)",
    padding: 18,
    borderRadius: 15,
    alignItems: "center",
    shadowColor: "#ff00ff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createPlaylistText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  closeButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 18,
    borderRadius: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  closeButtonText: {
    color: "#888",
    fontSize: 17,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
});

export default Player;