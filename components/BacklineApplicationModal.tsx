import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { backlinesService, BacklineArtistType } from '../services/backlinesService';

interface Band {
  band_id: string;
  band_name: string;
  band_profile_picture?: string;
}

interface BacklineApplicationModalProps {
  visible: boolean;
  onClose: () => void;
  showId: string;
  onApplicationSubmitted: () => void;
}

const BacklineApplicationModal: React.FC<BacklineApplicationModalProps> = ({
  visible,
  onClose,
  showId,
  onApplicationSubmitted,
}) => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userArtistId, setUserArtistId] = useState<string | null>(null);
  const [userBands, setUserBands] = useState<Band[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchUserData();
    }
  }, [visible]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      
      if (!session?.user) {
        Alert.alert('Error', 'Please log in to apply for backline');
        onClose();
        return;
      }

      setCurrentUser(session.user);

      // Get user's artist profile
      const { data: artistData, error: artistError } = await supabase
        .from('artists')
        .select('artist_id, artist_name')
        .eq('spotter_id', session.user.id)
        .single();

      if (artistError) {
        console.log('No artist profile found for user');
      } else if (artistData) {
        setUserArtistId(artistData.artist_id);
      }

      // Get user's bands
      if (artistData?.artist_id) {
        const { data: bandsData, error: bandsError } = await supabase
          .from('bands')
          .select('band_id, band_name, band_profile_picture, band_members')
          .contains('band_members', [artistData.artist_id]);

        if (!bandsError && bandsData) {
          setUserBands(bandsData);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleBacklineApplication = async (artistId: string, artistType: BacklineArtistType) => {
    try {
      setSubmitting(true);

      const result = await backlinesService.addBacklineApplication(
        showId,
        artistId,
        artistType
      );

      if (result.success) {
        Alert.alert(
          'Success!', 
          artistType === 'artist' 
            ? 'Your backline application has been submitted and is now active!'
            : 'Your band backline application has been submitted. Waiting for band consensus.'
        );
        onApplicationSubmitted();
        onClose();
      } else {
        Alert.alert('Error', result.error || 'Failed to submit backline application');
      }
    } catch (error) {
      console.error('Error submitting backline application:', error);
      Alert.alert('Error', 'Failed to submit backline application');
    } finally {
      setSubmitting(false);
    }
  };

  const renderOption = ({ item, type }: { item: any; type: 'solo' | 'band' }) => (
    <TouchableOpacity
      style={styles.optionItem}
      onPress={() => handleBacklineApplication(
        type === 'solo' ? userArtistId! : item.band_id,
        type === 'solo' ? 'artist' : 'band'
      )}
      disabled={submitting}
    >
      <Image
        source={{
          uri: type === 'solo' 
            ? 'https://via.placeholder.com/60'
            : item.band_profile_picture || 'https://via.placeholder.com/60'
        }}
        style={styles.optionImage}
      />
      <View style={styles.optionInfo}>
        <Text style={styles.optionName}>
          {type === 'solo' ? 'Solo Artist' : item.band_name}
        </Text>
        <Text style={styles.optionType}>
          {type === 'solo' ? 'Apply as individual artist' : 'Apply as band (requires consensus)'}
        </Text>
      </View>
      {submitting && (
        <ActivityIndicator size="small" color="#ff00ff" />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ActivityIndicator size="large" color="#ff00ff" />
            <Text style={styles.loadingText}>Loading your options...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={["#2a2882", "#ff00ff"]}
            style={styles.modalHeader}
          >
            <Text style={styles.modalTitle}>Apply for Backline</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.modalBody}>
            <Text style={styles.sectionTitle}>Choose how to apply:</Text>
            
            {/* Solo Artist Option */}
            {userArtistId && (
              <View style={styles.section}>
                <Text style={styles.sectionSubtitle}>As Solo Artist</Text>
                {renderOption({ item: null, type: 'solo' })}
              </View>
            )}

            {/* Band Options */}
            {userBands.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionSubtitle}>As Band Member</Text>
                <FlatList
                  data={userBands}
                  keyExtractor={(item) => item.band_id}
                  renderItem={({ item }) => renderOption({ item, type: 'band' })}
                  showsVerticalScrollIndicator={false}
                  style={styles.bandsList}
                />
              </View>
            )}

            {!userArtistId && userBands.length === 0 && (
              <View style={styles.noOptionsContainer}>
                <Text style={styles.noOptionsText}>
                  You need an artist profile or band membership to apply for backlines.
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    maxHeight: '80%',
    width: '90%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Audiowide-Regular',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  optionImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  optionType: {
    fontSize: 14,
    fontFamily: 'Amiko-Regular',
    color: '#666',
  },
  bandsList: {
    maxHeight: 200,
  },
  noOptionsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noOptionsText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#333',
    marginTop: 10,
    textAlign: 'center',
  },
});

export default BacklineApplicationModal;