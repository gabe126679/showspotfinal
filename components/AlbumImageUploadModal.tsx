import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { albumService } from '../services/albumService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AlbumImageUploadModalProps {
  visible: boolean;
  onClose: () => void;
  albumId: string;
  albumTitle: string;
  onImageUploaded: (imageUrl: string) => void;
  currentImageUrl?: string;
}

const AlbumImageUploadModal: React.FC<AlbumImageUploadModalProps> = ({
  visible,
  onClose,
  albumId,
  albumTitle,
  onImageUploaded,
  currentImageUrl,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const pickImage = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera roll is required!');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any, // TypeScript expects 'Images' but runtime needs 'images'
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Permission to access camera is required!');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadImage = async () => {
    if (!selectedImage) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }

    try {
      setLoading(true);

      // Create form data
      const formData = new FormData();
      
      // Get file extension
      const fileExtension = selectedImage.split('.').pop() || 'jpg';
      const fileName = `album_${albumId}_${Date.now()}.${fileExtension}`;

      formData.append('file', {
        uri: selectedImage,
        type: `image/${fileExtension}`,
        name: fileName,
      } as any);

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('song-images') // Using same bucket as song images
        .upload(fileName, formData, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('song-images')
        .getPublicUrl(fileName);

      if (!publicUrlData.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      // Update album with new image
      const { error: updateError } = await supabase
        .from('albums')
        .update({ album_image: publicUrlData.publicUrl })
        .eq('album_id', albumId);

      if (updateError) {
        throw updateError;
      }

      // Call callback
      onImageUploaded(publicUrlData.publicUrl);
      
      Alert.alert('Success', 'Album image uploaded successfully!');
      onClose();
      setSelectedImage(null);

    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedImage(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.8)', 'rgba(42, 40, 130, 0.9)']}
          style={StyleSheet.absoluteFillObject}
        />
        
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add Album Image</Text>
          <Text style={styles.modalSubtitle}>"{albumTitle}"</Text>

          {/* Current or Selected Image */}
          <View style={styles.imageContainer}>
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={styles.previewImage} />
            ) : currentImageUrl ? (
              <Image source={{ uri: currentImageUrl }} style={styles.previewImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.placeholderText}>No Image</Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
              <LinearGradient colors={['#ff00ff', '#2a2882']} style={styles.actionButtonGradient}>
                <Text style={styles.actionButtonText}>Choose from Library</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
              <LinearGradient colors={['#2a2882', '#ff00ff']} style={styles.actionButtonGradient}>
                <Text style={styles.actionButtonText}>Take Photo</Text>
              </LinearGradient>
            </TouchableOpacity>

            {selectedImage && (
              <TouchableOpacity 
                style={[styles.actionButton, loading && styles.disabledButton]} 
                onPress={uploadImage}
                disabled={loading}
              >
                <LinearGradient colors={['#4CAF50', '#45a049']} style={styles.actionButtonGradient}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>Upload Image</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
    width: SCREEN_WIDTH - 40,
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'Amiko-Regular',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  imageContainer: {
    width: 200,
    height: 200,
    marginBottom: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
    fontFamily: 'Amiko-Regular',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  closeButton: {
    marginTop: 15,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  closeButtonText: {
    color: '#666',
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
  },
});

export default AlbumImageUploadModal;