import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ratingService, EntityType, RatingInfo } from '../services/ratingService';
import { supabase } from '../lib/supabase';

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  entityId: string;
  entityType: EntityType;
  entityName: string;
  onRatingSubmitted?: (newRating: RatingInfo) => void;
}

const RatingModal: React.FC<RatingModalProps> = ({
  visible,
  onClose,
  entityId,
  entityType,
  entityName,
  onRatingSubmitted,
}) => {
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [currentRatingInfo, setCurrentRatingInfo] = useState<RatingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      fetchCurrentUser();
      fetchRatingInfo();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      setSelectedRating(0);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const fetchCurrentUser = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      setCurrentUser(sessionData.session?.user || null);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchRatingInfo = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      const result = await ratingService.getRatingInfo(entityId, entityType, userId);
      
      if (result.success && result.data) {
        setCurrentRatingInfo(result.data);
        if (result.data.hasRated) {
          setSelectedRating(result.data.userRating);
        }
      }
    } catch (error) {
      console.error('Error fetching rating info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStarPress = (rating: number) => {
    if (currentRatingInfo?.hasRated) {
      Alert.alert(
        'Already Rated',
        `You have already rated this ${entityType}. You can only rate once.`,
        [{ text: 'OK' }]
      );
      return;
    }
    setSelectedRating(rating);
  };

  const handleSubmitRating = async () => {
    if (!currentUser) {
      Alert.alert('Not Logged In', 'Please log in to submit a rating.');
      return;
    }

    if (selectedRating === 0) {
      Alert.alert('No Rating Selected', 'Please select a star rating before submitting.');
      return;
    }

    if (currentRatingInfo?.hasRated) {
      Alert.alert(
        'Already Rated',
        `You have already rated this ${entityType}. You can only rate once.`,
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setSubmitting(true);
      
      const result = await ratingService.rateEntity(
        entityId,
        entityType,
        currentUser.id,
        selectedRating
      );

      if (result.success && result.data) {
        setCurrentRatingInfo(result.data);
        onRatingSubmitted?.(result.data);
        
        Alert.alert(
          'Rating Submitted',
          `Thank you for rating ${entityName}!`,
          [
            {
              text: 'OK',
              onPress: onClose,
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to submit rating. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const isSelected = i <= selectedRating;
      const isUserRated = currentRatingInfo?.hasRated && i <= currentRatingInfo.userRating;
      
      stars.push(
        <TouchableOpacity
          key={i}
          style={styles.starButton}
          onPress={() => handleStarPress(i)}
          disabled={currentRatingInfo?.hasRated || submitting}
        >
          <Text style={[
            styles.starText,
            isSelected || isUserRated ? styles.starSelected : styles.starUnselected,
            (currentRatingInfo?.hasRated || submitting) && styles.starDisabled
          ]}>
            ★
          </Text>
        </TouchableOpacity>
      );
    }
    return stars;
  };

  const getEntityTypeDisplay = () => {
    switch (entityType) {
      case 'artist': return 'Artist';
      case 'band': return 'Band';
      case 'venue': return 'Venue';
      default: return 'Entity';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalContainer, { opacity: fadeAnim }]}>
          <LinearGradient
            colors={['#2a2882', '#ff00ff']}
            style={styles.modalGradient}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Rate {getEntityTypeDisplay()}
              </Text>
              
              <Text style={styles.entityName} numberOfLines={1}>
                {entityName}
              </Text>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.loadingText}>Loading rating info...</Text>
                </View>
              ) : (
                <>
                  {currentRatingInfo && (
                    <View style={styles.currentRatingContainer}>
                      <Text style={styles.currentRatingText}>
                        Current Rating: {currentRatingInfo.currentRating.toFixed(1)} ★
                      </Text>
                      <Text style={styles.ratingCountText}>
                        ({currentRatingInfo.totalRaters} rating{currentRatingInfo.totalRaters !== 1 ? 's' : ''})
                      </Text>
                    </View>
                  )}

                  <View style={styles.starsContainer}>
                    <Text style={styles.rateText}>
                      {currentRatingInfo?.hasRated 
                        ? `Your Rating: ${currentRatingInfo.userRating} ★`
                        : 'Tap to rate:'
                      }
                    </Text>
                    <View style={styles.starsRow}>
                      {renderStars()}
                    </View>
                  </View>

                  {currentRatingInfo?.hasRated ? (
                    <Text style={styles.alreadyRatedText}>
                      You have already rated this {entityType}
                    </Text>
                  ) : (
                    <View style={styles.buttonContainer}>
                      <TouchableOpacity
                        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                        onPress={handleSubmitRating}
                        disabled={submitting || selectedRating === 0}
                      >
                        {submitting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.submitButtonText}>Submit Rating</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: 0,
  },
  modalContent: {
    padding: 30,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'Audiowide-Regular',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  entityName: {
    fontSize: 18,
    fontFamily: 'Amiko-Regular',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    marginTop: 10,
  },
  currentRatingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  currentRatingText: {
    fontSize: 18,
    fontFamily: 'Amiko-Regular',
    color: '#fff',
    fontWeight: '600',
  },
  ratingCountText: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  starsContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  rateText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#fff',
    marginBottom: 15,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  starButton: {
    padding: 5,
    marginHorizontal: 5,
  },
  starText: {
    fontSize: 40,
  },
  starSelected: {
    color: '#FFD700',
  },
  starUnselected: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  starDisabled: {
    opacity: 0.6,
  },
  alreadyRatedText: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  closeButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    textDecorationLine: 'underline',
  },
});

export default RatingModal;