import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
// TODO: Enable Stripe when properly configured
// import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../lib/supabase';
import { songPurchaseService } from '../services/songPurchaseService';
import { useUser } from '../context/userContext';
import AuthPromptModal from './AuthPromptModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SongPurchaseModalProps {
  visible: boolean;
  onClose: () => void;
  songData: {
    song_id: string;
    song_title: string;
    song_image: string;
    song_file: string;
    song_price: string;
    song_type: 'artist' | 'band';
    song_artist: string;
    artist_name?: string;
    band_name?: string;
  } | null;
  onPurchaseSuccess: () => void;
}

const SongPurchaseModal: React.FC<SongPurchaseModalProps> = ({
  visible,
  onClose,
  songData,
  onPurchaseSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [alreadyPurchased, setAlreadyPurchased] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  // TODO: Enable Stripe when properly configured
  // const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { isGuest, user } = useUser();

  useEffect(() => {
    if (visible && songData) {
      // If user is a guest, show auth prompt instead
      if (isGuest || !user) {
        setShowAuthPrompt(true);
        return;
      }
      getCurrentUser();
      checkIfAlreadyPurchased();
    }
  }, [visible, songData, isGuest, user]);

  // If showing auth prompt for guests
  if (showAuthPrompt && visible) {
    return (
      <AuthPromptModal
        visible={true}
        onClose={() => {
          setShowAuthPrompt(false);
          onClose();
        }}
        action="purchase_song"
      />
    );
  }

  const getCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      setCurrentUser(user);
    } catch (error) {
      console.error('Error getting current user:', error);
      Alert.alert('Error', 'Unable to get user information');
    }
  };

  const checkIfAlreadyPurchased = async () => {
    if (!songData || !currentUser) return;

    try {
      const result = await songPurchaseService.hasUserPurchasedSong(songData.song_id, currentUser.id);
      if (result.success) {
        setAlreadyPurchased(result.hasPurchased || false);
      }
    } catch (error) {
      console.error('Error checking purchase status:', error);
    }
  };

  const handleFreeSongAdd = async () => {
    if (!songData || !currentUser) return;

    Alert.alert(
      'Add to Library',
      `Add "${songData.song_title}" by ${songData.artist_name || songData.band_name} to your purchased songs?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Song',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await songPurchaseService.addFreeSong(songData, currentUser.id);
              
              if (result.success) {
                Alert.alert(
                  'Song Added!',
                  `"${songData.song_title}" has been added to your library. You can find it in your profile under "Purchased Songs".`,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        onPurchaseSuccess();
                        onClose();
                      },
                    },
                  ]
                );
              } else {
                Alert.alert('Error', result.error || 'Failed to add song to library');
              }
            } catch (error) {
              console.error('Error adding free song:', error);
              Alert.alert('Error', 'Something went wrong while adding the song');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handlePaidSongPurchase = async () => {
    if (!songData || !currentUser) return;

    // For now, simulate paid purchase since Stripe is commented out
    Alert.alert(
      'Purchase Song',
      `Purchase "${songData.song_title}" by ${songData.artist_name || songData.band_name} for $${songData.song_price}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: async () => {
            setLoading(true);
            try {
              // Simulate payment - in production, integrate with Stripe
              const mockPaymentIntentId = `pi_test_${Date.now()}`;
              
              const result = await songPurchaseService.purchasePaidSong(
                songData,
                currentUser.id,
                mockPaymentIntentId
              );
              
              if (result.success) {
                Alert.alert(
                  'Purchase Successful!',
                  `"${songData.song_title}" has been purchased and added to your library. You can find it in your profile under "Purchased Songs".`,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        onPurchaseSuccess();
                        onClose();
                      },
                    },
                  ]
                );
              } else {
                Alert.alert('Error', result.error || 'Failed to purchase song');
              }
            } catch (error) {
              console.error('Error purchasing song:', error);
              Alert.alert('Error', 'Something went wrong with your purchase');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Don't render modal if songData is null
  if (!songData) {
    return null;
  }

  const isFree = parseFloat(songData.song_price) === 0;
  const displayName = songData.artist_name || songData.band_name || 'Unknown Artist';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#2a2882', '#ff00ff']}
            style={styles.modalGradient}
          >
            <Text style={styles.modalTitle}>
              {isFree ? 'Add to Library' : 'Purchase Song'}
            </Text>

            {/* Song Info */}
            <View style={styles.songInfo}>
              <Image
                source={{ uri: songData.song_image || 'https://via.placeholder.com/100' }}
                style={styles.songImage}
              />
              <View style={styles.songDetails}>
                <Text style={styles.songTitle} numberOfLines={2}>
                  {songData.song_title}
                </Text>
                <Text style={styles.artistName} numberOfLines={1}>
                  by {displayName}
                </Text>
                <Text style={styles.songType}>
                  {songData.song_type === 'band' ? '🎸 Band' : '🎤 Artist'}
                </Text>
                {!isFree && (
                  <Text style={styles.priceText}>${songData.song_price}</Text>
                )}
              </View>
            </View>

            {alreadyPurchased ? (
              <View style={styles.alreadyPurchasedContainer}>
                <Text style={styles.alreadyPurchasedText}>
                  ✅ You already own this song
                </Text>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onClose}
                >
                  <Text style={styles.cancelButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    styles.purchaseButton,
                    loading && styles.disabledButton,
                    { backgroundColor: isFree ? '#28a745' : '#ff00ff' }
                  ]}
                  onPress={isFree ? handleFreeSongAdd : handlePaidSongPurchase}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.purchaseButtonText}>
                      {isFree ? 'Add to Library' : `Purchase for $${songData.song_price}`}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onClose}
                  disabled={loading}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  modalContainer: {
    width: SCREEN_WIDTH - 40,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 10000,
  },
  modalGradient: {
    padding: 30,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Audiowide-Regular',
  },
  songInfo: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
    width: '100%',
  },
  songImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 15,
  },
  songDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  songTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 5,
    fontFamily: 'Amiko-Regular',
  },
  artistName: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 5,
    fontFamily: 'Amiko-Regular',
  },
  songType: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  priceText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00ff00',
    fontFamily: 'Amiko-Regular',
  },
  buttonContainer: {
    width: '100%',
    gap: 15,
  },
  purchaseButton: {
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  purchaseButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Amiko-Regular',
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
    fontFamily: 'Amiko-Regular',
  },
  alreadyPurchasedContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
  },
  alreadyPurchasedText: {
    fontSize: 18,
    color: '#00ff00',
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'Amiko-Regular',
  },
});

export default SongPurchaseModal;