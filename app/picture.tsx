import { useState, useEffect } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';


type Props = NativeStackScreenProps<RootStackParamList, 'BottomTabs'>;

export default function Picture({ navigation }: Props) {
  const [image, setImage] = useState<{ uri: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState<string>('User');

  useEffect(() => {
    // Optional: Get user name from session for success screen
    const getUserName = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (user) {
        const { data } = await supabase
          .from('spotters')
          .select('full_name')
          .eq('id', user.id)
          .single();
        if (data?.full_name) setName(data.full_name);
      }
    };
    getUserName();
  }, []);

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission required', 'We need access to your photo library.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'] as unknown as ImagePicker.MediaTypeOptions, // Type assertion with unknown
                allowsEditing: true,
                quality: 1,
            });

            console.log('Image Picker Result:', result);

            if (!result.canceled && result.assets?.length) {
                const asset = result.assets[0]; // Access the first asset in the array
                setImage({ uri: asset.uri, type: asset.type ?? 'image/jpeg' });
            } else {
                console.log('User canceled or no image selected');
            }
        } catch (e) {
            console.error('Unexpected error in pickImage:', e);
            Alert.alert('Error', 'Something went wrong while selecting the image.');
        }
    };


const uploadAndContinue = async () => {
  if (!image) {
    Alert.alert('No Image', 'Please select an image first.');
    return;
  }

  setLoading(true);

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) throw new Error('No active user session.');

    const fileExt = image.uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;
    const mimeType = image.type || 'image/jpeg';

    const { data, error } = await supabase.auth.getUser();
    const accessToken = sessionData.session?.access_token;

    const uploadUrl = `https://myqrzbdxvfqhcrsiintm.supabase.co/storage/v1/object/spotter-profile-pictures/${filePath}`;

    const uploadRes = await FileSystem.uploadAsync(uploadUrl, image.uri, {
      httpMethod: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': mimeType,
      },
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });

    if (uploadRes.status !== 200 && uploadRes.status !== 201) {
      console.error('Upload failed', uploadRes);
      throw new Error('Upload failed');
    }

    const publicUrl = `https://myqrzbdxvfqhcrsiintm.supabase.co/storage/v1/object/public/spotter-profile-pictures/${filePath}`;

    console.log('✅ Uploaded image URL:', publicUrl);

    const { error: updateError } = await supabase
      .from('spotters')
      .update({ spotter_profile_picture: publicUrl })
      .eq('id', user.id);

    if (updateError) {
      console.error('Update error:', updateError);
      throw new Error('Failed to update profile.');
    }

    navigation.navigate('BottomTabs');
  } catch (err: any) {
    Alert.alert('Upload Failed', err.message || 'Something went wrong.');
  } finally {
    setLoading(false);
  }
};





  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Upload a Profile Picture</Text>

      <TouchableOpacity onPress={pickImage}>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={{ color: '#888' }}>Tap to select a profile picture</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { opacity: loading ? 0.5 : 1 }]}
        onPress={uploadAndContinue}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2a2882',
  },
  image: {
    width: 300,
    height: 300,
    borderRadius: 20,
    marginBottom: 20,
    resizeMode: 'cover',
  },
  placeholder: {
    width: 300,
    height: 300,
    borderRadius: 20,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#2a2882',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
