// artistSignup.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';

const ArtistSignup = () => {
  const navigation = useNavigation();
  const [artistName, setArtistName] = useState('');
  const [mainInstrument, setMainInstrument] = useState('');
  const [loading, setLoading] = useState(false);

  const handleArtistSubmit = async () => {
    if (!artistName || !mainInstrument) {
      Alert.alert('Missing Info', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) throw new Error('No user session found');

      const { data, error } = await supabase
        .from('artists')
        .insert([
          {
            spotterID: user.id,
            artistName,
            mainInstrument,
            artistProfileImage: '',
            artistSecondaryImages: [],
          },
        ])
        .select();

      if (error || !data || !data[0]) throw error;

      const artistID = data[0].artistID;
      const { error: updateError } = await supabase
        .from('spotters')
        .update({ isArtist: true, artistID })
        .eq('id', user.id);

      if (updateError) throw updateError;

      navigation.navigate('ArtistPicture', { artistID });
    } catch (err) {
      console.error('Artist Signup Error:', err);
      Alert.alert('Error', 'Could not create artist profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.inner}>
          <Text style={styles.title}>Create Your Artist Profile</Text>

          <TextInput
            style={styles.input}
            placeholder="Artist Name"
            placeholderTextColor="#b4b3b3"
            value={artistName}
            onChangeText={setArtistName}
          />

          <TextInput
            style={styles.input}
            placeholder="Main Instrument"
            placeholderTextColor="#b4b3b3"
            value={mainInstrument}
            onChangeText={setMainInstrument}
          />

          <TouchableOpacity
            style={[styles.button, { opacity: loading ? 0.5 : 1 }]}
            onPress={handleArtistSubmit}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Continue'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Amiko-Regular',
    marginBottom: 30,
    color: '#000',
  },
  input: {
    width: '100%',
    height: 40,
    backgroundColor: '#f4f4f4',
    borderColor: '#fafafa',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 15,
    fontFamily: 'Amiko-Regular',
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#fff',
    borderColor: '#ff00ff',
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#222',
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
  },
});

export default ArtistSignup;
