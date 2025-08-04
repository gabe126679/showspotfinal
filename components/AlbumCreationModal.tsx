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
} from 'react-native';
import { supabase } from '../lib/supabase';
import { albumService, AlbumSongData } from '../services/albumService';

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

interface AlbumCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onAlbumCreated: () => void;
  artistData: any;
  albumType: 'artist' | 'band';
  songs: Song[];
}

const AlbumCreationModal: React.FC<AlbumCreationModalProps> = ({
  visible,
  onClose,
  onAlbumCreated,
  artistData,
  albumType,
  songs,
}) => {
  const [albumName, setAlbumName] = useState('');
  const [albumPrice, setAlbumPrice] = useState('0');
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);

  // Filter songs based on search query
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = songs.filter(song => 
        song.song_title.toLowerCase().includes(searchQuery.toLowerCase())
      ).sort((a, b) => a.song_title.localeCompare(b.song_title));
      setFilteredSongs(filtered);
    } else {
      setFilteredSongs(songs.sort((a, b) => a.song_title.localeCompare(b.song_title)));
    }
  }, [searchQuery, songs]);

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

  const convertSongToAlbumData = async (song: Song): Promise<AlbumSongData> => {
    let artistName = '';
    let bandName = '';

    if (song.song_type === 'band' && song.band_id) {
      try {
        const { data } = await supabase
          .from('bands')
          .select('band_name')
          .eq('band_id', song.band_id)
          .single();
        bandName = data?.band_name || '';
      } catch (error) {
        console.error('Error fetching band name:', error);
      }
    } else {
      try {
        const { data } = await supabase
          .from('artists')
          .select('artist_name')
          .eq('artist_id', song.artist_id)
          .single();
        artistName = data?.artist_name || '';
      } catch (error) {
        console.error('Error fetching artist name:', error);
      }
    }

    return {
      song_id: song.song_id,
      song_title: song.song_title,
      song_file: song.song_file,
      song_image: song.song_image,
      song_type: song.song_type as 'artist' | 'band',
      song_artist: song.song_type === 'artist' ? song.artist_id : undefined,
      song_band: song.song_type === 'band' ? song.band_id : undefined,
      artist_name: artistName || undefined,
      band_name: bandName || undefined,
    };
  };

  const toggleSongSelection = (songId: string) => {
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(songId)) {
      newSelected.delete(songId);
    } else {
      newSelected.add(songId);
    }
    setSelectedSongs(newSelected);
  };

  const handleCreateAlbum = async () => {
    if (!albumName.trim()) {
      Alert.alert('Error', 'Please enter an album name');
      return;
    }

    if (selectedSongs.size === 0) {
      Alert.alert('Error', 'Please select at least one song');
      return;
    }

    // Validate album price
    const price = parseFloat(albumPrice);
    if (isNaN(price) || price < 0) {
      Alert.alert('Error', 'Please enter a valid price (0 or higher)');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Get the first selected song for the album
      const firstSongId = Array.from(selectedSongs)[0];
      const firstSong = songs.find(song => song.song_id === firstSongId);
      const firstSongData = firstSong ? await convertSongToAlbumData(firstSong) : undefined;

      // Create the album with the first song
      const result = await albumService.createAlbum({
        albumTitle: albumName.trim(),
        albumPrice: albumPrice,
        albumType: albumType,
        artistId: albumType === 'artist' ? artistData.artist_id : artistData.band_id,
        bandId: albumType === 'band' ? artistData.band_id : undefined,
        firstSong: firstSongData,
      });

      if (!result.success || !result.data) {
        Alert.alert('Error', result.error || 'Failed to create album');
        return;
      }

      const albumId = result.data.album_id;

      // Add remaining songs to the album
      const remainingSongs = Array.from(selectedSongs).slice(1);
      for (const songId of remainingSongs) {
        const song = songs.find(s => s.song_id === songId);
        if (song) {
          const songData = await convertSongToAlbumData(song);
          await albumService.addSongToAlbum(albumId, songData);
        }
      }

      const successMessage = albumType === 'band' 
        ? `Album "${albumName}" created and sent for band approval!`
        : `Album "${albumName}" created with ${selectedSongs.size} song${selectedSongs.size !== 1 ? 's' : ''}!`;

      Alert.alert(
        'Success!',
        successMessage,
        [
          {
            text: 'OK',
            onPress: () => {
              onAlbumCreated();
              onClose();
              // Reset form
              setAlbumName('');
              setAlbumPrice('0');
              setSelectedSongs(new Set());
              setSearchQuery('');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error creating album:', error);
      Alert.alert('Error', 'Something went wrong while creating the album');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAlbumName('');
    setAlbumPrice('0');
    setSelectedSongs(new Set());
    setSearchQuery('');
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
        <Text style={styles.modalTitle}>Create New Album</Text>
        
        {/* Album Name Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Album Name</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter album name..."
            placeholderTextColor="#999"
            value={albumName}
            onChangeText={setAlbumName}
            maxLength={50}
          />
        </View>

        {/* Album Price Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Album Price ($)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="0"
            placeholderTextColor="#999"
            value={albumPrice}
            onChangeText={setAlbumPrice}
            keyboardType="decimal-pad"
            maxLength={10}
          />
        </View>

        {/* Search Bar */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Search Songs</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Search by song title..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {albumType === 'band' && (
          <View style={styles.bandNotice}>
            <Text style={styles.bandNoticeText}>
              ⚠️ Band albums require approval from all band members before becoming active.
            </Text>
          </View>
        )}
        
        {/* Debug Info */}
        <View style={styles.fullScreenDebug}>
          <Text style={styles.fullScreenDebugText}>
            Songs: {filteredSongs.length} • Selected: {selectedSongs.size}
          </Text>
        </View>
        
        {/* Scrollable Songs List */}
        <ScrollView 
          style={styles.fullScreenScrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {filteredSongs.map((song) => (
            <TouchableOpacity
              key={song.song_id}
              style={styles.fullScreenSongItem}
              onPress={() => toggleSongSelection(song.song_id)}
            >
              <Image
                source={{ uri: getImageUrl(song.song_image) }}
                style={styles.fullScreenSongImage}
              />
              <View style={styles.songInfoSection}>
                <Text style={styles.fullScreenSongTitle}>{song.song_title}</Text>
                <Text style={styles.fullScreenSongArtist}>
                  ${song.song_price} • {song.song_type === 'band' ? 'Band Song' : 'Artist Song'}
                </Text>
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
          {filteredSongs.length === 0 && (
            <View style={styles.fullScreenEmpty}>
              <Text style={styles.fullScreenEmptyText}>
                {searchQuery ? `No songs match "${searchQuery}"` : 'No songs available'}
              </Text>
            </View>
          )}
        </ScrollView>
        
        {/* Action Buttons */}
        <View style={styles.fullScreenButtons}>
          <TouchableOpacity
            style={[
              styles.fullScreenCreateButton,
              (selectedSongs.size === 0 || !albumName.trim()) && styles.fullScreenCreateButtonDisabled
            ]}
            onPress={handleCreateAlbum}
            disabled={selectedSongs.size === 0 || !albumName.trim() || loading}
          >
            <Text style={styles.fullScreenCreateButtonText}>
              {loading ? 'Creating...' : `Create Album with ${selectedSongs.size} songs`}
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
  bandNotice: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.5)',
  },
  bandNoticeText: {
    color: '#ffc107',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
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
});

export default AlbumCreationModal;