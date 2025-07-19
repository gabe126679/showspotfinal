import { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { supabase } from '../lib/supabase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Success'>;

const screenWidth = Dimensions.get('window').width;

export default function Success({ route, navigation }: Props) {
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfileImage = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (user) {
        const { data, error } = await supabase
          .from('spotters')
          .select('spotter_profile_picture')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile picture:', error);
        } else {
          setProfileUrl(data?.spotter_profile_picture ?? null);
        }
      }

      setLoading(false);
    };

    fetchProfileImage();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Welcome, {route.params.name}!</Text>

      {loading ? (
        <ActivityIndicator size="large" />
      ) : profileUrl ? (
        <Image
          source={{ uri: profileUrl }}
          style={styles.image}
        />
      ) : (
        <Text style={styles.placeholderText}>No profile picture uploaded</Text>
      )}

      <TouchableOpacity style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    marginBottom: 20,
    color: '#2a2882',
  },
  image: {
    width: screenWidth - 40,
    height: screenWidth - 40,
    borderRadius: 16,
    resizeMode: 'cover',
    marginBottom: 30,
  },
  placeholderText: {
    color: '#999',
    marginVertical: 30,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: '#2a2882',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
