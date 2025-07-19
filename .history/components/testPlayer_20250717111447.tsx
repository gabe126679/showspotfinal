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
import HomeIcon from "../assets/home-icon.svg";
import SearchIcon from "../assets/search-icon.svg";
import PlayerIcon from "../assets/player-icon.svg";
import CreateIcon from "../assets/create-icon.svg";
import ProfileIcon from "../assets/profile-icon.svg";

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

      // For private songs bucket, we need a signed URL
      const { data, error } = await supabase.storage
        .from('songs')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) {
        console.error('Error creating signed URL:', error);
        throw error;
      }

      if (!data?.signedUrl) {
        throw new Error('No signed URL returned');
      }

      console.log('Generated signed URL:', data.signedUrl);
      
      // Test the URL before returning
      await testAudioUrl(data.signedUrl);
      
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting audio URL:', error);
      throw error;
    }
  };

  // Helper function to test audio URL
  const testAudioUrl = async (url: string): Promise<void> => {
    try {
      console.log('Testing audio URL:', url);
      
      const response = await fetch(url, { 
        method: 'HEAD',
        headers: {
          'Accept': 'audio/*',
        }
      });
      
      console.log('URL test response:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.startsWith('audio/')) {
        console.warn('Warning: Content-Type is not audio/*:', contentType);
      }

    } catch (error) {
      console.error('Audio URL test failed:', error);
      throw new Error(`Audio file is not accessible: ${error.message}`);
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
      console.log('=== PLAYING SONG ===');
      console.log('Song:', song.song_title);
      console.log('File path:', song.song_file);
      
      // Stop current song if playing
      if (sound) {
        console.log('Stopping current song...');
        await sound.unloadAsync();
        setSound(null);
      }

      // Set audio mode with basic settings
      console.log('Setting audio mode...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Get the proper audio URL
      console.log('Getting audio URL...');
      const audioUrl = await getAudioUrl(song.song_file);
      console.log('Final audio URL:', audioUrl);

      // Create new sound object with more conservative settings
      console.log('Creating sound object...');
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { 
          shouldPlay: false, // Don't auto-play initially
          isLooping: false, // Start with no looping
          volume: 0.5, // Start with lower volume
          rate: 1.0,
          shouldCorrectPitch: true,
          progressUpdateIntervalMillis: 1000,
          positionMillis: 0,
        },
        (status) => {
          console.log('Playback status update:', status);
          playbackStatusRef.current = status;
          
          if (status.isLoaded) {
            setProgress(status.positionMillis || 0);
            setDuration(status.durationMillis || 0);
            setIsPlaying(status.isPlaying || false);
            
            // Handle song completion
            if (status.didJustFinish && !isRepeatOn) {
              console.log('Song finished, playing next...');
              nextSong();
            }
          } else if (status.error) {
            console.error('Audio loading error:', status.error);
            Alert.alert('Playback Error', `Audio loading failed: ${status.error}`);
          }
        }
      );

      console.log('Sound object created, checking status...');
      const initialStatus = await newSound.getStatusAsync();
      console.log('Initial sound status:', initialStatus);

      if (initialStatus.isLoaded) {
        console.log('Sound loaded successfully, starting playback...');
        await newSound.playAsync();
        setSound(newSound);
        setCurrentSong(song);
        setIsPlaying(true);
        
        // Set up playlist queue
        if (playlist.length > 0) {
          setPlaylistQueue(playlist);
          setCurrentIndex(playlist.findIndex(s => s.song_id === song.song_id));
        }
        
        console.log('Song started playing successfully');
      } else {
        console.error('Sound failed to load:', initialStatus);
        throw new Error('Sound failed to load');
      }

    } catch (error) {
      console.error('=== ERROR PLAYING SONG ===');
      console.error('Error details:', error);
      console.error('Song file:', song.song_file);
      
      // More specific error messages
      if (error.message?.includes('HTTP')) {
        Alert.alert('Network Error', 'Could not access the audio file. Please check your internet connection.');
      } else if (error.message?.includes('signed URL')) {
        Alert.alert('Access Error', 'Could not get access to the audio file. Please try again.');
      } else {
        Alert.alert('Playback Error', `Could not play this song: ${error.message}`);
      }
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
          const { data, error } = await supabase
            .from('artists')
            .select('artistName')
            .eq('artist_id', currentSong.artist_id)
            .single();

          if (error) throw error;
          setArtistName(data?.artistName || 'Unknown Artist');
        } catch (error) {
          console.error('Error fetching artist name:', error);
          setArtistName('Unknown Artist');
        }
      }
    };

    fetchArtistName();
  }, [currentSong?.artist_id]);

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

  if (!currentSong) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>No Song Playing</Text>
          <Text style={styles.subtitle}>Select a song from an artist profile to start playing</Text>
        </View>
        <View style={styles.footer}>
          <TouchableOpacity onPress={() => navigation.navigate("MapHome" as never)}>
            <HomeIcon width={60} height={60} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Search" as never)}>
            <SearchIcon width={60} height={60} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Create" as never)}>
            <CreateIcon width={60} height={60} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Player" as never)}>
            <PlayerIcon width={60} height={60} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Profile" as never)}>
            <ProfileIcon width={60} height={60} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.playerContent}>
        <View style={styles.playerHeader}>
          <View style={styles.headerSpacer} />
          <TouchableOpacity 
            style={styles.moreButton}
            onPress={openPlaylistModal}
          >
            <Text style={styles.moreButtonText}>⋯</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.albumArtContainer}>
          <Image
            source={{ uri: getImageUrl(currentSong.song_image) }}
            style={styles.albumArt}
            resizeMode="cover"
            defaultSource={require('../assets/default-song-image.png')} // Add a default image
          />
        </View>

        <View style={styles.songInfo}>
          <Text style={styles.songTitle}>{currentSong.song_title}</Text>
          <Text style={styles.artistName}>{artistName}</Text>
        </View>

        <View style={styles.progressContainer}>
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
          </View>
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{formatTime(progress)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>

        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[styles.controlButton, isShuffleOn && styles.controlButtonActive]}
            onPress={toggleShuffle}
          >
            <Text style={[styles.controlButtonText, isShuffleOn && styles.controlButtonTextActive]}>
              🔀
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={previousSong}>
            <Text style={styles.controlButtonText}>⏮</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.playButton} onPress={pauseSong}>
            <LinearGradient
              colors={["#ff00ff", "#2a2882"]}
              style={styles.playButtonGradient}
            >
              <Text style={styles.playButtonText}>
                {isPlaying ? "⏸" : "▶️"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={nextSong}>
            <Text style={styles.controlButtonText}>⏭</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, isRepeatOn && styles.controlButtonActive]}
            onPress={toggleRepeat}
          >
            <Text style={[styles.controlButtonText, isRepeatOn && styles.controlButtonTextActive]}>
              🔁
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => navigation.navigate("MapHome" as never)}>
          <HomeIcon width={60} height={60} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("Search" as never)}>
          <SearchIcon width={60} height={60} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("Create" as never)}>
          <CreateIcon width={60} height={60} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("Player" as never)}>
          <PlayerIcon width={60} height={60} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("Profile" as never)}>
          <ProfileIcon width={60} height={60} />
        </TouchableOpacity>
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
    backgroundColor: "#fff" 
  },
  content: { 
    alignItems: "center", 
    marginTop: 100 
  },
  title: { 
    fontSize: 32, 
    fontWeight: "bold", 
    color: "#2a2882" 
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 10,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#ccc",
    paddingVertical: 10,
  },
  playerContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  playerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerSpacer: {
    flex: 1,
  },
  moreButton: {
    padding: 10,
  },
  moreButtonText: {
    fontSize: 24,
    color: "#2a2882",
    fontWeight: "bold",
  },
  albumArtContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  albumArt: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
  },
  songInfo: {
    alignItems: "center",
    marginBottom: 30,
  },
  songTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2a2882",
    textAlign: "center",
    marginBottom: 5,
  },
  artistName: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
  },
  progressContainer: {
    marginBottom: 30,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#e0e0e0",
    borderRadius: 2,
    marginBottom: 10,
  },
  progressFill: {
    height: 4,
    backgroundColor: "#ff00ff",
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    fontSize: 12,
    color: "#666",
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: 20,
  },
  controlButton: {
    padding: 10,
  },
  controlButtonActive: {
    backgroundColor: "#ff00ff20",
    borderRadius: 25,
  },
  controlButtonText: {
    fontSize: 20,
    color: "#666",
  },
  controlButtonTextActive: {
    color: "#ff00ff",
  },
  playButton: {
    marginHorizontal: 10,
  },
  playButtonGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
  },
  playButtonText: {
    fontSize: 24,
    color: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    width: SCREEN_WIDTH * 0.9,
    maxHeight: "70%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2a2882",
    textAlign: "center",
    marginBottom: 20,
  },
  playlistsList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  playlistItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  playlistName: {
    fontSize: 16,
    color: "#333",
  },
  newPlaylistSection: {
    marginBottom: 20,
  },
  newPlaylistTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2a2882",
    marginBottom: 10,
  },
  createPlaylistButton: {
    backgroundColor: "#ff00ff",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  createPlaylistText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  closeButton: {
    backgroundColor: "#f0f0f0",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#666",
    fontSize: 16,
  },
});

export default Player;

