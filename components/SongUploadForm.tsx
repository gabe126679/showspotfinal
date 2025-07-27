import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabase";
import { notificationService } from '../services/notificationService';

interface SongUploadFormProps {
  visible: boolean;
  onClose: () => void;
  artistData: any;
  bandData?: any;
  bandId?: string;
}

const PRICE_SUGGESTIONS = [
  { label: "Free", value: "0" },
  { label: "$1", value: "1" },
  { label: "$5", value: "5" },
  { label: "$10", value: "10" },
];

const SongUploadForm: React.FC<SongUploadFormProps> = ({
  visible,
  onClose,
  artistData,
  bandData,
  bandId,
}) => {
  const [songTitle, setSongTitle] = useState("");
  const [songPrice, setSongPrice] = useState("");
  const [songFile, setSongFile] = useState<any>(null);
  const [songImage, setSongImage] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showPriceSuggestions, setShowPriceSuggestions] = useState(false);

  const handleSongFileUpload = async () => {
    try {
      console.log('Starting file picker...');
      
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'audio/mpeg',      // MP3
          'audio/mp3',       // MP3 alternative
          'audio/wav',       // WAV
          'audio/x-wav',     // WAV alternative
          'audio/mp4',       // M4A
          'audio/aac',       // AAC
          'audio/*'          // Fallback
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      console.log('DocumentPicker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        console.log('Selected file details:', {
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
          uri: file.uri
        });
        
        // Validate file size (max 50MB)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size && file.size > maxSize) {
          Alert.alert("File Too Large", "Please select an audio file smaller than 50MB");
          return;
        }
        
        // Validate MIME type
        const validMimeTypes = [
          'audio/mpeg',
          'audio/mp3', 
          'audio/wav',
          'audio/x-wav',
          'audio/mp4',
          'audio/aac',
          'audio/m4a'
        ];
        
        const isValidMimeType = file.mimeType && validMimeTypes.some(type => 
          file.mimeType.toLowerCase().includes(type.split('/')[1])
        );
        
        // Validate file extension as backup
        const validExtensions = ['mp3', 'wav', 'm4a', 'aac'];
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        const hasValidExtension = fileExtension && validExtensions.includes(fileExtension);
        
        if (!isValidMimeType && !hasValidExtension) {
          Alert.alert(
            "Invalid File Type", 
            "Please select a valid audio file (MP3, WAV, M4A, or AAC)"
          );
          return;
        }
        
        // Additional validation: check if file actually exists and is readable
        try {
          const testResponse = await fetch(file.uri, { method: 'HEAD' });
          if (!testResponse.ok) {
            throw new Error('File not accessible');
          }
          console.log('File accessibility verified');
        } catch (accessError) {
          console.error('File access test failed:', accessError);
          Alert.alert("File Error", "The selected file cannot be accessed. Please try selecting a different file.");
          return;
        }
        
        setSongFile(file);
        console.log('File successfully selected and validated');
        
      } else {
        console.log('File selection cancelled or failed');
      }
    } catch (error) {
      console.error("Error picking audio file:", error);
      Alert.alert("Error", `Failed to select audio file: ${error.message}`);
    }
  };

  const handleImageUpload = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant photo library access");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSongImage(result.assets[0]);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to select image");
    }
  };

  const handlePriceSelect = (price: string) => {
    setSongPrice(price);
    setShowPriceSuggestions(false);
  };

  const validateForm = () => {
    if (!songTitle.trim()) {
      Alert.alert("Error", "Please enter a song title");
      return false;
    }
    
    if (!songPrice.trim()) {
      Alert.alert("Error", "Please enter a song price");
      return false;
    }
    
    if (!songFile) {
      Alert.alert("Error", "Please select a song file");
      return false;
    }
    
    const priceNum = parseFloat(songPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert("Error", "Please enter a valid price");
      return false;
    }
    
    return true;
  };

  const uploadFileToSupabase = async (file: any, bucket: string, folderPath: string) => {
    try {
      console.log('=== FILE UPLOAD DEBUG ===');
      console.log('Original file:', {
        name: file.name,
        size: file.size,
        type: file.type || file.mimeType,
        uri: file.uri
      });

      // Determine file extension
      let fileExt: string;
      if (file.name) {
        // DocumentPicker file has name
        fileExt = file.name.split('.').pop()?.toLowerCase() || '';
      } else if (file.uri) {
        // ImagePicker file - extract extension from URI
        const uriParts = file.uri.split('.');
        fileExt = uriParts[uriParts.length - 1]?.toLowerCase() || '';
        
        // Sometimes ImagePicker URIs end with .png, .jpg, etc.
        if (!fileExt || fileExt.length > 4) {
          // If no clear extension, use type to determine
          if (file.type?.includes('png')) fileExt = 'png';
          else if (file.type?.includes('jpeg') || file.type?.includes('jpg')) fileExt = 'jpg';
          else fileExt = 'png'; // default for images
        }
      } else {
        throw new Error('Invalid file: no name or URI found');
      }
      
      console.log('File extension:', fileExt);
      
      // Validate file type based on bucket
      if (bucket === 'songs') {
        const validAudioExtensions = ['mp3', 'wav', 'm4a', 'aac'];
        if (!validAudioExtensions.includes(fileExt)) {
          throw new Error(`Invalid audio file type: ${fileExt}. Please use MP3, WAV, M4A, or AAC.`);
        }
      } else if (bucket === 'song-images') {
        const validImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        if (!validImageExtensions.includes(fileExt)) {
          throw new Error(`Invalid image file type: ${fileExt}. Please use JPG, PNG, GIF, or WEBP.`);
        }
      }
      
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${folderPath}/${fileName}`;
      
      console.log('Upload path:', filePath);

      // React Native specific upload - using Supabase client with proper file object
      console.log('Using optimized React Native upload...');
      
      // Create a proper file object for React Native
      // Fix incomplete MIME types (e.g., "image" -> "image/png")
      let mimeType = file.type || file.mimeType;
      if (mimeType === 'image' || !mimeType?.includes('/')) {
        mimeType = bucket === 'songs' ? `audio/${fileExt}` : `image/${fileExt}`;
      }
      
      const fileObject = {
        uri: file.uri,
        name: file.name || fileName,
        type: mimeType,
      };

      console.log('File object for upload:', fileObject);

      // Use the Supabase client's upload method with the file object
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, fileObject, {
          cacheControl: '3600',
          upsert: false,
          contentType: fileObject.type,
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw error;
      }

      console.log('Upload successful:', data);
      return data.path;
      
    } catch (error) {
      console.error("File upload failed:", error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        Alert.alert("Error", "You must be logged in to upload songs");
        return;
      }

      // Upload song file to songs bucket with spotter_id folder structure
      const songFilePath = await uploadFileToSupabase(
        songFile,
        "songs",
        userId // Use spotter_id as folder name
      );

      // Upload song image or use artist/band profile image
      let songImagePath = artistData?.artist_profile_image || bandData?.band_profile_picture || null;
      if (songImage) {
        songImagePath = await uploadFileToSupabase(
          songImage,
          "song-images",
          userId // Use spotter_id as folder name
        );
      }

      // Get current user's artist_id for band uploads
      let uploaderArtistId = artistData?.artist_id;
      if (bandId && !uploaderArtistId) {
        const { data: userArtist } = await supabase
          .from('artists')
          .select('artist_id')
          .eq('spotter_id', userId)
          .single();
        uploaderArtistId = userArtist?.artist_id;
      }

      // Prepare song data
      const songData: any = {
        spotter_id: userId,                    // Required: uploader's spotter_id
        artist_id: uploaderArtistId,           // Required: artist_id from artists table
        song_title: songTitle.trim(),          // Required: song title
        song_price: songPrice,                 // Required: price as string
        song_image: songImagePath,             // Optional: song cover image
        song_file: songFilePath,               // Required: actual song file path
        song_status: 'active',                 // Default to 'active'
        uploader_id: uploaderArtistId,         // Track who uploaded the song
      };

      // Handle band vs artist uploads differently
      if (bandId && bandData) {
        // Band upload - requires consensus
        songData.song_type = 'band';
        songData.band_id = bandId;
        songData.song_approved = false; // Requires approval
        songData.song_status = 'pending'; // Keep pending until all approve
        
        // Create consensus array for all band members
        const consensus = bandData.band_members.map((memberId: string) => ({
          member: memberId,
          accepted: memberId === uploaderArtistId // Uploader auto-approves
        }));
        songData.song_consensus = consensus;
      } else {
        // Artist upload - no consensus needed
        songData.song_type = 'artist';
        songData.song_approved = true;
        songData.song_consensus = true;
      }

      // Save song data to database
      const { data: insertedSong, error: dbError } = await supabase
        .from("songs")
        .insert(songData)
        .select()
        .single();

      if (dbError) {
        console.error("Database error:", dbError);
        throw dbError;
      }

      // Send notifications for band songs
      if (bandId && bandData && insertedSong) {
        try {
          // Get uploader's artist name
          const { data: uploaderArtist } = await supabase
            .from('artists') 
            .select('artist_name')
            .eq('artist_id', uploaderArtistId)
            .single();

          const uploaderName = uploaderArtist?.artist_name || 'A band member';

          // Send song request notifications to all other band members
          await notificationService.sendSongRequestNotifications(
            uploaderArtistId,
            uploaderName,
            insertedSong.song_id,
            songTitle.trim(),
            bandId,
            bandData.band_name,
            bandData.band_members,
            songFilePath,
            songImagePath
          );

          console.log('✅ Song request notifications sent successfully');
        } catch (notificationError) {
          console.error('Failed to send notifications:', notificationError);
          // Don't fail the upload if notifications fail
        }
      }

      Alert.alert(
        "Success", 
        bandId 
          ? "Song uploaded! Other band members will be notified to approve it." 
          : "Song uploaded successfully!",
        [
          {
            text: "OK",
            onPress: () => {
              resetForm();
              onClose();
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error uploading song:", error);
      Alert.alert("Error", `Failed to upload song: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSongTitle("");
    setSongPrice("");
    setSongFile(null);
    setSongImage(null);
    setShowPriceSuggestions(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={["#ff00ff", "#2a2882"]}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {bandId ? `Upload Song to ${bandData?.band_name || 'Band'}` : 'Upload Song'}
          </Text>
          <View style={styles.closeButton} />
        </LinearGradient>

        <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
          {/* Song Title */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Song Title *</Text>
            <TextInput
              style={styles.textInput}
              value={songTitle}
              onChangeText={setSongTitle}
              placeholder="Enter song title"
              placeholderTextColor="#999"
            />
          </View>

          {/* Song Price */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Song Price *</Text>
            <View style={styles.priceContainer}>
              <TextInput
                style={[styles.textInput, styles.priceInput]}
                value={songPrice}
                onChangeText={setSongPrice}
                placeholder="0"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.suggestionsButton}
                onPress={() => setShowPriceSuggestions(!showPriceSuggestions)}
              >
                <Text style={styles.suggestionsButtonText}>
                  {showPriceSuggestions ? "Hide" : "Suggestions"}
                </Text>
              </TouchableOpacity>
            </View>
            
            {showPriceSuggestions && (
              <View style={styles.priceGrid}>
                {PRICE_SUGGESTIONS.map((price, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.priceChip}
                    onPress={() => handlePriceSelect(price.value)}
                  >
                    <Text style={styles.priceChipText}>{price.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Song File */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Song File (MP3) *</Text>
            <TouchableOpacity style={styles.fileButton} onPress={handleSongFileUpload}>
              <LinearGradient
                colors={songFile ? ["#50C878", "#32CD32"] : ["#ff00ff", "#2a2882"]}
                style={styles.fileButtonGradient}
              >
                <Text style={styles.fileButtonText}>
                  {songFile ? `✓ ${songFile.name}` : "Select Audio File"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Song Image */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Song Image (Optional)</Text>
            <Text style={styles.subLabel}>
              Leave empty to use your profile picture
            </Text>
            
            <TouchableOpacity style={styles.imageButton} onPress={handleImageUpload}>
              {songImage ? (
                <Image source={{ uri: songImage.uri }} style={styles.imagePreview} />
              ) : artistData?.artist_profile_image ? (
                <View style={styles.imagePreviewContainer}>
                  <Image 
                    source={{ uri: artistData.artist_profile_image }} 
                    style={[styles.imagePreview, styles.fallbackImage]} 
                  />
                  <Text style={styles.fallbackText}>Default (Your Profile)</Text>
                </View>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>Tap to select image</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <LinearGradient
              colors={loading ? ["#999", "#666"] : ["#ff00ff", "#2a2882"]}
              style={styles.submitButtonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Upload Song</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Audiowide-Regular",
    color: "#fff",
    textAlign: "center",
  },
  formContainer: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    fontFamily: "Amiko-Regular",
    color: "#333",
    marginBottom: 8,
    fontWeight: "600",
  },
  subLabel: {
    fontSize: 14,
    fontFamily: "Amiko-Regular",
    color: "#666",
    marginBottom: 10,
    fontStyle: "italic",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Amiko-Regular",
    backgroundColor: "#f9f9f9",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  priceInput: {
    flex: 1,
  },
  suggestionsButton: {
    backgroundColor: "#ff00ff",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
  },
  suggestionsButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Amiko-Regular",
    fontWeight: "600",
  },
  priceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  priceChip: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  priceChipText: {
    fontSize: 14,
    fontFamily: "Amiko-Regular",
    color: "#333",
  },
  fileButton: {
    borderRadius: 8,
    overflow: "hidden",
  },
  fileButtonGradient: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  fileButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Amiko-Regular",
    fontWeight: "600",
  },
  imageButton: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f9f9f9",
  },
  imagePreview: {
    width: "100%",
    height: 200,
    resizeMode: "cover",
  },
  imagePreviewContainer: {
    position: "relative",
  },
  fallbackImage: {
    opacity: 0.7,
  },
  fallbackText: {
    position: "absolute",
    bottom: 10,
    left: 15,
    backgroundColor: "rgba(0,0,0,0.7)",
    color: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontFamily: "Amiko-Regular",
  },
  imagePlaceholder: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    fontSize: 16,
    fontFamily: "Amiko-Regular",
    color: "#666",
  },
  submitButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 20,
    marginBottom: 30,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Amiko-Regular",
    fontWeight: "600",
  },
});

export default SongUploadForm;