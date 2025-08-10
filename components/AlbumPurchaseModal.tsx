import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { albumService, Album } from '../services/albumService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AlbumPurchaseModalProps {
  visible: boolean;
  onClose: () => void;
  album: Album | null;
  onPurchaseComplete: () => void;
}

const AlbumPurchaseModal: React.FC<AlbumPurchaseModalProps> = ({
  visible,
  onClose,
  album,
  onPurchaseComplete,
}) => {
  const [loading, setLoading] = useState(false);

  const getImageUrl = (imagePath: string): string => {
    if (!imagePath) return 'https://via.placeholder.com/300';
    
    if (imagePath.startsWith('http')) {
      return imagePath;
    }

    const { data } = supabase.storage
      .from('song-images')
      .getPublicUrl(imagePath);

    return data.publicUrl;
  };

  const handlePurchase = async () => {
    if (!album) return;

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to purchase albums');
        return;
      }

      const result = await albumService.purchaseAlbum(album.album_id, user.id);

      if (result.success) {
        const isFree = album.album_price === '0';
        Alert.alert(
          'Success!',
          isFree 
            ? `You've successfully downloaded "${album.album_title}"!`
            : `You've successfully purchased "${album.album_title}" for $${album.album_price}!`,
          [
            {
              text: 'OK',
              onPress: () => {
                onPurchaseComplete();
                onClose();
              },
            },
          ]
        );
      } else {
        Alert.alert('Purchase Failed', result.error || 'Something went wrong');
      }
    } catch (error) {
      console.error('Error purchasing album:', error);
      Alert.alert('Error', 'Something went wrong while processing your purchase');
    } finally {
      setLoading(false);
    }
  };

  if (!album) return null;

  const isFree = album.album_price === '0';
  const songCount = album.album_song_data?.length || 0;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Album Cover */}
          <View style={styles.albumCoverContainer}>
            <Image
              source={{ uri: getImageUrl(album.album_image) }}
              style={styles.albumCover}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={styles.albumCoverGradient}
            />
          </View>

          {/* Album Info */}
          <View style={styles.albumInfo}>
            <Text style={styles.albumTitle}>{album.album_title}</Text>
            <Text style={styles.albumArtist}>
              {album.album_type === 'band' ? 'Band Album' : 'Artist Album'}
            </Text>
            <Text style={styles.albumDetails}>
              {songCount} song{songCount !== 1 ? 's' : ''} • 
              {isFree ? ' Free' : ` $${album.album_price}`}
            </Text>
          </View>

          {/* Track List Preview */}
          <View style={styles.trackListContainer}>
            <Text style={styles.trackListTitle}>Track List</Text>
            <ScrollView style={styles.trackList} showsVerticalScrollIndicator={false}>
              {album.album_song_data?.map((song, index) => (
                <View key={song.song_id} style={styles.trackItem}>
                  <Text style={styles.trackNumber}>{index + 1}</Text>
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle} numberOfLines={1}>
                      {song.song_title}
                    </Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>
                      {song.artist_name || song.band_name || 'Unknown Artist'}
                    </Text>
                  </View>
                  {song.song_image && (
                    <Image
                      source={{ uri: getImageUrl(song.song_image) }}
                      style={styles.trackImage}
                    />
                  )}
                </View>
              )) || (
                <Text style={styles.noTracksText}>No tracks available</Text>
              )}
            </ScrollView>
          </View>

          {/* Purchase Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.purchaseButton, loading && styles.purchaseButtonDisabled]}
              onPress={handlePurchase}
              disabled={loading}
            >
              <LinearGradient
                colors={isFree ? ['#28a745', '#20c997'] : ['#ff00ff', '#2a2882']}
                style={styles.purchaseButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.purchaseButtonText}>
                    {isFree ? '📥 Download Free' : `💳 Purchase for $${album.album_price}`}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  modalContent: {
    backgroundColor: '#1a1a1f',
    borderRadius: 20,
    width: SCREEN_WIDTH * 0.9,
    maxHeight: '85%',
    overflow: 'hidden',
    zIndex: 10000,
    elevation: 10000,
  },
  albumCoverContainer: {
    position: 'relative',
    height: 250,
  },
  albumCover: {
    width: '100%',
    height: '100%',
  },
  albumCoverGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  albumInfo: {
    padding: 20,
    paddingBottom: 10,
  },
  albumTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  albumArtist: {
    fontSize: 16,
    color: '#ff00ff',
    marginBottom: 5,
    fontWeight: '600',
  },
  albumDetails: {
    fontSize: 14,
    color: '#888',
  },
  trackListContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    flex: 1,
  },
  trackListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  trackList: {
    maxHeight: 200,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  trackNumber: {
    width: 30,
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  trackInfo: {
    flex: 1,
    marginLeft: 10,
  },
  trackTitle: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  trackArtist: {
    fontSize: 12,
    color: '#888',
  },
  trackImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginLeft: 10,
  },
  noTracksText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  buttonContainer: {
    padding: 20,
    paddingTop: 10,
  },
  purchaseButton: {
    marginBottom: 10,
  },
  purchaseButtonGradient: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#888',
  },
});

export default AlbumPurchaseModal;