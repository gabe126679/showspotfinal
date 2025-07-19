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

interface SongUploadFormProps {
  visible: boolean;
  onClose: () => void;
  artistData: any;
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
}) => {
  const [songTitle, setSongTitle] = useState("");
  const [songPrice, setSongPrice] = useState("");
  const [songFile, setSongFile] = useState<any>(null);
  const [songImage, setSongImage] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showPriceSuggestions, setShowPriceSuggestions] = useState(false);

  const handleSongFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        if (file.mimeType?.startsWith("audio/")) {
          setSongFile(file);
        } else {
          Alert.alert("Error", "Please select an audio file (MP3, WAV, etc.)");
        }
      }
    } catch (error) {
      console.error("Error picking audio file:", error);
      Alert.alert("Error", "Failed to select audio file");
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${folderPath}/${fileName}`;

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        type: file.mimeType,
        name: fileName,
      } as any);

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, formData, {
          contentType: file.mimeType,
        });

      if (error) throw error;
      return data.path;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
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

      // Upload song image or use artist profile image
      let songImagePath = artistData?.artistProfileImage || null;
      if (songImage) {
        songImagePath = await uploadFileToSupabase(
          songImage,
          "song-images",
          userId // Use spotter_id as folder name
        );
      }

      // Save song data to database with snake_case column names
      const { error: dbError } = await supabase
        .from("songs")
        .insert({
          spotter_id: userId,                    // Required: uploader's spotter_id
          artist_id: artistData.artistID,        // Required: artist_id from artists table
          song_type: 'artist',                   // Default to 'artist' type
          song_title: songTitle.trim(),          // Required: song title
          song_price: songPrice,                 // Required: price as string
          song_image: songImagePath,             // Optional: song cover image
          song_file: songFilePath,               // Required: actual song file path
          song_status: 'active',                 // Default to 'active'
          song_consensus: true,                  // Default to true for artist songs
          // created_at is auto-generated
        });

      if (dbError) {
        console.error("Database error:", dbError);
        throw dbError;
      }

      Alert.alert(
        "Success",
        "Song uploaded successfully!",
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
          <Text style={styles.headerTitle}>Upload Song</Text>
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
              ) : artistData?.artistProfileImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image 
                    source={{ uri: artistData.artistProfileImage }} 
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