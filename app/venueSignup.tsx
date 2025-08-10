import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import axios from 'axios';

const GOOGLE_API_KEY = 'AIzaSyDl72VmnmlfT1yxxuQYUnkEuoqa9AGe_Cc';

const VenueSignup = () => {
  const navigation = useNavigation();
  const [venueName, setVenueName] = useState('');
  const [venueOwner, setVenueOwner] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [venueMaxCap, setVenueMaxCap] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.length < 3) return setSuggestions([]);

      try {
        const res = await axios.get(
          'https://maps.googleapis.com/maps/api/place/autocomplete/json',
          {
            params: {
              input: query,
              key: GOOGLE_API_KEY,
              components: 'country:us',
            },
          }
        );
        setSuggestions(res.data.predictions || []);
      } catch (err) {
        console.error('Autocomplete error:', err);
        setSuggestions([]);
      }
    };

    const delay = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(delay);
  }, [query]);

  const handleSelectSuggestion = async (placeId: string) => {
    try {
      const res = await axios.get(
        'https://maps.googleapis.com/maps/api/place/details/json',
        {
          params: {
            place_id: placeId,
            key: GOOGLE_API_KEY,
            fields: 'formatted_address,geometry',
          },
        }
      );

      const result = res.data.result;
      const address = result?.formatted_address;
      const lat = result?.geometry?.location?.lat;
      const lng = result?.geometry?.location?.lng;

      if (!address || lat == null || lng == null) {
        Alert.alert('Invalid address details', 'Could not fetch full address info.');
        return;
      }

      setVenueAddress(address);
      setLatitude(lat);
      setLongitude(lng);
      setQuery(address);
      setSuggestions([]);
    } catch (err) {
      console.error('Place details error:', err);
      Alert.alert('Error', 'Could not fetch address details.');
    }
  };

  const handleVenueSubmit = async () => {
    if (!venueName || !venueOwner || !venueAddress || !venueMaxCap || latitude === null || longitude === null) {
      Alert.alert('Missing Info', 'Please fill in all fields including selecting an address.');
      return;
    }

    const venueAddressObject = {
      address: venueAddress,
      latitude,
      longitude,
    };

    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) throw new Error('No user session found');

      const { data, error } = await supabase
        .from('venues')
        .insert([{
          spotter_id: user.id,
          venue_name: venueName,
          venue_owner: venueOwner,
          venue_address: venueAddressObject,
          venue_max_cap: venueMaxCap,
          venue_profile_image: '',
          venue_secondary_images: [],
        }])
        .select();

      if (error || !data || !data[0]) throw error;

      const venueID = data[0].venue_id;

      const { error: updateError } = await supabase
        .from('spotters')
        .update({ is_venue: true, venue_id: venueID })
        .eq('id', user.id);

      if (updateError) throw updateError;

      navigation.navigate('VenuePicture', { venue_id: venueID });
    } catch (err) {
      console.error('Venue Signup Error:', err);
      Alert.alert('Error', 'Could not create venue profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Button Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Your Venue Profile</Text>

        <TextInput
          style={styles.input}
          placeholder="Venue Name"
          value={venueName}
          onChangeText={setVenueName}
          placeholderTextColor="#b4b3b3"
        />

        <TextInput
          style={styles.input}
          placeholder="Owner Name"
          value={venueOwner}
          onChangeText={setVenueOwner}
          placeholderTextColor="#b4b3b3"
        />

        <TextInput
          style={styles.input}
          placeholder="Venue Address"
          value={query}
          onChangeText={setQuery}
          placeholderTextColor="#b4b3b3"
        />

        {suggestions.map((s) => (
          <TouchableOpacity
            key={s.place_id}
            style={styles.suggestionItem}
            onPress={() => handleSelectSuggestion(s.place_id)}
          >
            <Text style={styles.suggestionText}>{s.description}</Text>
          </TouchableOpacity>
        ))}

        <TextInput
          style={styles.input}
          placeholder="Maximum Capacity"
          value={venueMaxCap}
          onChangeText={setVenueMaxCap}
          keyboardType="numeric"
          placeholderTextColor="#b4b3b3"
        />

        <TouchableOpacity
          style={[styles.button, { opacity: loading ? 0.5 : 1 }]}
          onPress={handleVenueSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 10,
    paddingHorizontal: 0,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(42, 40, 130, 0.1)',
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    color: '#2a2882',
    fontWeight: '600',
  },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 30,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Amiko-Regular',
    marginBottom: 30,
    color: '#000',
    textAlign: 'center',
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
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
  },
  suggestionText: {
    fontSize: 14,
    color: '#000',
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

export default VenueSignup;
