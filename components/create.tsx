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
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services/notificationService';
// import DatePicker from 'react-native-date-picker';

const { width } = Dimensions.get('window');

interface Artist {
  artist_id: string;
  artist_name: string;
  artist_profile_image?: string;
}

interface SelectedMember {
  artist_id: string;
  artist_name: string;
}

interface Venue {
  venue_id: string;
  venue_name: string;
  venue_address?: string;
}

interface Band {
  band_id: string;
  band_name: string;
}

interface ShowMember {
  show_member_id: string;
  show_member_type: 'artist' | 'band';
  show_member_name: string;
  show_member_position: string;
  show_member_decision: boolean;
  show_member_consensus: null | Array<{
    show_band_member_id: string;
    show_band_member_decision: boolean;
  }>;
}

interface CombinedArtistBand {
  id: string;
  name: string;
  type: 'artist' | 'band';
}

const Create = () => {
  const navigation = useNavigation();
  
  // App flow states - determines which screen to show
  const [currentFlow, setCurrentFlow] = useState<'selection' | 'band_wizard' | 'show_wizard'>('selection');
  
  // Band formation states
  const [bandName, setBandName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [currentArtist, setCurrentArtist] = useState<Artist | null>(null);
  const [isArtist, setIsArtist] = useState(false);
  
  // User type states
  const [userType, setUserType] = useState<'spotter' | 'artist' | 'venue' | null>(null);
  
  // Show creation states
  const [showVenue, setShowVenue] = useState<Venue | null>(null);
  const [showMembers, setShowMembers] = useState<ShowMember[]>([]);
  const [showDate, setShowDate] = useState('');
  const [showTime, setShowTime] = useState('');
  const [venueSearch, setVenueSearch] = useState('');
  const [venueResults, setVenueResults] = useState<Venue[]>([]);
  const [performerSearch, setPerformerSearch] = useState('');
  const [performerResults, setPerformerResults] = useState<CombinedArtistBand[]>([]);
  const [searchingVenues, setSearchingVenues] = useState(false);
  const [searchingPerformers, setSearchingPerformers] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  
  // Wizard step management
  const [currentStep, setCurrentStep] = useState(1);
  
  const totalSteps = 5;

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

      // Check if user has a venue profile
      const { data: venueData } = await supabase
        .from('venues')
        .select('venue_id, venue_name')
        .eq('spotter_id', user.id)
        .single();

      if (spotterData?.is_artist) {
        setIsArtist(true);
        setUserType('artist');
        
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
      } else if (venueData) {
        setIsArtist(false);
        setUserType('venue');
        setCurrentFlow('show_wizard'); // Venues go directly to show wizard
      } else {
        setIsArtist(false);
        setUserType('spotter');
        setCurrentFlow('show_wizard'); // Spotters go directly to show wizard
      }
    } catch (error) {
      console.error('Error checking artist status:', error);
    }
  };

  // Search for artists (band formation)
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

  // Search for venues
  useEffect(() => {
    const searchVenues = async () => {
      if (venueSearch.length < 2) {
        setVenueResults([]);
        return;
      }

      setSearchingVenues(true);
      try {
        const { data, error } = await supabase
          .from('venues')
          .select('venue_id, venue_name, venue_address')
          .ilike('venue_name', `%${venueSearch}%`)
          .order('venue_name', { ascending: true })
          .limit(20);

        if (error) {
          console.error('🔍 Venue search error:', error);
          throw error;
        }

        setVenueResults(data || []);
      } catch (error) {
        console.error('🔍 Error searching venues:', error);
        Alert.alert('Search Error', 'Could not search for venues. Please try again.');
      } finally {
        setSearchingVenues(false);
      }
    };

    const delayedSearch = setTimeout(searchVenues, 300);
    return () => clearTimeout(delayedSearch);
  }, [venueSearch]);

  // Search for performers (artists and bands combined)
  useEffect(() => {
    const searchPerformers = async () => {
      if (performerSearch.length < 2) {
        setPerformerResults([]);
        return;
      }

      setSearchingPerformers(true);
      try {
        // Search artists and bands in parallel
        const [artistsResult, bandsResult] = await Promise.all([
          supabase
            .from('artists')
            .select('artist_id, artist_name')
            .ilike('artist_name', `%${performerSearch}%`)
            .limit(10),
          supabase
            .from('bands')
            .select('band_id, band_name')
            .ilike('band_name', `%${performerSearch}%`)
            .eq('band_status', 'active')
            .limit(10)
        ]);

        if (artistsResult.error) throw artistsResult.error;
        if (bandsResult.error) throw bandsResult.error;

        // Combine and format results
        const combinedResults: CombinedArtistBand[] = [
          ...(artistsResult.data || []).map(artist => ({
            id: artist.artist_id,
            name: artist.artist_name,
            type: 'artist' as const
          })),
          ...(bandsResult.data || []).map(band => ({
            id: band.band_id,
            name: band.band_name,
            type: 'band' as const
          }))
        ];

        // Filter out already selected members and sort alphabetically
        const filteredResults = combinedResults
          .filter(performer => 
            !showMembers.some(member => member.show_member_id === performer.id)
          )
          .sort((a, b) => a.name.localeCompare(b.name));

        setPerformerResults(filteredResults);
      } catch (error) {
        console.error('🔍 Error searching performers:', error);
        Alert.alert('Search Error', 'Could not search for performers. Please try again.');
      } finally {
        setSearchingPerformers(false);
      }
    };

    const delayedSearch = setTimeout(searchPerformers, 300);
    return () => clearTimeout(delayedSearch);
  }, [performerSearch, showMembers]);

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

  // Show creation helper functions
  const addVenue = (venue: Venue) => {
    setShowVenue(venue);
    setVenueSearch('');
    setVenueResults([]);
  };

  const addPerformerToShow = (performer: CombinedArtistBand) => {
    const position = showMembers.length === 0 ? 'headliner' : (showMembers.length + 1).toString();
    const newMember: ShowMember = {
      show_member_id: performer.id,
      show_member_type: performer.type,
      show_member_name: performer.name,
      show_member_position: position,
      show_member_decision: false,
      show_member_consensus: null
    };
    setShowMembers([...showMembers, newMember]);
    setPerformerSearch('');
    setPerformerResults([]);
  };

  const removeShowMember = (memberId: string) => {
    setShowMembers(showMembers.filter(member => member.show_member_id !== memberId));
  };

  const moveShowMember = (fromIndex: number, toIndex: number) => {
    const newMembers = [...showMembers];
    const [movedMember] = newMembers.splice(fromIndex, 1);
    newMembers.splice(toIndex, 0, movedMember);
    
    // Update positions
    const updatedMembers = newMembers.map((member, index) => ({
      ...member,
      show_member_position: index === 0 ? 'headliner' : (index + 1).toString()
    }));
    
    setShowMembers(updatedMembers);
  };

  // Step navigation functions
  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 1: return !!showVenue;
      case 2: return showMembers.length >= 2;
      case 3: return !!(showDate && showTime);
      case 4: return true; // Review step
      default: return false;
    }
  };

  const handleCreateShow = async () => {
    setShowLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        Alert.alert('Error', 'You must be logged in to create a show');
        return;
      }

      // Process show members to handle band consensus
      const processedShowMembers = await Promise.all(
        showMembers.map(async (member) => {
          if (member.show_member_type === 'band') {
            // Fetch band members for this band
            const { data: bandData, error: bandError } = await supabase
              .from('bands')
              .select('band_members')
              .eq('band_id', member.show_member_id)
              .single();

            if (bandError || !bandData) {
              console.error('Error fetching band members:', bandError);
              return member; // Return as-is if error
            }

            // Create consensus array for band members
            const bandMemberConsensus = bandData.band_members.map((memberId: string) => ({
              show_band_member_id: memberId,
              show_band_member_decision: false
            }));

            // Return member with consensus array
            return {
              ...member,
              show_member_consensus: bandMemberConsensus
            };
          }
          
          // For artists, keep consensus as null
          return member;
        })
      );

      const showData = {
        show_members: processedShowMembers,
        show_venue: showVenue!.venue_id,
        show_promoter: user.id,
        show_preferred_date: showDate,
        show_preferred_time: showTime,
        show_status: 'pending'
      };

      console.log('📅 Creating show with data:', showData);

      const { data, error } = await supabase
        .from('shows')
        .insert(showData)
        .select()
        .single();

      if (error) {
        console.error('❌ Show creation failed:', error);
        throw error;
      }

      console.log('✅ Show created successfully:', data);

      // Send notifications to all performers and venue
      try {
        // Get promoter name
        const { data: promoterData } = await supabase
          .from('spotters')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        const promoterName = promoterData?.full_name || 'Show Promoter';

        // Get venue details including spotter_id
        const { data: venueData } = await supabase
          .from('venues')
          .select('venue_id, venue_name, spotter_id')
          .eq('venue_id', showVenue!.venue_id)
          .single();

        if (venueData) {
          // Send all show invitations
          const notificationResult = await notificationService.sendShowInvitations(
            data.show_id,
            user.id,
            promoterName,
            processedShowMembers,
            venueData.venue_id,
            venueData.venue_name,
            venueData.spotter_id,
            {
              venue_name: venueData.venue_name,
              preferred_date: showDate,
              preferred_time: showTime,
              show_members: processedShowMembers.map(m => ({
                name: m.show_member_name,
                type: m.show_member_type,
                position: m.show_member_position
              }))
            }
          );

          console.log('📧 Notification results:', notificationResult);
        }
      } catch (notificationError) {
        console.error('Error sending notifications:', notificationError);
        // Don't fail the whole operation if notifications fail
      }

      Alert.alert(
        'Show Created! 🎉',
        `Your show has been created and invitations have been sent to all performers and the venue.`,
        [
          {
            text: 'Create Another',
            style: 'default',
            onPress: () => {
              // Reset form
              setCurrentStep(1);
              setShowVenue(null);
              setShowMembers([]);
              setShowDate('');
              setShowTime('');
            }
          },
          {
            text: 'Done',
            style: 'cancel'
          }
        ]
      );

    } catch (error) {
      console.error('Error creating show:', error);
      Alert.alert('Error', 'Could not create show. Please try again.');
    } finally {
      setShowLoading(false);
    }
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

      const insertData = {
        band_creator: String(currentArtist.artist_id),
        band_name: String(bandName.trim()),
        band_status: String('pending'),
        band_profile_picture: String(''),
        band_secondary_pictures: [] as string[],
        band_members: memberIds,
        band_consensus: consensus
      };
      
      const { data, error } = await supabase
        .from('bands')
        .insert(insertData)
        .select()
        .single();
        
      if (error) {
        console.error('❌ Insert failed:', error);
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

  // Render selection screen for artists
  const renderSelectionScreen = () => {
    return (
      <ScrollView style={styles.selectionScrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.selectionContainer}>
          <Text style={styles.selectionTitle}>What would you like to do?</Text>
          <Text style={styles.selectionSubtitle}>Choose your next step</Text>
          
          <View style={styles.optionsContainer}>
            <TouchableOpacity 
              style={styles.optionCard}
              onPress={() => setCurrentFlow('band_wizard')}
              activeOpacity={0.8}
            >
              <View style={styles.optionIcon}>
                <Text style={styles.optionEmoji}>🎸</Text>
              </View>
              <Text style={styles.optionTitle}>Form a Band</Text>
              <Text style={styles.optionDescription}>
                Create a musical collective with other artists
              </Text>
              <View style={styles.optionButton}>
                <Text style={styles.optionButtonText}>Get Started</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.optionCard}
              onPress={() => setCurrentFlow('show_wizard')}
              activeOpacity={0.8}
            >
              <View style={styles.optionIcon}>
                <Text style={styles.optionEmoji}>🎪</Text>
              </View>
              <Text style={styles.optionTitle}>Promote a Show</Text>
              <Text style={styles.optionDescription}>
                Organize a live music event and build the lineup
              </Text>
              <View style={styles.optionButton}>
                <Text style={styles.optionButtonText}>Get Started</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  };

  // Render full-screen band wizard
  const renderBandWizard = () => (
    <ScrollView style={styles.wizardScrollContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.wizardContainer}>
        <View style={styles.wizardHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setCurrentFlow('selection')}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.wizardTitle}>Form a Band</Text>
        <Text style={styles.wizardSubtitle}>Create your musical collective</Text>
        
        {/* Band Name Step */}
        <View style={styles.wizardStepContainer}>
          <Text style={styles.wizardStepTitle}>🎸 Band Details</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Band Name</Text>
            <TextInput
              style={styles.wizardInput}
              placeholder="Enter your band name"
              placeholderTextColor="#999"
              value={bandName}
              onChangeText={setBandName}
            />
          </View>
        </View>

        {/* Members Step */}
        <View style={styles.wizardStepContainer}>
          <Text style={styles.wizardStepTitle}>🎤 Band Members ({selectedMembers.length})</Text>
          
          {/* Current Members */}
          {selectedMembers.length > 0 && (
            <View style={styles.currentMembersContainer}>
              <Text style={styles.membersListTitle}>Current Members</Text>
              {selectedMembers.map((member, index) => (
                <View key={member.artist_id} style={styles.memberCard}>
                  <View style={styles.memberCardInfo}>
                    <View style={styles.memberBadge}>
                      <Text style={styles.memberBadgeText}>
                        {index === 0 ? '👑' : '🎵'}
                      </Text>
                    </View>
                    <View style={styles.memberDetails}>
                      <Text style={styles.memberCardName}>{member.artist_name}</Text>
                      <Text style={styles.memberCardRole}>
                        {index === 0 ? 'Band Creator' : 'Member'}
                      </Text>
                    </View>
                  </View>
                  {index !== 0 && (
                    <TouchableOpacity 
                      style={styles.removeMemberButton}
                      onPress={() => removeMember(member.artist_id)}
                    >
                      <Text style={styles.removeMemberButtonText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Add Member Search */}
          <View style={styles.searchSection}>
            <Text style={styles.searchSectionTitle}>Add New Member</Text>
            <TextInput
              style={styles.wizardInput}
              placeholder="Search for artists to invite..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          
            {searching && (
              <View style={styles.searchingIndicator}>
                <ActivityIndicator size="small" color="#2a2882" />
                <Text style={styles.searchingText}>Searching artists...</Text>
              </View>
            )}
            
            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>No artists found for "{searchQuery}"</Text>
                <Text style={styles.noResultsSubtext}>Try a different search term</Text>
              </View>
            )}
            
            {searchResults.length > 0 && (
              <View style={styles.searchResultsContainer}>
                <Text style={styles.searchResultsTitle}>Available Artists</Text>
                {searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.artist_id}
                    style={styles.searchResultCard}
                    onPress={() => addMember(item)}
                  >
                    <View style={styles.searchResultInfo}>
                      <Text style={styles.searchResultName}>{item.artist_name}</Text>
                      <Text style={styles.searchResultLabel}>Artist</Text>
                    </View>
                    <View style={styles.addMemberButton}>
                      <Text style={styles.addMemberButtonText}>Add</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Create Band Action */}
        <View style={styles.wizardStepContainer}>
          <View style={styles.createBandSection}>
            <Text style={styles.createBandInfo}>
              Ready to form your band? You'll need at least 2 members including yourself.
            </Text>
            <TouchableOpacity
              style={[
                styles.wizardActionButton, 
                (!bandName.trim() || selectedMembers.length < 2) && styles.wizardActionButtonDisabled,
                loading && styles.wizardActionButtonDisabled
              ]}
              onPress={handleCreateBand}
              disabled={!bandName.trim() || selectedMembers.length < 2 || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.wizardActionButtonText}>
                  Create Band ({selectedMembers.length} members)
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  // Render full-screen show wizard
  const renderShowWizard = () => {
    const stepTitles = [
      '📍 Select Venue',
      '🎵 Build Lineup', 
      '📅 Set Date & Time',
      '👀 Review Details',
      '🎉 Create Show'
    ];

    return (
      <ScrollView style={styles.wizardScrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.wizardContainer}>
          <View style={styles.wizardHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                if (currentStep === 1 && userType === 'artist') {
                  setCurrentFlow('selection');
                } else if (currentStep > 1) {
                  prevStep();
                } else {
                  navigation.goBack();
                }
              }}
            >
              <Text style={styles.backButtonText}>
                {currentStep === 1 && userType === 'artist' ? '← Back' : currentStep > 1 ? '← Previous' : '← Back'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.wizardTitle}>Promote a Show</Text>
          <Text style={styles.wizardSubtitle}>Step {currentStep} of {totalSteps}</Text>
          
          {/* Progress Indicator */}
          <View style={styles.progressIndicator}>
            <View style={styles.progressBar}>
              <View 
                style={[styles.progressFill, { width: `${(currentStep / totalSteps) * 100}%` }]}
              />
            </View>
          </View>

          {/* Current Step Content */}
          <View style={styles.wizardStepContainer}>
            <Text style={styles.wizardStepTitle}>{stepTitles[currentStep - 1]}</Text>
            
            {currentStep === 1 && renderVenueStep()}
            {currentStep === 2 && renderLineupStep()}
            {currentStep === 3 && renderDateTimeStep()}
            {currentStep === 4 && renderReviewStep()}
            {currentStep === 5 && renderSubmitStep()}
          </View>

          {/* Navigation */}
          {currentStep < 5 && (
            <View style={styles.wizardNavigation}>
              {currentStep > 1 && (
                <TouchableOpacity 
                  style={styles.wizardNavButton} 
                  onPress={prevStep}
                >
                  <Text style={styles.wizardNavButtonText}>Previous</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={[
                  styles.wizardNavButton, 
                  styles.wizardNextButton,
                  !canProceedFromStep(currentStep) && styles.wizardNavButtonDisabled
                ]} 
                onPress={nextStep}
                disabled={!canProceedFromStep(currentStep)}
              >
                <Text style={styles.wizardNavButtonText}>
                  {currentStep === totalSteps - 1 ? 'Review' : 'Next'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  // Step 1: Venue Selection
  const renderVenueStep = () => (
    <View style={styles.stepContainer}>
      {showVenue ? (
        <View style={styles.selectedCard}>
          <View style={styles.selectedHeader}>
            <Text style={styles.selectedTitle}>✅ Venue Selected</Text>
            <TouchableOpacity style={styles.changeButton} onPress={() => setShowVenue(null)}>
              <Text style={styles.changeButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.selectedName}>{showVenue.venue_name}</Text>
          {showVenue.venue_address && (
            <Text style={styles.selectedAddress}>
              {typeof showVenue.venue_address === 'string' 
                ? showVenue.venue_address 
                : showVenue.venue_address.address || 'Address available'
              }
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.searchContainer}>
          <Text style={styles.searchInstructions}>Search for a venue to host your show</Text>
          <TextInput
            style={styles.wizardInput}
            placeholder="Type venue name..."
            placeholderTextColor="#999"
            value={venueSearch}
            onChangeText={setVenueSearch}
          />
          {searchingVenues && (
            <View style={styles.searchingIndicator}>
              <ActivityIndicator size="small" color="#2a2882" />
              <Text style={styles.searchingText}>Searching...</Text>
            </View>
          )}
          {venueResults.map((venue) => (
            <TouchableOpacity
              key={venue.venue_id}
              style={styles.resultCard}
              onPress={() => addVenue(venue)}
            >
              <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{venue.venue_name}</Text>
                {venue.venue_address && (
                  <Text style={styles.resultAddress}>
                    {typeof venue.venue_address === 'string' 
                      ? venue.venue_address 
                      : venue.venue_address.address || 'Address available'
                    }
                  </Text>
                )}
              </View>
              <View style={styles.selectButton}>
                <Text style={styles.selectButtonText}>Select</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  // Step 2: Lineup Building
  const renderLineupStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.searchInstructions}>
        Add at least 2 performers (artists or bands)
      </Text>
      
      {/* Current Lineup */}
      {showMembers.length > 0 && (
        <View style={styles.currentLineup}>
          <Text style={styles.lineupHeader}>Current Lineup ({showMembers.length})</Text>
          {showMembers.map((member, index) => (
            <View key={member.show_member_id} style={styles.lineupCard}>
              <View style={styles.lineupInfo}>
                <View style={styles.positionBadge}>
                  <Text style={styles.positionText}>
                    {member.show_member_position === 'headliner' ? '⭐' : index + 1}
                  </Text>
                </View>
                <View style={styles.memberDetails}>
                  <Text style={styles.memberName}>{member.show_member_name}</Text>
                  <Text style={styles.memberType}>
                    {member.show_member_type === 'band' ? '🎸 Band' : '🎤 Artist'} • 
                    {member.show_member_position === 'headliner' ? ' Headliner' : ` Position ${member.show_member_position}`}
                  </Text>
                </View>
              </View>
              <View style={styles.lineupActions}>
                {index > 0 && (
                  <TouchableOpacity 
                    style={styles.moveBtn}
                    onPress={() => moveShowMember(index, index - 1)}
                  >
                    <Text style={styles.moveBtnText}>↑</Text>
                  </TouchableOpacity>
                )}
                {index < showMembers.length - 1 && (
                  <TouchableOpacity 
                    style={styles.moveBtn}
                    onPress={() => moveShowMember(index, index + 1)}
                  >
                    <Text style={styles.moveBtnText}>↓</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  style={styles.removeBtn}
                  onPress={() => removeShowMember(member.show_member_id)}
                >
                  <Text style={styles.removeBtnText}>×</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Add Performers */}
      <View style={styles.addPerformersSection}>
        <Text style={styles.addPerformersTitle}>Add Performers</Text>
        <TextInput
          style={styles.wizardInput}
          placeholder="Search artists and bands..."
          placeholderTextColor="#999"
          value={performerSearch}
          onChangeText={setPerformerSearch}
        />
        {searchingPerformers && (
          <View style={styles.searchingIndicator}>
            <ActivityIndicator size="small" color="#2a2882" />
            <Text style={styles.searchingText}>Searching...</Text>
          </View>
        )}
        {performerResults.map((performer) => (
          <TouchableOpacity
            key={performer.id}
            style={styles.resultCard}
            onPress={() => addPerformerToShow(performer)}
          >
            <View style={styles.resultInfo}>
              <Text style={styles.resultName}>{performer.name}</Text>
              <Text style={styles.resultType}>
                {performer.type === 'band' ? '🎸 Band' : '🎤 Artist'}
              </Text>
            </View>
            <View style={styles.selectButton}>
              <Text style={styles.selectButtonText}>Add</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Step 3: Date & Time
  const renderDateTimeStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.searchInstructions}>
        When would you like to have this show?
      </Text>
      
      <View style={styles.dateTimeInputContainer}>
        <View style={styles.dateInputSection}>
          <Text style={styles.dateTimeLabel}>📅 Date</Text>
          <TextInput
            style={styles.dateTimeInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#999"
            value={showDate}
            onChangeText={setShowDate}
          />
          <Text style={styles.inputHelper}>Example: 2024-12-25</Text>
        </View>
        
        <View style={styles.timeInputSection}>
          <Text style={styles.dateTimeLabel}>🕐 Time</Text>
          <TextInput
            style={styles.dateTimeInput}
            placeholder="HH:MM"
            placeholderTextColor="#999"
            value={showTime}
            onChangeText={setShowTime}
          />
          <Text style={styles.inputHelper}>Example: 20:00 (8:00 PM)</Text>
        </View>
      </View>
      
      {showDate && showTime && (
        <View style={styles.datePreview}>
          <Text style={styles.previewLabel}>Show Preview:</Text>
          <Text style={styles.previewText}>📅 {showDate} at 🕐 {showTime}</Text>
        </View>
      )}
    </View>
  );

  // Step 4: Review
  const renderReviewStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.searchInstructions}>
        Review your show details before creating
      </Text>
      
      {/* Venue Review */}
      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>📍 Venue</Text>
        <Text style={styles.reviewText}>{showVenue?.venue_name}</Text>
      </View>

      {/* Lineup Review */}
      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>🎵 Lineup ({showMembers.length} performers)</Text>
        {showMembers.map((member, index) => (
          <Text key={member.show_member_id} style={styles.reviewText}>
            {index + 1}. {member.show_member_name} 
            {member.show_member_type === 'band' ? ' (Band)' : ' (Artist)'}
            {member.show_member_position === 'headliner' ? ' - Headliner' : ''}
          </Text>
        ))}
      </View>

      {/* Date Review */}
      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>📅 Date & Time</Text>
        <Text style={styles.reviewText}>
          {showDate} at {showTime}
        </Text>
      </View>

      {/* Promoter Benefits */}
      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>🚀 Promoter Benefits</Text>
        <Text style={styles.reviewText}>Building your promoter reputation</Text>
        <Text style={styles.upgradeMessage}>💎 Promote 10 successful shows and receive a promoter upgrade!</Text>
      </View>
    </View>
  );

  // Step 5: Submit
  const renderSubmitStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.submitContainer}>
        <Text style={styles.submitTitle}>🎪 Ready to Create Your Show?</Text>
        <Text style={styles.submitDescription}>
          Your show will be created and invitations sent to all performers. 
          They'll need to accept before the show becomes active.
        </Text>
        
        <TouchableOpacity
          style={[styles.finalSubmitButton, showLoading && styles.buttonDisabled]}
          onPress={handleCreateShow}
          disabled={showLoading}
        >
          {showLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.finalSubmitButtonText}>🎉 Create Show</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // Main render logic
  const renderCurrentFlow = () => {
    switch (currentFlow) {
      case 'selection':
        return renderSelectionScreen();
      case 'band_wizard':
        return renderBandWizard();
      case 'show_wizard':
        return renderShowWizard();
      default:
        return renderSelectionScreen();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {renderCurrentFlow()}
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
    padding: 16,
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
    justifyContent: 'center',
    padding: 10,
  },
  searchingText: {
    marginLeft: 8,
    color: '#6c757d',
    fontSize: 14,
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
    maxHeight: 200,
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
  buttonDisabled: {
    opacity: 0.6,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#2a2882',
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  // Wizard styles
  wizardContainer: {
    flex: 1,
  },
  progressHeader: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  wizardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2a2882',
    textAlign: 'center',
    marginBottom: 15,
  },
  progressContainer: {
    marginBottom: 15,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e9ecef',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2a2882',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2a2882',
    textAlign: 'center',
  },
  stepContent: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  stepContainer: {
    padding: 20,
    minHeight: 400,
  },
  searchInstructions: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  wizardInput: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333', // Added text color
    marginBottom: 15,
  },
  selectedCard: {
    backgroundColor: '#e8f5e8',
    borderWidth: 2,
    borderColor: '#28a745',
    borderRadius: 12,
    padding: 20,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#155724',
  },
  selectedName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#155724',
    marginBottom: 5,
  },
  selectedAddress: {
    fontSize: 14,
    color: '#6c757d',
  },
  searchContainer: {
    flex: 1,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  resultAddress: {
    fontSize: 12,
    color: '#6c757d',
  },
  resultType: {
    fontSize: 12,
    color: '#6c757d',
  },
  selectButton: {
    backgroundColor: '#2a2882',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  currentLineup: {
    marginBottom: 20,
  },
  lineupHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  lineupCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#2a2882',
  },
  lineupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberDetails: {
    flex: 1,
  },
  memberType: {
    fontSize: 12,
    color: '#6c757d',
  },
  lineupActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moveBtn: {
    backgroundColor: '#6c757d',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  moveBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  removeBtn: {
    backgroundColor: '#dc3545',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addPerformersSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  addPerformersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  dateTimeInputContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  dateInputSection: {
    marginBottom: 20,
  },
  timeInputSection: {
    marginBottom: 20,
  },
  dateTimeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  dateTimeInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333', // Added text color
    marginBottom: 5,
  },
  inputHelper: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  datePreview: {
    backgroundColor: '#e8f5e8',
    borderRadius: 10,
    padding: 15,
    marginTop: 20,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#155724',
    marginBottom: 5,
  },
  previewText: {
    fontSize: 16,
    color: '#155724',
    fontWeight: '600',
  },
  reviewSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
  },
  reviewSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2a2882',
    marginBottom: 8,
  },
  reviewText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  reviewNote: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
    marginTop: 8,
  },
  upgradeMessage: {
    fontSize: 14,
    color: '#ff00ff',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  submitContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
  },
  submitTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2a2882',
    textAlign: 'center',
    marginBottom: 15,
  },
  submitDescription: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  finalSubmitButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 25,
    shadowColor: '#28a745',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  finalSubmitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  navigationFooter: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backButton: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: '#2a2882',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  changeButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#28a745',
  },
  changeButtonText: {
    color: '#28a745',
    fontSize: 12,
    fontWeight: '600',
  },
  positionBadge: {
    backgroundColor: '#2a2882',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  positionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Selection Screen Styles
  selectionScrollContainer: {
    flex: 1,
    backgroundColor: '#2a2882',
  },
  selectionContainer: {
    flex: 1,
    padding: 20,
    minHeight: '100%',
    justifyContent: 'center',
  },
  selectionTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  selectionSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 50,
  },
  optionsContainer: {
    gap: 20,
  },
  optionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  optionIcon: {
    marginBottom: 15,
  },
  optionEmoji: {
    fontSize: 40,
  },
  optionTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  optionDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  optionButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  optionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Wizard Header Styles
  wizardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // New Wizard Styles - Following VenueAcceptanceWizard Pattern
  wizardScrollContainer: {
    flex: 1,
    backgroundColor: '#2a2882',
  },
  wizardContainer: {
    flex: 1,
    padding: 20,
    minHeight: '100%',
  },
  wizardTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    marginTop: 50,
  },
  wizardSubtitle: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  progressIndicator: {
    marginBottom: 30,
  },
  progressBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#ff00ff',
    height: '100%',
    borderRadius: 2,
  },
  wizardStepContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
  },
  wizardStepTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  // Removed duplicate wizardInput style that had white text
  currentMembersContainer: {
    marginBottom: 20,
  },
  membersListTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  memberCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberBadgeText: {
    fontSize: 20,
  },
  memberDetails: {
    flex: 1,
  },
  memberCardName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  memberCardRole: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  removeMemberButton: {
    backgroundColor: 'rgba(220, 53, 69, 0.8)',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeMemberButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchSection: {
    marginTop: 10,
  },
  searchSectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  searchingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  searchingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginLeft: 8,
  },
  noResultsContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noResultsText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  noResultsSubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    textAlign: 'center',
  },
  searchResultsContainer: {
    marginTop: 15,
  },
  searchResultsTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  searchResultCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  searchResultLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  addMemberButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addMemberButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  createBandSection: {
    alignItems: 'center',
  },
  createBandInfo: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  wizardActionButton: {
    backgroundColor: '#ff00ff',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    minWidth: 200,
  },
  wizardActionButtonDisabled: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  wizardActionButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  wizardNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 30,
  },
  wizardNavButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 80,
  },
  wizardNextButton: {
    backgroundColor: '#ff00ff',
  },
  wizardNavButtonDisabled: {
    backgroundColor: '#666',
    opacity: 0.6,
  },
  wizardNavButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default Create;