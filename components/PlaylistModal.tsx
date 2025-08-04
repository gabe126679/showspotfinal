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
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { playlistService, PlaylistSongData } from '../services/playlistService';
import { songPurchaseService, SongPurchase } from '../services/songPurchaseService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

interface PlaylistOption {
  playlist_id: string;
  playlist_name: string;
  spotter_id: string;
  created_at: string;
}

interface PlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  song: Song;
}

const PlaylistModal: React.FC<PlaylistModalProps> = ({ visible, onClose, song }) => {
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [purchasedSongs, setPurchasedSongs] = useState<SongPurchase[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<SongPurchase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  useEffect(() => {
    if (visible) {
      fetchPlaylists();
      fetchPurchasedSongs();
      // Initialize with current song selected
      setSelectedSongs(new Set([song.song_id]));
    }
  }, [visible, song.song_id]);

  useEffect(() => {
    // Filter songs based on search query
    if (searchQuery.trim()) {
      const filtered = purchasedSongs.filter(purchasedSong => 
        purchasedSong.song_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (purchasedSong.artist_name && purchasedSong.artist_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (purchasedSong.band_name && purchasedSong.band_name.toLowerCase().includes(searchQuery.toLowerCase()))
      ).sort((a, b) => a.song_title.localeCompare(b.song_title));
      setFilteredSongs(filtered);
    } else {
      // Show all songs when no search query
      setFilteredSongs(purchasedSongs.sort((a, b) => a.song_title.localeCompare(b.song_title)));
    }
  }, [searchQuery, purchasedSongs]);

  const fetchPlaylists = async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user?.id;
      if (!userId) return;

      const result = await playlistService.getUserPlaylists(userId);
      if (result.success && result.data) {
        setPlaylists(result.data);
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
    }
  };

  const fetchPurchasedSongs = async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user?.id;
      if (!userId) return;

      console.log('Fetching purchased songs for user:', userId);
      const result = await songPurchaseService.getUserPurchasedSongs(userId);
      console.log('Purchased songs result:', result);
      
      if (result.success && result.songs) {
        setPurchasedSongs(result.songs);
        // Also set filtered songs initially
        setFilteredSongs(result.songs.sort((a, b) => a.song_title.localeCompare(b.song_title)));
      }
    } catch (error) {
      console.error('Error fetching purchased songs:', error);
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

  const convertSongToPlaylistData = async (song: Song): Promise<PlaylistSongData> => {
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

  const convertPurchaseToPlaylistData = (purchase: SongPurchase): PlaylistSongData => ({
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

  const toggleSongSelection = (songId: string) => {
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(songId)) {
      newSelected.delete(songId);
    } else {
      newSelected.add(songId);
    }
    setSelectedSongs(newSelected);
  };

  const addSelectedSongsToPlaylist = async (playlistId: string) => {
    try {
      setLoading(true);
      
      for (const songId of selectedSongs) {
        // Check if it's the current playing song or a purchased song
        if (songId === song.song_id) {
          const songData = await convertSongToPlaylistData(song);
          await playlistService.addSongToPlaylist(playlistId, songData);
        } else {
          const purchasedSong = purchasedSongs.find(s => s.song_id === songId);
          if (purchasedSong) {
            const songData = convertPurchaseToPlaylistData(purchasedSong);
            await playlistService.addSongToPlaylist(playlistId, songData);
          }
        }
      }
      
      Alert.alert('Success', `${selectedSongs.size} song${selectedSongs.size !== 1 ? 's' : ''} added to playlist!`);
      setSelectedSongs(new Set([song.song_id])); // Reset to just current song
      onClose();
    } catch (error) {
      console.error('Error adding songs to playlist:', error);
      Alert.alert('Error', 'Could not add songs to playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      Alert.alert('Error', 'Please enter a playlist name');
      return;
    }

    if (selectedSongs.size === 0) {
      Alert.alert('Error', 'Please select at least one song');
      return;
    }

    try {
      setLoading(true);
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const userId = sessionData.session?.user?.id;
      if (!userId) return;

      // Get first selected song for playlist creation
      const firstSongId = Array.from(selectedSongs)[0];
      let firstSongData: PlaylistSongData;
      
      if (firstSongId === song.song_id) {
        firstSongData = await convertSongToPlaylistData(song);
      } else {
        const purchasedSong = purchasedSongs.find(s => s.song_id === firstSongId);
        if (!purchasedSong) return;
        firstSongData = convertPurchaseToPlaylistData(purchasedSong);
      }

      const result = await playlistService.createPlaylist({
        spotterId: userId,
        playlistName: newPlaylistName.trim(),
        firstSong: firstSongData,
      });

      if (!result.success || !result.data) {
        Alert.alert('Error', result.error || 'Could not create playlist');
        return;
      }

      // Add remaining selected songs
      const remainingSongIds = Array.from(selectedSongs).slice(1);
      for (const songId of remainingSongIds) {
        if (songId === song.song_id) {
          const songData = await convertSongToPlaylistData(song);
          await playlistService.addSongToPlaylist(result.data.playlist_id, songData);
        } else {
          const purchasedSong = purchasedSongs.find(s => s.song_id === songId);
          if (purchasedSong) {
            const songData = convertPurchaseToPlaylistData(purchasedSong);
            await playlistService.addSongToPlaylist(result.data.playlist_id, songData);
          }
        }
      }

      Alert.alert('Success', `Playlist "${newPlaylistName}" created with ${selectedSongs.size} song${selectedSongs.size !== 1 ? 's' : ''}!`);
      setNewPlaylistName('');
      setSelectedSongs(new Set([song.song_id]));
      setShowCreatePlaylist(false);
      onClose();
    } catch (error) {
      console.error('Error creating playlist:', error);
      Alert.alert('Error', 'Could not create playlist');
    } finally {
      setLoading(false);
    }
  };

  if (showCreatePlaylist) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.createPlaylistModalContent}>
            <Text style={styles.modalTitle}>Create New Playlist</Text>
            
            <TextInput
              style={styles.playlistNameInput}
              placeholder="Enter playlist name..."
              placeholderTextColor="#888"
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              maxLength={50}
            />

            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={100}
            >
              <TextInput
                style={styles.searchInput}
                placeholder="Search your purchased songs..."
                placeholderTextColor="#888"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </KeyboardAvoidingView>

            <Text style={styles.songsHeader}>
              {searchQuery ? 'Search Results' : 'Your Purchased Songs'} ({selectedSongs.size} selected)
            </Text>
            
            <ScrollView style={styles.createPlaylistSongsScrollView} showsVerticalScrollIndicator={false}>
              {/* Current playing song - always show at top */}
              <View style={styles.currentSongSection}>
                <Text style={styles.sectionLabel}>Currently Playing</Text>
                <TouchableOpacity
                  style={[
                    styles.songItem,
                    selectedSongs.has(song.song_id) && styles.songItemSelected
                  ]}
                  onPress={() => toggleSongSelection(song.song_id)}
                >
                  <Image
                    source={{ uri: getImageUrl(song.song_image) }}
                    style={styles.songImage}
                  />
                  <View style={styles.songInfo}>
                    <Text style={styles.songTitle}>{song.song_title}</Text>
                    <Text style={styles.songArtist}>Now Playing</Text>
                  </View>
                  <TouchableOpacity 
                    style={[
                      styles.addButton,
                      selectedSongs.has(song.song_id) && styles.addButtonSelected
                    ]}
                    onPress={() => toggleSongSelection(song.song_id)}
                  >
                    <Text style={[
                      styles.addButtonText,
                      selectedSongs.has(song.song_id) && styles.addButtonTextSelected
                    ]}>
                      {selectedSongs.has(song.song_id) ? '✓' : '+'}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>

              {/* Purchased songs section */}
              {purchasedSongs.length > 0 && (
                <View style={styles.purchasedSongsSection}>
                  <Text style={styles.sectionLabel}>
                    {searchQuery ? `Songs matching "${searchQuery}"` : 'All Purchased Songs'}
                  </Text>
                  {filteredSongs.map((purchasedSong) => (
                    <TouchableOpacity
                      key={purchasedSong.song_id}
                      style={[
                        styles.songItem,
                        selectedSongs.has(purchasedSong.song_id) && styles.songItemSelected
                      ]}
                      onPress={() => toggleSongSelection(purchasedSong.song_id)}
                    >
                      <Image
                        source={{ uri: getImageUrl(purchasedSong.song_image) }}
                        style={styles.songImage}
                      />
                      <View style={styles.songInfo}>
                        <Text style={styles.songTitle}>{purchasedSong.song_title}</Text>
                        <Text style={styles.songArtist}>
                          {purchasedSong.artist_name || purchasedSong.band_name || 'Unknown Artist'}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={[
                          styles.addButton,
                          selectedSongs.has(purchasedSong.song_id) && styles.addButtonSelected
                        ]}
                        onPress={() => toggleSongSelection(purchasedSong.song_id)}
                      >
                        <Text style={[
                          styles.addButtonText,
                          selectedSongs.has(purchasedSong.song_id) && styles.addButtonTextSelected
                        ]}>
                          {selectedSongs.has(purchasedSong.song_id) ? '✓' : '+'}
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {purchasedSongs.length === 0 && (
                <View style={styles.emptyStateContainer}>
                  <Text style={styles.noSongsText}>No purchased songs yet</Text>
                  <Text style={styles.noSongsSubtext}>Purchase songs from artists to add them to playlists</Text>
                </View>
              )}
              
              {purchasedSongs.length > 0 && filteredSongs.length === 0 && searchQuery && (
                <View style={styles.emptyStateContainer}>
                  <Text style={styles.noSongsText}>No songs match "{searchQuery}"</Text>
                  <Text style={styles.noSongsSubtext}>Try a different search term</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.createButton, loading && styles.disabledButton]}
                onPress={handleCreatePlaylist}
                disabled={loading || selectedSongs.size === 0}
              >
                <Text style={styles.createButtonText}>
                  {loading ? 'Creating...' : `Create with ${selectedSongs.size} songs`}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCreatePlaylist(false);
                  setNewPlaylistName('');
                  setSelectedSongs(new Set([song.song_id]));
                  setSearchQuery('');
                }}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView 
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add to Playlist</Text>
          
          {/* Search Bar */}
          <TextInput
            style={styles.searchInput}
            placeholder="Search your purchased songs..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* Current Song Section */}
          <View style={styles.currentSongSection}>
            <Text style={styles.sectionTitle}>Current Song</Text>
            <TouchableOpacity
              style={[
                styles.songItem,
                selectedSongs.has(song.song_id) && styles.songItemSelected
              ]}
              onPress={() => toggleSongSelection(song.song_id)}
            >
              <Image
                source={{ uri: getImageUrl(song.song_image) }}
                style={styles.songImage}
              />
              <View style={styles.songInfo}>
                <Text style={styles.songTitle}>{song.song_title}</Text>
                <Text style={styles.songArtist}>Currently Playing</Text>
              </View>
              <View style={[
                styles.checkBox,
                selectedSongs.has(song.song_id) && styles.checkBoxSelected
              ]}>
                {selectedSongs.has(song.song_id) && (
                  <Text style={styles.checkMark}>✓</Text>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Purchased Songs Section */}
          <View style={styles.purchasedSongsSection}>
            <Text style={styles.sectionTitle}>
              Your Purchased Songs ({purchasedSongs.length > 0 ? `${selectedSongs.size - 1} selected` : '0 available'})
            </Text>
            <ScrollView style={styles.songsScrollView} showsVerticalScrollIndicator={false}>
              {filteredSongs.map((purchasedSong) => (
                <TouchableOpacity
                  key={purchasedSong.song_id}
                  style={[
                    styles.songItem,
                    selectedSongs.has(purchasedSong.song_id) && styles.songItemSelected
                  ]}
                  onPress={() => toggleSongSelection(purchasedSong.song_id)}
                >
                  <Image
                    source={{ uri: getImageUrl(purchasedSong.song_image) }}
                    style={styles.songImage}
                  />
                  <View style={styles.songInfo}>
                    <Text style={styles.songTitle}>{purchasedSong.song_title}</Text>
                    <Text style={styles.songArtist}>
                      {purchasedSong.artist_name || purchasedSong.band_name || 'Unknown Artist'}
                    </Text>
                  </View>
                  <View style={[
                    styles.checkBox,
                    selectedSongs.has(purchasedSong.song_id) && styles.checkBoxSelected
                  ]}>
                    {selectedSongs.has(purchasedSong.song_id) && (
                      <Text style={styles.checkMark}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
              {filteredSongs.length === 0 && searchQuery && (
                <Text style={styles.noSongsText}>No songs match your search</Text>
              )}
              {filteredSongs.length === 0 && !searchQuery && purchasedSongs.length === 0 && (
                <Text style={styles.noSongsText}>No purchased songs yet</Text>
              )}
            </ScrollView>
          </View>
          
          {/* Existing Playlists Section */}
          {playlists.length > 0 && (
            <View style={styles.existingPlaylistsSection}>
              <Text style={styles.sectionTitle}>Add to Existing Playlist</Text>
              <FlatList
                data={playlists}
                keyExtractor={(item) => item.playlist_id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.playlistItem}
                    onPress={() => addSelectedSongsToPlaylist(item.playlist_id)}
                    disabled={loading || selectedSongs.size === 0}
                  >
                    <Text style={[
                      styles.playlistName,
                      (loading || selectedSongs.size === 0) && styles.disabledText
                    ]}>
                      {item.playlist_name}
                    </Text>
                    <Text style={styles.playlistCount}>
                      Add {selectedSongs.size} song{selectedSongs.size !== 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>
                )}
                style={styles.playlistsList}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}

          {/* Create New Playlist Section */}
          <View style={styles.newPlaylistSection}>
            <TouchableOpacity
              style={[
                styles.createPlaylistButton,
                selectedSongs.size === 0 && styles.disabledButton
              ]}
              onPress={() => setShowCreatePlaylist(true)}
              disabled={loading || selectedSongs.size === 0}
            >
              <Text style={[
                styles.createPlaylistText,
                selectedSongs.size === 0 && styles.disabledText
              ]}>
                + Create New Playlist ({selectedSongs.size} song{selectedSongs.size !== 1 ? 's' : ''})
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => {
              onClose();
              setSelectedSongs(new Set([song.song_id]));
              setSearchQuery('');
            }}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1f',
    borderRadius: 25,
    padding: 20,
    width: SCREEN_WIDTH * 0.95,
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 25,
  },
  createPlaylistModalContent: {
    backgroundColor: '#1a1a1f',
    borderRadius: 25,
    padding: 20,
    width: SCREEN_WIDTH * 0.95,
    maxHeight: SCREEN_HEIGHT * 0.90,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 25,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  searchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 15,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  playlistNameInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 15,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  currentSongSection: {
    marginBottom: 15,
  },
  purchasedSongsSection: {
    marginBottom: 15,
    flex: 1,
  },
  existingPlaylistsSection: {
    marginBottom: 15,
    maxHeight: 120,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  songsHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  songsScrollView: {
    maxHeight: 200,
  },
  createPlaylistSongsScrollView: {
    maxHeight: 350,
    marginBottom: 20,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  songItemSelected: {
    backgroundColor: 'rgba(255, 0, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.5)',
  },
  songImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: '#2a2a2f',
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  songArtist: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBoxSelected: {
    backgroundColor: '#ff00ff',
    borderColor: '#ff00ff',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  playlistsList: {
    maxHeight: 120,
  },
  playlistItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playlistName: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
    letterSpacing: 0.3,
    flex: 1,
  },
  playlistCount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
  },
  newPlaylistSection: {
    marginBottom: 15,
  },
  createPlaylistButton: {
    backgroundColor: 'rgba(255, 0, 255, 0.9)',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createPlaylistText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  closeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  closeButtonText: {
    color: '#888',
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  noSongsText: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  createButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 0, 255, 0.9)',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledText: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 0, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ff00ff',
  },
  addButtonSelected: {
    backgroundColor: '#ff00ff',
    borderColor: '#ff00ff',
  },
  addButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ff00ff',
  },
  addButtonTextSelected: {
    color: '#ffffff',
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
});

export default PlaylistModal;