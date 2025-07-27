import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services/notificationService';

interface Artist {
  artist_id: string;
  artist_name: string;
  artist_profile_image?: string;
}

interface SelectedMember {
  artist_id: string;
  artist_name: string;
}

const Create = () => {
  const navigation = useNavigation();
  const [bandName, setBandName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [currentArtist, setCurrentArtist] = useState<Artist | null>(null);
  const [isArtist, setIsArtist] = useState(false);

  // Check if current user is an artist
  useEffect(() => {
    checkIfArtist();
  }, []);


  const checkIfArtist = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) return;

      // Check if user is an artist
      const { data: spotterData } = await supabase
        .from('spotters')
        .select('is_artist')
        .eq('id', user.id)
        .single();

      if (spotterData?.is_artist) {
        setIsArtist(true);
        
        // Get artist details
        const { data: artistData } = await supabase
          .from('artists')
          .select('artist_id, artist_name, artist_profile_image')
          .eq('spotter_id', user.id)
          .single();

        if (artistData) {
          setCurrentArtist(artistData);
          // Add current artist as first member
          setSelectedMembers([{
            artist_id: artistData.artist_id,
            artist_name: artistData.artist_name
          }]);
        }
      }
    } catch (error) {
      console.error('Error checking artist status:', error);
    }
  };

  // Search for artists
  useEffect(() => {
    const searchArtists = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const { data, error } = await supabase
          .from('artists')
          .select('artist_id, artist_name, artist_profile_image')
          .ilike('artist_name', `%${searchQuery}%`)
          .order('artist_name', { ascending: true })
          .limit(20);

        if (error) {
          console.error('🔍 Search error:', error);
          throw error;
        }

        // Filter out already selected members
        const filteredResults = (data || []).filter(artist => 
          !selectedMembers.some(member => member.artist_id === artist.artist_id)
        );

        setSearchResults(filteredResults);
      } catch (error) {
        console.error('🔍 Error searching artists:', error);
        Alert.alert('Search Error', 'Could not search for artists. Please try again.');
      } finally {
        setSearching(false);
      }
    };

    const delayedSearch = setTimeout(searchArtists, 300);
    return () => clearTimeout(delayedSearch);
  }, [searchQuery, selectedMembers]);

  const addMember = (artist: Artist) => {
    if (!selectedMembers.some(member => member.artist_id === artist.artist_id)) {
      setSelectedMembers([...selectedMembers, {
        artist_id: artist.artist_id,
        artist_name: artist.artist_name
      }]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeMember = (artistId: string) => {
    // Don't allow removing the creator (first member)
    if (selectedMembers[0]?.artist_id === artistId) {
      Alert.alert('Cannot Remove', 'You cannot remove the band creator');
      return;
    }
    setSelectedMembers(selectedMembers.filter(member => member.artist_id !== artistId));
  };

  const handleCreateBand = async () => {
    if (!bandName.trim()) {
      Alert.alert('Missing Info', 'Please enter a band name');
      return;
    }

    if (selectedMembers.length < 2) {
      Alert.alert('Missing Members', 'A band must have at least 2 members');
      return;
    }

    if (!currentArtist) {
      Alert.alert('Error', 'Could not find current artist information');
      return;
    }

    setLoading(true);
    try {
      // Create consensus array - creator is automatically accepted, others are pending
      const consensus = selectedMembers.map(member => ({
        member: member.artist_id,
        accepted: member.artist_id === currentArtist.artist_id
      }));

      const memberIds = selectedMembers.map(m => m.artist_id);
      
      console.log('🎵 Creating band with data:', {
        band_creator: currentArtist.artist_id,
        band_members: memberIds,
        band_name: bandName.trim(),
        band_consensus: consensus,
        band_status: 'pending'
      });

      // Let's try a direct insert but be very explicit about data types
      console.log('🎵 Attempting direct insert with explicit data types...');
      
      // Ensure memberIds is a proper UUID array
      const uuidMemberIds = memberIds.filter(id => id && typeof id === 'string');
      console.log('🎵 UUID member IDs:', uuidMemberIds);
      
      // Ensure consensus is a proper JSONB object
      const jsonConsensus = consensus.map(item => ({
        member: String(item.member),
        accepted: Boolean(item.accepted)
      }));
      console.log('🎵 JSON consensus:', jsonConsensus);
      
      const insertData = {
        band_creator: String(currentArtist.artist_id),
        band_name: String(bandName.trim()),
        band_status: String('pending'),
        band_profile_picture: String(''),
        band_secondary_pictures: [] as string[],
        band_members: uuidMemberIds,
        band_consensus: jsonConsensus
      };
      
      console.log('🎵 Final insert data:', insertData);
      
      const { data, error } = await supabase
        .from('bands')
        .insert(insertData)
        .select()
        .single();
        
      if (error) {
        console.error('❌ Insert failed:', error);
        console.error('❌ Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        // Check if it's the trigger issue
        if (error.code === '42P01' && error.message.includes('band_members')) {
          throw new Error('Database configuration error: The auto_add_creator_to_band trigger is trying to access a band_members table that does not exist. Please check the trigger function in your Supabase database.');
        }
        
        throw error;
      }
        
      console.log('✅ Band created successfully:', data);
      
      // Send band invitations to all members
      console.log('📧 Sending band invitations...');
      const invitationResult = await notificationService.sendBandInvitations(
        currentArtist.artist_id,
        currentArtist.artist_name,
        data.band_id,
        bandName.trim(),
        selectedMembers
      );
      
      if (invitationResult.success) {
        console.log('✅ All invitations sent successfully');
      } else {
        console.warn('⚠️ Some invitations failed to send:', invitationResult.error);
      }
      
      Alert.alert(
        'Band Created!', 
        `${bandName} has been created. Other members will be notified to accept their invitation.`,
        [
          {
            text: 'Add Pictures',
            onPress: () => navigation.navigate('BandPicture', { band_id: data.band_id })
          },
          {
            text: 'View Profile',
            onPress: () => navigation.navigate('BandPublicProfile', { band_id: data.band_id })
          }
        ]
      );

    } catch (error) {
      console.error('Error creating band:', error);
      Alert.alert('Error', 'Could not create band. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isArtist) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notArtistContainer}>
          <Text style={styles.notArtistTitle}>Artists Only</Text>
          <Text style={styles.notArtistText}>
            Only artists can create bands. Become an artist first to access this feature.
          </Text>
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Text style={styles.title}>Form a Band</Text>
      
      {/* Band Name */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Band Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter band name"
          placeholderTextColor="#b4b3b3"
          value={bandName}
          onChangeText={setBandName}
        />
      </View>

      {/* Members Section */}
      <View style={styles.membersSection}>
        <Text style={styles.sectionTitle}>Members ({selectedMembers.length})</Text>
        
        {/* Selected Members - Use ScrollView for this smaller list */}
        <ScrollView style={styles.selectedMembersContainer} showsVerticalScrollIndicator={false}>
          {selectedMembers.map((member, index) => (
            <View key={member.artist_id} style={styles.memberItem}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {member.artist_name}
                  {index === 0 && <Text style={styles.creatorLabel}> (You - Creator)</Text>}
                </Text>
              </View>
              {index !== 0 && (
                <TouchableOpacity 
                  style={styles.removeButton}
                  onPress={() => removeMember(member.artist_id)}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Add Member Search */}
        <View style={styles.addMemberSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for artists to add..."
            placeholderTextColor="#b4b3b3"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          
          {searching && (
            <View style={styles.searchingIndicator}>
              <ActivityIndicator size="small" color="#2a2882" />
              <Text style={styles.searchingText}>Searching...</Text>
            </View>
          )}

          {/* Search Results - Use FlatList as the main scrolling container */}
          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>No available artists found for "{searchQuery}"</Text>
              <Text style={styles.noResultsSubtext}>(Already selected artists are hidden)</Text>
            </View>
          )}
          
          {searchResults.length > 0 && (
            <View style={styles.searchResultsContainer}>
              {searchResults.map((item) => (
                <TouchableOpacity
                  key={item.artist_id}
                  style={styles.searchResultItem}
                  onPress={() => addMember(item)}
                >
                  <Text style={styles.searchResultName}>{item.artist_name}</Text>
                  <Text style={styles.addText}>+</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>


      {/* Create Button */}
      <View style={styles.createButtonContainer}>
        <TouchableOpacity
          style={[styles.createButton, loading && styles.buttonDisabled]}
          onPress={handleCreateBand}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>Create Band</Text>
          )}
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2a2882',
    textAlign: 'center',
    marginBottom: 30,
  },
  section: {
    marginBottom: 20,
  },
  membersSection: {
    flex: 1,
    marginBottom: 20,
  },
  selectedMembersContainer: {
    maxHeight: 120,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#f4f4f4',
    borderColor: '#fafafa',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  creatorLabel: {
    color: '#2a2882',
    fontWeight: '600',
  },
  removeButton: {
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
  addMemberSection: {
    marginTop: 15,
  },
  searchInput: {
    backgroundColor: '#f4f4f4',
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  searchingText: {
    marginLeft: 8,
    color: '#666',
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    marginTop: 5,
  },
  noResultsText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  noResultsSubtext: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
    fontStyle: 'italic',
  },
  searchResultsContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginTop: 5,
    maxHeight: 200, // Limit height so it doesn't take up too much space
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultName: {
    fontSize: 16,
    color: '#333',
  },
  addText: {
    fontSize: 20,
    color: '#2a2882',
    fontWeight: 'bold',
  },
  createButtonContainer: {
    paddingTop: 20,
  },
  createButton: {
    backgroundColor: '#2a2882',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#2a2882',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  notArtistContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  notArtistTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2a2882',
    marginBottom: 15,
    textAlign: 'center',
  },
  notArtistText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
});

export default Create;