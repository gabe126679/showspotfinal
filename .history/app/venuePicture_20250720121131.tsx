import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

const MAX_IMAGES = 6;

interface ImageState {
  uri: string;
  fileName: string;
  type: string;
}

export default function VenuePicture({ navigation }) {
  const [images, setImages] = useState<(ImageState | null)[]>(Array(MAX_IMAGES).fill(null));
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const pickImage = async (index: number) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'We need access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio
        quality: 0.8, // Reduced quality for smaller file sizes
      });

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        const uri = asset.uri;
        const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${uuidv4()}.${fileExt}`;
        
        const newImages = [...images];
        newImages[index] = {
          uri,
          fileName,
          type: `image/${fileExt}`,
        };
        setImages(newImages);
      }
    } catch (e) {
      console.error('Image picker error:', e);
      Alert.alert('Error', 'Failed to select image.');
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages[index] = null;
    setImages(newImages);
  };

  const uploadSingleImage = async (imageData: ImageState, userId: string): Promise<string> => {
    const filePath = `${userId}/${imageData.fileName}`;

    try {
      // Method 1: Try FormData first (works with most Supabase setups)
      try {
        const formData = new FormData();
        formData.append('file', {
          uri: imageData.uri,
          type: imageData.type,
          name: imageData.fileName,
        } as any);

        const { error: uploadError } = await supabase
          .storage
          .from('venue-secondary-images')
          .upload(filePath, formData, {
            contentType: imageData.type,
            upsert: true,
          });

        if (!uploadError) {
          // FormData worked, get public URL
          const { data: publicUrlData } = supabase
            .storage
            .from('venue-secondary-images')
            .getPublicUrl(filePath);

          const publicUrl = publicUrlData?.publicUrl;
          if (!publicUrl) {
            throw new Error(`Failed to get public URL for ${imageData.fileName}`);
          }

          return publicUrl;
        }
        
        // If FormData failed, try base64 method
        throw uploadError;
        
      } catch (formDataError) {
        console.log('FormData method failed, trying base64 method for:', imageData.fileName);
        
        // Method 2: Use base64 string directly
        const base64 = await FileSystem.readAsStringAsync(imageData.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Upload base64 data directly
        const { error: uploadError } = await supabase
          .storage
          .from('venue-secondary-images')
          .upload(filePath, base64, {
            contentType: imageData.type,
            upsert: true,
          });

        if (uploadError) {
          console.error('Base64 upload error for', imageData.fileName, ':', uploadError);
          throw uploadError;
        }

        // Get public URL
        const { data: publicUrlData } = supabase
          .storage
          .from('venue-secondary-images')
          .getPublicUrl(filePath);

        const publicUrl = publicUrlData?.publicUrl;
        if (!publicUrl) {
          throw new Error(`Failed to get public URL for ${imageData.fileName}`);
        }

        return publicUrl;
      }
    } catch (error) {
      console.error('Error uploading image:', imageData.fileName, error);
      throw error;
    }
  };

  const uploadImages = async () => {
    const validImages = images.filter((img): img is ImageState => img !== null);
    
    if (validImages.length === 0) {
      Alert.alert('No Images', 'Please select at least one image before continuing.');
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) throw new Error('No user session found');

      const uploadedUrls: string[] = [];
      const totalImages = validImages.length;

      // Upload images one by one with progress tracking
      for (let i = 0; i < validImages.length; i++) {
        const imageData = validImages[i];
        try {
          const publicUrl = await uploadSingleImage(imageData, user.id);
          uploadedUrls.push(publicUrl);
          setUploadProgress(((i + 1) / totalImages) * 100);
        } catch (error) {
          console.error(`Failed to upload image ${i + 1}:`, error);
          // Continue with other images instead of failing completely
        }
      }

      if (uploadedUrls.length === 0) {
        throw new Error('All image uploads failed');
      }

      // Update the venues table
      const { error: updateError } = await supabase
        .from('venues')
        .update({
          venue_profile_image: uploadedUrls[0], // First image as profile image
          venue_secondary_images: uploadedUrls, // All images as secondary images
        })
        .eq('spotter_id', user.id);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      // Show success message
      const successMessage = uploadedUrls.length === validImages.length 
        ? 'All images uploaded successfully!'
        : `${uploadedUrls.length} of ${validImages.length} images uploaded successfully.`;
      
      Alert.alert('Success', successMessage, [
        { text: 'OK', onPress: () => navigation.navigate('BottomTabs') }
      ]);

    } catch (err: any) {
      console.error('Upload error:', err);
      Alert.alert(
        'Upload Failed', 
        err.message || 'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const hasImages = images.some(img => img !== null);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Upload Venue Images</Text>
      <Text style={styles.subtitle}>
        Select up to {MAX_IMAGES} images. The first image will be your profile picture.
      </Text>
      
      <ScrollView contentContainerStyle={styles.gridContainer}>
        {images.map((imageData, index) => (
          <View key={index} style={styles.imageContainer}>
            <TouchableOpacity 
              style={styles.imageBox} 
              onPress={() => pickImage(index)}
            >
              {imageData ? (
                <Image source={{ uri: imageData.uri }} style={styles.image} />
              ) : (
                <View style={styles.placeholder}>
                  <Text style={styles.placeholderText}>+</Text>
                </View>
              )}
            </TouchableOpacity>
            
            {imageData && (
              <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => removeImage(index)}
              >
                <Text style={styles.removeButtonText}>×</Text>
              </TouchableOpacity>
            )}
            
            {index === 0 && imageData && (
              <Text style={styles.profileLabel}>Profile</Text>
            )}
          </View>
        ))}
      </ScrollView>

      {loading && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Uploading... {Math.round(uploadProgress)}%
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { width: `${uploadProgress}%` }]} 
            />
          </View>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.button, (!hasImages || loading) && styles.buttonDisabled]} 
        onPress={uploadImages} 
        disabled={!hasImages || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {hasImages ? 'Upload & Continue' : 'Select Images First'}
          </Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2a2882',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  imageContainer: {
    width: '30%',
    marginVertical: 10,
    position: 'relative',
  },
  imageBox: {
    width: '100%',
    aspectRatio: 1,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#f4f4f4',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 28,
    color: '#999',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  profileLabel: {
    fontSize: 10,
    color: '#2a2882',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressText: {
    textAlign: 'center',
    color: '#2a2882',
    marginBottom: 8,
    fontSize: 14,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2a2882',
    borderRadius: 2,
  },
  button: {
    backgroundColor: '#2a2882',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});