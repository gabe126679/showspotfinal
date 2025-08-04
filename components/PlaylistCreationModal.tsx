import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { playlistService, PlaylistSongData } from '../services/playlistService';
import { SongPurchase } from '../services/songPurchaseService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PlaylistCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onPlaylistCreated: () => void;
  initialSong?: PlaylistSongData | null;
  purchasedSongs: SongPurchase[];
}

const PlaylistCreationModal: React.FC<PlaylistCreationModalProps> = ({
  visible,
  onClose,
  onPlaylistCreated,
  initialSong,
  purchasedSongs,
}) => {
  const [playlistName, setPlaylistName] = useState('');
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('PlaylistCreationModal - purchasedSongs:', purchasedSongs?.length || 0);
    console.log('PlaylistCreationModal - visible:', visible);
    if (purchasedSongs?.length > 0) {
      console.log('First few songs:', purchasedSongs.slice(0, 3));
    }
  }, [purchasedSongs, visible]);


  // Initialize with the initial song if provided
  useEffect(() => {
    if (initialSong) {
      setSelectedSongs(new Set([initialSong.song_id]));
    }
  }, [initialSong]);


  const toggleSongSelection = (songId: string) => {
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(songId)) {
      newSelected.delete(songId);
    } else {
      newSelected.add(songId);
    }
    setSelectedSongs(newSelected);
  };

  const getImageUrl = (imagePath: string): string => {
    if (!imagePath) return 'https://via.placeholder.com/50';
    
    if (imagePath.startsWith('http')) {
      return imagePath;
    }

    const { data } = supabase.storage
      .from('song-images')
      .getPublicUrl(imagePath);

    return data.publicUrl;
  };

  const convertPurchaseToSongData = (purchase: SongPurchase): PlaylistSongData => ({
    song_id: purchase.song_id,
    song_title: purchase.song_title,
    song_file: purchase.song_file,
    song_image: purchase.song_image,
    song_type: purchase.song_type,
    song_artist: purchase.song_type === 'artist' ? purchase.song_artist : undefined,
    song_band: purchase.song_type === 'band' ? purchase.song_artist : undefined,
    artist_name: purchase.artist_name,
    band_name: purchase.band_name,
  });

  const handleCreatePlaylist = async () => {
    if (!playlistName.trim()) {
      Alert.alert('Error', 'Please enter a playlist name');
      return;
    }

    if (selectedSongs.size === 0) {
      Alert.alert('Error', 'Please select at least one song');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Get the first selected song for the playlist image
      const firstSongId = Array.from(selectedSongs)[0];
      const firstSong = purchasedSongs.find(song => song.song_id === firstSongId);
      const firstSongData = firstSong ? convertPurchaseToSongData(firstSong) : undefined;

      // Create the playlist with the first song
      const result = await playlistService.createPlaylist({
        spotterId: user.id,
        playlistName: playlistName.trim(),
        firstSong: firstSongData,
      });

      if (!result.success || !result.data) {
        Alert.alert('Error', result.error || 'Failed to create playlist');
        return;
      }

      const playlistId = result.data.playlist_id;

      // Add remaining songs to the playlist
      const remainingSongs = Array.from(selectedSongs).slice(1);
      for (const songId of remainingSongs) {
        const song = purchasedSongs.find(s => s.song_id === songId);
        if (song) {
          const songData = convertPurchaseToSongData(song);
          await playlistService.addSongToPlaylist(playlistId, songData);
        }
      }

      Alert.alert(
        'Success!',
        `Playlist "${playlistName}" created with ${selectedSongs.size} song${selectedSongs.size !== 1 ? 's' : ''}`,
        [
          {
            text: 'OK',
            onPress: () => {
              onPlaylistCreated();
              onClose();
              // Reset form
              setPlaylistName('');
              setSelectedSongs(new Set());
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error creating playlist:', error);
      Alert.alert('Error', 'Something went wrong while creating the playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPlaylistName('');
    setSelectedSongs(new Set());
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.fullScreenContainer}>
            <Text style={styles.modalTitle}>Create New Playlist</Text>
            
            {/* Playlist Name Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Playlist Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter playlist name..."
                placeholderTextColor="#999"
                value={playlistName}
                onChangeText={setPlaylistName}
                maxLength={50}
              />
            </View>


            {/* FULL SCREEN SONGS LIST */}
            <Text style={styles.fullScreenTitle}>Create New Playlist</Text>
            
            {/* Debug Info */}
            <View style={styles.fullScreenDebug}>
              <Text style={styles.fullScreenDebugText}>Songs: {purchasedSongs?.length || 0}</Text>
            </View>
            
            {/* Scrollable Songs List */}
            <ScrollView 
              style={styles.fullScreenScrollView}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Songs list with images */}
              {purchasedSongs?.map((song) => (
                <TouchableOpacity
                  key={song.song_id}
                  style={styles.fullScreenSongItem}
                  onPress={() => {
                    toggleSongSelection(song.song_id);
                  }}
                >
                  <Image
                    source={{ uri: getImageUrl(song.song_image) }}
                    style={styles.fullScreenSongImage}
                  />
                  <View style={styles.songInfoSection}>
                    <Text style={styles.fullScreenSongTitle}>{song.song_title}</Text>
                    <Text style={styles.fullScreenSongArtist}>{song.band_name || song.artist_name || 'Unknown'}</Text>
                  </View>
                  <View style={[
                    styles.fullScreenAddButton,
                    selectedSongs.has(song.song_id) && styles.fullScreenAddButtonSelected
                  ]}>
                    <Text style={styles.fullScreenAddButtonText}>
                      {selectedSongs.has(song.song_id) ? '✓' : '+'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              
              {/* Fallback */}
              {(!purchasedSongs || purchasedSongs.length === 0) && (
                <View style={styles.fullScreenEmpty}>
                  <Text style={styles.fullScreenEmptyText}>No purchased songs</Text>
                </View>
              )}
            </ScrollView>
            
            {/* Action Buttons */}
            <View style={styles.fullScreenButtons}>
              <TouchableOpacity
                style={[
                  styles.fullScreenCreateButton,
                  selectedSongs.size === 0 && styles.fullScreenCreateButtonDisabled
                ]}
                onPress={handleCreatePlaylist}
                disabled={selectedSongs.size === 0 || loading}
              >
                <Text style={styles.fullScreenCreateButtonText}>
                  {loading ? 'Creating...' : `Create with ${selectedSongs.size} songs`}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.fullScreenCancelButton}
                onPress={handleClose}
              >
                <Text style={styles.fullScreenCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>

      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  fullScreenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  fullScreenDebug: {
    backgroundColor: '#ffff00',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  fullScreenDebugText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  fullScreenScrollView: {
    flex: 1,
    marginBottom: 20,
  },
  scrollContent: {
    paddingVertical: 10,
  },
  fullScreenSongItem: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1f',
    padding: 20,
    marginBottom: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  songInfoSection: {
    flex: 1,
  },
  fullScreenSongTitle: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  fullScreenSongArtist: {
    fontSize: 14,
    color: '#888',
  },
  fullScreenAddButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#00ff00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenAddButtonSelected: {
    backgroundColor: '#ff00ff',
  },
  fullScreenAddButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  fullScreenEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  fullScreenEmptyText: {
    fontSize: 18,
    color: '#888',
    textAlign: 'center',
  },
  fullScreenButtons: {
    paddingBottom: 40,
  },
  fullScreenCreateButton: {
    backgroundColor: '#00ff00',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
  },
  fullScreenCreateButtonDisabled: {
    backgroundColor: '#333',
  },
  fullScreenCreateButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  fullScreenCancelButton: {
    backgroundColor: '#333',
    padding: 20,
    borderRadius: 12,
  },
  fullScreenCancelButtonText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
  },
  fullScreenSongImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
    backgroundColor: '#333',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  songsContainer: {
    flex: 1,
    maxHeight: 300,
  },
  songsLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
    fontWeight: '600',
  },
  songsList: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 5,
  },
  songItemSelected: {
    backgroundColor: 'rgba(0, 255, 0, 0.2)',
  },
  songImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 12,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  songArtist: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBoxSelected: {
    backgroundColor: '#00ff00',
    borderColor: '#00ff00',
  },
  checkMark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 255, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00ff00',
  },
  addButtonSelected: {
    backgroundColor: '#00ff00',
    borderColor: '#00ff00',
  },
  addButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00ff00',
  },
  addButtonTextSelected: {
    color: '#000',
  },
  emptyStateContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noSongsSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 5,
    textAlign: 'center',
  },
  simpleSongItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#00ff00',
  },
  simpleSongTitle: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  simpleSongArtist: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 10,
  },
  simpleAddButton: {
    backgroundColor: '#00ff00',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  simpleAddButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  debugContainer: {
    backgroundColor: 'rgba(255, 255, 0, 0.8)',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#ffff00',
  },
  debugText: {
    color: '#000',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  noSongsText: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  buttonContainer: {
    marginTop: 20,
    gap: 12,
  },
  createButton: {
    backgroundColor: '#00ff00',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#fff',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});

export default PlaylistCreationModal;