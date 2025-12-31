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
  Modal,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

// Route params type for pre-selected artist/band promotion
type CreateRouteParams = {
  Create: {
    preSelectedArtist?: {
      artist_id: string;
      artist_name: string;
    };
    preSelectedBand?: {
      band_id: string;
      band_name: string;
    };
  };
};
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services/notificationService';
import { ToastManager } from './Toast';
import { colors, fonts, spacing, borderRadius } from '../lib/theme';

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
  const route = useRoute<RouteProp<CreateRouteParams, 'Create'>>();

  // Get pre-selected artist/band from navigation params (for "Promote this artist" feature)
  const preSelectedArtist = route.params?.preSelectedArtist;
  const preSelectedBand = route.params?.preSelectedBand;

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

  // Date/Time picker states
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Wizard step management
  const [currentStep, setCurrentStep] = useState(1);
  const [bandStep, setBandStep] = useState(1);

  const totalSteps = 5;
  const totalBandSteps = 3;

  // Check if current user is an artist
  useEffect(() => {
    checkIfArtist();
  }, []);

  // Handle pre-selected artist/band from "Promote this artist/band" navigation
  useEffect(() => {
    if (preSelectedArtist) {
      // Prevent duplicate additions
      const alreadyAdded = showMembers.some(m => m.show_member_id === preSelectedArtist.artist_id);
      if (alreadyAdded) return;

      // Start show wizard with pre-selected performer
      setCurrentFlow('show_wizard');
      setCurrentStep(1); // Start at venue selection

      const newMember: ShowMember = {
        show_member_id: preSelectedArtist.artist_id,
        show_member_type: 'artist',
        show_member_name: preSelectedArtist.artist_name,
        show_member_position: 'headliner',
        show_member_decision: false,
        show_member_consensus: null
      };
      setShowMembers([newMember]);
      ToastManager.success(`Promoting ${preSelectedArtist.artist_name}! Now select a venue.`);
    } else if (preSelectedBand) {
      // Prevent duplicate additions
      const alreadyAdded = showMembers.some(m => m.show_member_id === preSelectedBand.band_id);
      if (alreadyAdded) return;

      // Start show wizard with pre-selected performer
      setCurrentFlow('show_wizard');
      setCurrentStep(1); // Start at venue selection

      const newMember: ShowMember = {
        show_member_id: preSelectedBand.band_id,
        show_member_type: 'band',
        show_member_name: preSelectedBand.band_name,
        show_member_position: 'headliner',
        show_member_decision: false,
        show_member_consensus: null
      };
      setShowMembers([newMember]);
      ToastManager.success(`Promoting ${preSelectedBand.band_name}! Now select a venue.`);
    }
  }, [preSelectedArtist?.artist_id, preSelectedBand?.band_id]);

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
        ToastManager.error('Could not search for artists. Please try again.');
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
        ToastManager.error('Could not search for venues. Please try again.');
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
        ToastManager.error('Could not search for performers. Please try again.');
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
      ToastManager.info('You cannot remove the band creator');
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

  // Band wizard step navigation
  const nextBandStep = () => {
    if (bandStep < totalBandSteps) {
      setBandStep(bandStep + 1);
    }
  };

  const prevBandStep = () => {
    if (bandStep > 1) {
      setBandStep(bandStep - 1);
    }
  };

  const canProceedFromBandStep = (step: number): boolean => {
    switch (step) {
      case 1: return bandName.trim().length >= 2;
      case 2: return selectedMembers.length >= 2;
      default: return false;
    }
  };

  const resetBandWizard = () => {
    setBandStep(1);
    setBandName('');
    setSelectedMembers(currentArtist ? [{
      artist_id: currentArtist.artist_id,
      artist_name: currentArtist.artist_name
    }] : []);
    setSearchQuery('');
    setSearchResults([]);
  };

  const resetShowWizard = () => {
    setCurrentStep(1);
    setShowVenue(null);
    setShowMembers([]);
    setShowDate('');
    setShowTime('');
    setVenueSearch('');
    setPerformerSearch('');
    setSelectedDate(new Date());
    setSelectedTime(new Date());
  };

  // Date/Time picker handlers
  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
      // Format as YYYY-MM-DD
      const formattedDate = date.toISOString().split('T')[0];
      setShowDate(formattedDate);
    }
  };

  const handleTimeChange = (event: any, time?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (time) {
      setSelectedTime(time);
      // Format as HH:MM
      const hours = time.getHours().toString().padStart(2, '0');
      const minutes = time.getMinutes().toString().padStart(2, '0');
      setShowTime(`${hours}:${minutes}`);
    }
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDisplayTime = (time: Date) => {
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleCreateShow = async () => {
    setShowLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        ToastManager.error('You must be logged in to create a show');
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

      ToastManager.success('Show created! Invitations sent to all performers and venue.');

      // Show options dialog after brief delay
      setTimeout(() => {
        Alert.alert(
          'Show Created!',
          'What would you like to do next?',
          [
            {
              text: 'Create Another',
              onPress: () => {
                resetShowWizard();
              }
            },
            {
              text: 'View Show',
              onPress: () => {
                resetShowWizard();
                setCurrentFlow('selection');
                navigation.navigate('ShowBill' as never, { show_id: data.show_id } as never);
              }
            },
            {
              text: 'Done',
              style: 'cancel',
              onPress: () => {
                resetShowWizard();
                setCurrentFlow('selection');
              }
            }
          ]
        );
      }, 500);

    } catch (error) {
      console.error('Error creating show:', error);
      ToastManager.error('Could not create show. Please try again.');
    } finally {
      setShowLoading(false);
    }
  };

  const handleCreateBand = async () => {
    if (!bandName.trim()) {
      ToastManager.warning('Please enter a band name');
      return;
    }

    if (selectedMembers.length < 2) {
      ToastManager.warning('A band must have at least 2 members');
      return;
    }

    if (!currentArtist) {
      ToastManager.error('Could not find current artist information');
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
        console.error('Insert failed:', error);
        throw error;
      }

      // Send band invitations to all members
      const invitationResult = await notificationService.sendBandInvitations(
        currentArtist.artist_id,
        currentArtist.artist_name,
        data.band_id,
        bandName.trim(),
        selectedMembers
      );

      if (!invitationResult.success) {
        console.warn('Some invitations failed to send:', invitationResult.error);
      }

      ToastManager.success(`${bandName} has been created! Invitations sent to all members.`);

      // Navigate to band profile after a brief delay
      setTimeout(() => {
        Alert.alert(
          'Band Created!',
          'What would you like to do next?',
          [
            {
              text: 'Add Pictures',
              onPress: () => {
                resetBandWizard();
                setCurrentFlow('selection');
                navigation.navigate('BandPicture' as never, { band_id: data.band_id } as never);
              }
            },
            {
              text: 'View Profile',
              onPress: () => {
                resetBandWizard();
                setCurrentFlow('selection');
                navigation.navigate('BandPublicProfile' as never, { band_id: data.band_id } as never);
              }
            },
            {
              text: 'Done',
              style: 'cancel',
              onPress: () => {
                resetBandWizard();
                setCurrentFlow('selection');
              }
            }
          ]
        );
      }, 500);

    } catch (error) {
      console.error('Error creating band:', error);
      ToastManager.error('Could not create band. Please try again.');
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

  // Band Wizard Step 1: Band Details
  const renderBandDetailsStep = () => (
    <View style={styles.bandStepContent}>
      <View style={styles.bandInputGroup}>
        <Text style={styles.bandInputLabel}>Band Name</Text>
        <TextInput
          style={styles.bandTextInput}
          placeholder="Enter your band name..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={bandName}
          onChangeText={setBandName}
          autoFocus
        />
        {bandName.trim().length > 0 && bandName.trim().length < 2 && (
          <Text style={styles.bandInputHint}>Name must be at least 2 characters</Text>
        )}
      </View>

      <View style={styles.bandTipBox}>
        <Text style={styles.bandTipTitle}>Tips for a great band name:</Text>
        <Text style={styles.bandTipText}>• Make it memorable and unique</Text>
        <Text style={styles.bandTipText}>• Consider your genre and style</Text>
        <Text style={styles.bandTipText}>• Check if the name is available online</Text>
      </View>
    </View>
  );

  // Band Wizard Step 2: Add Members
  const renderBandMembersStep = () => (
    <View style={styles.bandStepContent}>
      {/* Current Members List */}
      <View style={styles.bandMembersList}>
        <Text style={styles.bandMembersHeader}>
          Band Members ({selectedMembers.length})
        </Text>
        {selectedMembers.map((member, index) => (
          <View key={member.artist_id} style={styles.bandMemberCard}>
            <View style={styles.bandMemberInfo}>
              <View style={[
                styles.bandMemberBadge,
                index === 0 && styles.bandMemberBadgeCreator
              ]}>
                <Text style={styles.bandMemberBadgeText}>
                  {index === 0 ? '👑' : '🎵'}
                </Text>
              </View>
              <View style={styles.bandMemberDetails}>
                <Text style={styles.bandMemberName}>{member.artist_name}</Text>
                <Text style={styles.bandMemberRole}>
                  {index === 0 ? 'Band Creator (You)' : 'Invited Member'}
                </Text>
              </View>
            </View>
            {index !== 0 && (
              <TouchableOpacity
                style={styles.bandMemberRemove}
                onPress={() => removeMember(member.artist_id)}
              >
                <Text style={styles.bandMemberRemoveText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* Search Section */}
      <View style={styles.bandSearchSection}>
        <Text style={styles.bandSearchTitle}>Invite Artists</Text>
        <TextInput
          style={styles.bandTextInput}
          placeholder="Search for artists to invite..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {searching && (
          <View style={styles.bandSearchLoading}>
            <ActivityIndicator size="small" color={colors.primary.magenta} />
            <Text style={styles.bandSearchLoadingText}>Searching...</Text>
          </View>
        )}

        {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
          <View style={styles.bandSearchEmpty}>
            <Text style={styles.bandSearchEmptyText}>
              No artists found for "{searchQuery}"
            </Text>
          </View>
        )}

        {searchResults.length > 0 && (
          <View style={styles.bandSearchResults}>
            {searchResults.slice(0, 5).map((artist) => (
              <TouchableOpacity
                key={artist.artist_id}
                style={styles.bandSearchResultCard}
                onPress={() => addMember(artist)}
              >
                <View style={styles.bandSearchResultInfo}>
                  <Text style={styles.bandSearchResultName}>{artist.artist_name}</Text>
                  <Text style={styles.bandSearchResultType}>Artist</Text>
                </View>
                <View style={styles.bandSearchResultAdd}>
                  <Text style={styles.bandSearchResultAddText}>+ Add</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {selectedMembers.length < 2 && (
        <View style={styles.bandMinMembersHint}>
          <Text style={styles.bandMinMembersText}>
            Add at least {2 - selectedMembers.length} more member{selectedMembers.length === 1 ? '' : 's'} to continue
          </Text>
        </View>
      )}
    </View>
  );

  // Band Wizard Step 3: Review & Create
  const renderBandReviewStep = () => (
    <View style={styles.bandStepContent}>
      <View style={styles.bandReviewCard}>
        <Text style={styles.bandReviewLabel}>Band Name</Text>
        <Text style={styles.bandReviewValue}>{bandName}</Text>
      </View>

      <View style={styles.bandReviewCard}>
        <Text style={styles.bandReviewLabel}>Members ({selectedMembers.length})</Text>
        {selectedMembers.map((member, index) => (
          <View key={member.artist_id} style={styles.bandReviewMember}>
            <Text style={styles.bandReviewMemberIcon}>
              {index === 0 ? '👑' : '🎵'}
            </Text>
            <Text style={styles.bandReviewMemberName}>{member.artist_name}</Text>
            <Text style={styles.bandReviewMemberRole}>
              {index === 0 ? 'Creator' : 'Member'}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.bandReviewInfo}>
        <Text style={styles.bandReviewInfoTitle}>What happens next?</Text>
        <Text style={styles.bandReviewInfoText}>
          • Your band will be created with a "pending" status
        </Text>
        <Text style={styles.bandReviewInfoText}>
          • Invitations will be sent to all members
        </Text>
        <Text style={styles.bandReviewInfoText}>
          • Once all members accept, the band becomes active
        </Text>
        <Text style={styles.bandReviewInfoText}>
          • You can add band photos and music after creation
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.bandCreateButton,
          loading && styles.bandCreateButtonDisabled
        ]}
        onPress={handleCreateBand}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Text style={styles.bandCreateButtonText}>Create Band</Text>
            <Text style={styles.bandCreateButtonSubtext}>
              {selectedMembers.length} members • Invitations will be sent
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  // Render full-screen band wizard
  const renderBandWizard = () => {
    const stepTitles = ['Band Details', 'Add Members', 'Review & Create'];
    const stepIcons = ['🎸', '🎤', '✨'];

    return (
      <LinearGradient
        colors={[colors.primary.deepPurple, colors.primary.purple, colors.primary.magenta]}
        style={styles.bandWizardGradient}
      >
        <ScrollView
          style={styles.bandWizardScroll}
          contentContainerStyle={styles.bandWizardScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.bandWizardHeader}>
            <TouchableOpacity
              style={styles.bandWizardBackBtn}
              onPress={() => {
                if (bandStep > 1) {
                  prevBandStep();
                } else {
                  resetBandWizard();
                  setCurrentFlow('selection');
                }
              }}
            >
              <Text style={styles.bandWizardBackText}>
                {bandStep > 1 ? '← Previous' : '← Back'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Title Section */}
          <View style={styles.bandWizardTitleSection}>
            <Text style={styles.bandWizardEmoji}>{stepIcons[bandStep - 1]}</Text>
            <Text style={styles.bandWizardTitle}>Form a Band</Text>
            <Text style={styles.bandWizardSubtitle}>
              Step {bandStep} of {totalBandSteps}: {stepTitles[bandStep - 1]}
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.bandProgressContainer}>
            <View style={styles.bandProgressBar}>
              <View
                style={[
                  styles.bandProgressFill,
                  { width: `${(bandStep / totalBandSteps) * 100}%` }
                ]}
              />
            </View>
            <View style={styles.bandProgressSteps}>
              {stepTitles.map((title, index) => (
                <View
                  key={index}
                  style={[
                    styles.bandProgressDot,
                    index < bandStep && styles.bandProgressDotActive,
                    index === bandStep - 1 && styles.bandProgressDotCurrent
                  ]}
                >
                  <Text style={[
                    styles.bandProgressDotText,
                    index < bandStep && styles.bandProgressDotTextActive
                  ]}>
                    {index + 1}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Step Content */}
          <View style={styles.bandStepContainer}>
            {bandStep === 1 && renderBandDetailsStep()}
            {bandStep === 2 && renderBandMembersStep()}
            {bandStep === 3 && renderBandReviewStep()}
          </View>

          {/* Navigation Footer */}
          {bandStep < 3 && (
            <View style={styles.bandNavFooter}>
              <TouchableOpacity
                style={[
                  styles.bandNavButton,
                  styles.bandNavButtonPrimary,
                  !canProceedFromBandStep(bandStep) && styles.bandNavButtonDisabled
                ]}
                onPress={nextBandStep}
                disabled={!canProceedFromBandStep(bandStep)}
              >
                <Text style={styles.bandNavButtonText}>
                  {bandStep === 2 ? 'Review Band' : 'Continue'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    );
  };

  // Render full-screen show wizard
  const renderShowWizard = () => {
    const stepTitles = ['Select Venue', 'Build Lineup', 'Set Date & Time', 'Review Details', 'Create Show'];
    const stepIcons = ['📍', '🎵', '📅', '👀', '🎉'];

    return (
      <LinearGradient
        colors={[colors.primary.deepPurple, colors.primary.purple, colors.primary.magenta]}
        style={styles.showWizardGradient}
      >
        <ScrollView
          style={styles.showWizardScroll}
          contentContainerStyle={styles.showWizardScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.showWizardHeader}>
            <TouchableOpacity
              style={styles.showWizardBackBtn}
              onPress={() => {
                if (currentStep === 1 && userType === 'artist') {
                  resetShowWizard();
                  setCurrentFlow('selection');
                } else if (currentStep > 1) {
                  prevStep();
                } else {
                  navigation.goBack();
                }
              }}
            >
              <Text style={styles.showWizardBackText}>
                {currentStep > 1 ? '← Previous' : '← Back'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Title Section */}
          <View style={styles.showWizardTitleSection}>
            <Text style={styles.showWizardEmoji}>{stepIcons[currentStep - 1]}</Text>
            <Text style={styles.showWizardTitle}>Promote a Show</Text>
            <Text style={styles.showWizardSubtitle}>
              Step {currentStep} of {totalSteps}: {stepTitles[currentStep - 1]}
            </Text>
          </View>

          {/* Progress Bar with Dots */}
          <View style={styles.showProgressContainer}>
            <View style={styles.showProgressBar}>
              <View
                style={[
                  styles.showProgressFill,
                  { width: `${(currentStep / totalSteps) * 100}%` }
                ]}
              />
            </View>
            <View style={styles.showProgressSteps}>
              {stepTitles.map((title, index) => (
                <View
                  key={index}
                  style={[
                    styles.showProgressDot,
                    index < currentStep && styles.showProgressDotActive,
                    index === currentStep - 1 && styles.showProgressDotCurrent
                  ]}
                >
                  <Text style={[
                    styles.showProgressDotText,
                    index < currentStep && styles.showProgressDotTextActive
                  ]}>
                    {index + 1}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Step Content */}
          <View style={styles.showStepContainer}>
            <Text style={styles.showStepTitle}>{stepIcons[currentStep - 1]} {stepTitles[currentStep - 1]}</Text>

            {currentStep === 1 && renderVenueStep()}
            {currentStep === 2 && renderLineupStep()}
            {currentStep === 3 && renderDateTimeStep()}
            {currentStep === 4 && renderReviewStep()}
            {currentStep === 5 && renderSubmitStep()}
          </View>

          {/* Navigation Footer */}
          {currentStep < 5 && (
            <View style={styles.showNavFooter}>
              <TouchableOpacity
                style={[
                  styles.showNavButton,
                  styles.showNavButtonPrimary,
                  !canProceedFromStep(currentStep) && styles.showNavButtonDisabled
                ]}
                onPress={nextStep}
                disabled={!canProceedFromStep(currentStep)}
              >
                <Text style={styles.showNavButtonText}>
                  {currentStep === 4 ? 'Ready to Submit' : 'Continue'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    );
  };

  // Step 1: Venue Selection
  const renderVenueStep = () => (
    <View style={styles.showStepContent}>
      {showVenue ? (
        <View style={styles.showSelectedCard}>
          <View style={styles.showSelectedHeader}>
            <Text style={styles.showSelectedTitle}>✅ Venue Selected</Text>
            <TouchableOpacity style={styles.showChangeButton} onPress={() => setShowVenue(null)}>
              <Text style={styles.showChangeButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.showSelectedName}>{showVenue.venue_name}</Text>
          {showVenue.venue_address && (
            <Text style={styles.showSelectedAddress}>
              {typeof showVenue.venue_address === 'string'
                ? showVenue.venue_address
                : showVenue.venue_address.address || 'Address available'
              }
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.showSearchContainer}>
          <Text style={styles.showSearchInstructions}>Search for a venue to host your show</Text>
          <TextInput
            style={styles.showTextInput}
            placeholder="Type venue name..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={venueSearch}
            onChangeText={setVenueSearch}
          />
          {searchingVenues && (
            <View style={styles.showSearchLoading}>
              <ActivityIndicator size="small" color={colors.primary.magenta} />
              <Text style={styles.showSearchLoadingText}>Searching...</Text>
            </View>
          )}
          {venueResults.length === 0 && venueSearch.length >= 2 && !searchingVenues && (
            <View style={styles.showSearchEmpty}>
              <Text style={styles.showSearchEmptyText}>No venues found for "{venueSearch}"</Text>
            </View>
          )}
          {venueResults.map((venue) => (
            <TouchableOpacity
              key={venue.venue_id}
              style={styles.showResultCard}
              onPress={() => addVenue(venue)}
            >
              <View style={styles.showResultInfo}>
                <Text style={styles.showResultName}>{venue.venue_name}</Text>
                {venue.venue_address && (
                  <Text style={styles.showResultAddress}>
                    {typeof venue.venue_address === 'string'
                      ? venue.venue_address
                      : venue.venue_address.address || 'Address available'
                    }
                  </Text>
                )}
              </View>
              <View style={styles.showSelectButton}>
                <Text style={styles.showSelectButtonText}>Select</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  // Step 2: Lineup Building
  const renderLineupStep = () => (
    <View style={styles.showStepContent}>
      <Text style={styles.showSearchInstructions}>
        Add at least 2 performers (artists or bands)
      </Text>

      {/* Current Lineup */}
      {showMembers.length > 0 && (
        <View style={styles.showLineupList}>
          <Text style={styles.showLineupHeader}>Current Lineup ({showMembers.length})</Text>
          {showMembers.map((member, index) => (
            <View key={`lineup-${member.show_member_type}-${member.show_member_id}`} style={styles.showLineupCard}>
              <View style={styles.showLineupInfo}>
                <View style={[
                  styles.showPositionBadge,
                  member.show_member_position === 'headliner' && styles.showPositionBadgeHeadliner
                ]}>
                  <Text style={styles.showPositionText}>
                    {member.show_member_position === 'headliner' ? '⭐' : index + 1}
                  </Text>
                </View>
                <View style={styles.showLineupDetails}>
                  <Text style={styles.showLineupName}>{member.show_member_name}</Text>
                  <Text style={styles.showLineupType}>
                    {member.show_member_type === 'band' ? '🎸 Band' : '🎤 Artist'}
                    {member.show_member_position === 'headliner' ? ' • Headliner' : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.showLineupActions}>
                {index > 0 && (
                  <TouchableOpacity
                    style={styles.showMoveBtn}
                    onPress={() => moveShowMember(index, index - 1)}
                  >
                    <Text style={styles.showMoveBtnText}>↑</Text>
                  </TouchableOpacity>
                )}
                {index < showMembers.length - 1 && (
                  <TouchableOpacity
                    style={styles.showMoveBtn}
                    onPress={() => moveShowMember(index, index + 1)}
                  >
                    <Text style={styles.showMoveBtnText}>↓</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.showRemoveBtn}
                  onPress={() => removeShowMember(member.show_member_id)}
                >
                  <Text style={styles.showRemoveBtnText}>×</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Minimum members hint */}
      {showMembers.length < 2 && (
        <View style={styles.showMinHint}>
          <Text style={styles.showMinHintText}>
            Add {2 - showMembers.length} more performer{showMembers.length === 1 ? '' : 's'} to continue
          </Text>
        </View>
      )}

      {/* Add Performers Search */}
      <View style={styles.showAddPerformers}>
        <Text style={styles.showAddPerformersTitle}>Add Performers</Text>
        <TextInput
          style={styles.showTextInput}
          placeholder="Search artists and bands..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={performerSearch}
          onChangeText={setPerformerSearch}
        />
        {searchingPerformers && (
          <View style={styles.showSearchLoading}>
            <ActivityIndicator size="small" color={colors.primary.magenta} />
            <Text style={styles.showSearchLoadingText}>Searching...</Text>
          </View>
        )}
        {performerResults.map((performer) => (
          <TouchableOpacity
            key={`${performer.type}-${performer.id}`}
            style={styles.showResultCard}
            onPress={() => addPerformerToShow(performer)}
          >
            <View style={styles.showResultInfo}>
              <Text style={styles.showResultName}>{performer.name}</Text>
              <Text style={styles.showResultType}>
                {performer.type === 'band' ? '🎸 Band' : '🎤 Artist'}
              </Text>
            </View>
            <View style={styles.showSelectButton}>
              <Text style={styles.showSelectButtonText}>+ Add</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Step 3: Date & Time
  const renderDateTimeStep = () => (
    <View style={styles.showStepContent}>
      <Text style={styles.showSearchInstructions}>
        When would you like to have this show?
      </Text>

      <View style={styles.showDateTimeContainer}>
        {/* Date Picker */}
        <View style={styles.showDateInputSection}>
          <Text style={styles.showDateTimeLabel}>📅 Date</Text>
          <TouchableOpacity
            style={styles.showPickerButton}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.showPickerButtonText,
              !showDate && styles.showPickerButtonPlaceholder
            ]}>
              {showDate ? formatDisplayDate(selectedDate) : 'Tap to select date'}
            </Text>
            <Text style={styles.showPickerIcon}>📅</Text>
          </TouchableOpacity>
        </View>

        {/* Time Picker */}
        <View style={styles.showTimeInputSection}>
          <Text style={styles.showDateTimeLabel}>🕐 Time</Text>
          <TouchableOpacity
            style={styles.showPickerButton}
            onPress={() => setShowTimePicker(true)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.showPickerButtonText,
              !showTime && styles.showPickerButtonPlaceholder
            ]}>
              {showTime ? formatDisplayTime(selectedTime) : 'Tap to select time'}
            </Text>
            <Text style={styles.showPickerIcon}>🕐</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Preview when both selected */}
      {showDate && showTime && (
        <View style={styles.showDatePreview}>
          <Text style={styles.showDatePreviewLabel}>Show scheduled for:</Text>
          <Text style={styles.showDatePreviewText}>
            {formatDisplayDate(selectedDate)}
          </Text>
          <Text style={styles.showDatePreviewTime}>
            at {formatDisplayTime(selectedTime)}
          </Text>
        </View>
      )}

      {/* Date Picker Modal/Component */}
      {showDatePicker && (
        Platform.OS === 'ios' ? (
          <Modal
            transparent
            animationType="slide"
            visible={showDatePicker}
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.pickerModalOverlay}>
              <View style={styles.pickerModalContent}>
                <View style={styles.pickerModalHeader}>
                  <Text style={styles.pickerModalTitle}>Select Date</Text>
                  <TouchableOpacity
                    style={styles.pickerModalDone}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.pickerModalDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                  textColor="#000"
                  style={styles.iosPicker}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )
      )}

      {/* Time Picker Modal/Component */}
      {showTimePicker && (
        Platform.OS === 'ios' ? (
          <Modal
            transparent
            animationType="slide"
            visible={showTimePicker}
            onRequestClose={() => setShowTimePicker(false)}
          >
            <View style={styles.pickerModalOverlay}>
              <View style={styles.pickerModalContent}>
                <View style={styles.pickerModalHeader}>
                  <Text style={styles.pickerModalTitle}>Select Time</Text>
                  <TouchableOpacity
                    style={styles.pickerModalDone}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <Text style={styles.pickerModalDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={selectedTime}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                  textColor="#000"
                  style={styles.iosPicker}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={selectedTime}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )
      )}
    </View>
  );

  // Step 4: Review
  const renderReviewStep = () => (
    <View style={styles.showStepContent}>
      <Text style={styles.showSearchInstructions}>
        Review your show details before creating
      </Text>

      {/* Venue Review */}
      <View style={styles.showReviewCard}>
        <Text style={styles.showReviewLabel}>📍 Venue</Text>
        <Text style={styles.showReviewValue}>{showVenue?.venue_name}</Text>
      </View>

      {/* Lineup Review */}
      <View style={styles.showReviewCard}>
        <Text style={styles.showReviewLabel}>🎵 Lineup ({showMembers.length} performers)</Text>
        {showMembers.map((member, index) => (
          <View key={`review-${member.show_member_type}-${member.show_member_id}`} style={styles.showReviewMember}>
            <Text style={styles.showReviewMemberIcon}>
              {member.show_member_position === 'headliner' ? '⭐' : `${index + 1}.`}
            </Text>
            <Text style={styles.showReviewMemberName}>{member.show_member_name}</Text>
            <Text style={styles.showReviewMemberType}>
              {member.show_member_type === 'band' ? 'Band' : 'Artist'}
            </Text>
          </View>
        ))}
      </View>

      {/* Date Review */}
      <View style={styles.showReviewCard}>
        <Text style={styles.showReviewLabel}>📅 Date & Time</Text>
        <Text style={styles.showReviewValue}>{showDate} at {showTime}</Text>
      </View>

      {/* Promoter Benefits */}
      <View style={styles.showPromoterInfo}>
        <Text style={styles.showPromoterTitle}>🚀 Promoter Benefits</Text>
        <Text style={styles.showPromoterText}>
          Building your promoter reputation with every show!
        </Text>
        <Text style={styles.showPromoterUpgrade}>
          💎 Promote 10 successful shows for a promoter upgrade!
        </Text>
      </View>
    </View>
  );

  // Step 5: Submit
  const renderSubmitStep = () => (
    <View style={styles.showStepContent}>
      <View style={styles.showSubmitContainer}>
        <Text style={styles.showSubmitEmoji}>🎪</Text>
        <Text style={styles.showSubmitTitle}>Ready to Create Your Show?</Text>
        <Text style={styles.showSubmitDescription}>
          Your show will be created and invitations sent to all performers and the venue.
          They'll need to accept before the show becomes active.
        </Text>

        <View style={styles.showSubmitSummary}>
          <Text style={styles.showSubmitSummaryText}>
            📍 {showVenue?.venue_name}
          </Text>
          <Text style={styles.showSubmitSummaryText}>
            🎵 {showMembers.length} performers
          </Text>
          <Text style={styles.showSubmitSummaryText}>
            📅 {showDate} at {showTime}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.showCreateButton,
            showLoading && styles.showCreateButtonDisabled
          ]}
          onPress={handleCreateShow}
          disabled={showLoading}
        >
          {showLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.showCreateButtonText}>Create Show</Text>
              <Text style={styles.showCreateButtonSubtext}>
                Invitations will be sent automatically
              </Text>
            </>
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

  // ============================================
  // NEW BAND WIZARD STYLES
  // ============================================
  bandWizardGradient: {
    flex: 1,
  },
  bandWizardScroll: {
    flex: 1,
  },
  bandWizardScrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  bandWizardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  bandWizardBackBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  bandWizardBackText: {
    color: '#fff',
    fontSize: fonts.size.sm,
    fontWeight: '600',
  },
  bandWizardTitleSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  bandWizardEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  bandWizardTitle: {
    fontSize: fonts.size['2xl'],
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: fonts.family.display,
    marginBottom: spacing.xs,
  },
  bandWizardSubtitle: {
    fontSize: fonts.size.md,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: fonts.family.regular,
  },

  // Progress Indicator
  bandProgressContainer: {
    marginBottom: spacing.xl,
  },
  bandProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  bandProgressFill: {
    height: '100%',
    backgroundColor: colors.primary.magenta,
    borderRadius: 2,
  },
  bandProgressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  bandProgressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bandProgressDotActive: {
    backgroundColor: colors.primary.magenta,
  },
  bandProgressDotCurrent: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: colors.primary.magenta,
  },
  bandProgressDotText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fonts.size.sm,
    fontWeight: 'bold',
  },
  bandProgressDotTextActive: {
    color: '#fff',
  },

  // Step Container
  bandStepContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  bandStepContent: {
    // Container for step content
  },

  // Band Details Step (Step 1)
  bandInputGroup: {
    marginBottom: spacing.lg,
  },
  bandInputLabel: {
    color: '#fff',
    fontSize: fonts.size.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
    fontFamily: fonts.family.semiBold,
  },
  bandTextInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: borderRadius.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fonts.size.base,
    color: '#fff',
    fontFamily: fonts.family.regular,
  },
  bandInputHint: {
    color: colors.status.warning,
    fontSize: fonts.size.sm,
    marginTop: spacing.xs,
  },
  bandTipBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.base,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary.magenta,
  },
  bandTipTitle: {
    color: '#fff',
    fontSize: fonts.size.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  bandTipText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: fonts.size.sm,
    marginBottom: spacing.xs,
  },

  // Band Members Step (Step 2)
  bandMembersList: {
    marginBottom: spacing.lg,
  },
  bandMembersHeader: {
    color: '#fff',
    fontSize: fonts.size.md,
    fontWeight: '600',
    marginBottom: spacing.md,
    fontFamily: fonts.family.semiBold,
  },
  bandMemberCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.base,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bandMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bandMemberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  bandMemberBadgeCreator: {
    backgroundColor: colors.primary.magenta,
  },
  bandMemberBadgeText: {
    fontSize: 18,
  },
  bandMemberDetails: {
    flex: 1,
  },
  bandMemberName: {
    color: '#fff',
    fontSize: fonts.size.base,
    fontWeight: '600',
    marginBottom: 2,
  },
  bandMemberRole: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fonts.size.sm,
  },
  bandMemberRemove: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(220, 53, 69, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bandMemberRemoveText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Search Section
  bandSearchSection: {
    marginTop: spacing.md,
  },
  bandSearchTitle: {
    color: '#fff',
    fontSize: fonts.size.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  bandSearchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  bandSearchLoadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: spacing.sm,
    fontSize: fonts.size.sm,
  },
  bandSearchEmpty: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  bandSearchEmptyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fonts.size.sm,
    textAlign: 'center',
  },
  bandSearchResults: {
    marginTop: spacing.md,
  },
  bandSearchResultCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.base,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bandSearchResultInfo: {
    flex: 1,
  },
  bandSearchResultName: {
    color: '#fff',
    fontSize: fonts.size.base,
    fontWeight: '600',
  },
  bandSearchResultType: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fonts.size.sm,
  },
  bandSearchResultAdd: {
    backgroundColor: colors.primary.magenta,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.base,
  },
  bandSearchResultAddText: {
    color: '#fff',
    fontSize: fonts.size.sm,
    fontWeight: '600',
  },
  bandMinMembersHint: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderRadius: borderRadius.base,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  bandMinMembersText: {
    color: colors.status.warning,
    fontSize: fonts.size.sm,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Review Step (Step 3)
  bandReviewCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.base,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bandReviewLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fonts.size.sm,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bandReviewValue: {
    color: '#fff',
    fontSize: fonts.size.xl,
    fontWeight: 'bold',
    fontFamily: fonts.family.display,
  },
  bandReviewMember: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  bandReviewMemberIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  bandReviewMemberName: {
    flex: 1,
    color: '#fff',
    fontSize: fonts.size.base,
  },
  bandReviewMemberRole: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: fonts.size.sm,
  },
  bandReviewInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.base,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary.magenta,
  },
  bandReviewInfoTitle: {
    color: '#fff',
    fontSize: fonts.size.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  bandReviewInfoText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: fonts.size.sm,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  bandCreateButton: {
    backgroundColor: colors.status.success,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    shadowColor: colors.status.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bandCreateButtonDisabled: {
    opacity: 0.6,
  },
  bandCreateButtonText: {
    color: '#fff',
    fontSize: fonts.size.lg,
    fontWeight: 'bold',
    fontFamily: fonts.family.bold,
  },
  bandCreateButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: fonts.size.sm,
    marginTop: spacing.xs,
  },

  // Navigation Footer
  bandNavFooter: {
    paddingTop: spacing.md,
  },
  bandNavButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.base,
    alignItems: 'center',
  },
  bandNavButtonPrimary: {
    backgroundColor: colors.primary.magenta,
  },
  bandNavButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    opacity: 0.6,
  },
  bandNavButtonText: {
    color: '#fff',
    fontSize: fonts.size.base,
    fontWeight: 'bold',
  },

  // ============================================
  // POLISHED SHOW WIZARD STYLES
  // ============================================
  showWizardGradient: {
    flex: 1,
  },
  showWizardScroll: {
    flex: 1,
  },
  showWizardScrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  showWizardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  showWizardBackBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  showWizardBackText: {
    color: '#fff',
    fontSize: fonts.size.sm,
    fontWeight: '600',
  },
  showWizardTitleSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  showWizardEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  showWizardTitle: {
    fontSize: fonts.size['2xl'],
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: fonts.family.display,
    marginBottom: spacing.xs,
  },
  showWizardSubtitle: {
    fontSize: fonts.size.md,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: fonts.family.regular,
  },

  // Show Progress Indicator
  showProgressContainer: {
    marginBottom: spacing.xl,
  },
  showProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  showProgressFill: {
    height: '100%',
    backgroundColor: colors.primary.magenta,
    borderRadius: 2,
  },
  showProgressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  showProgressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  showProgressDotActive: {
    backgroundColor: colors.primary.magenta,
  },
  showProgressDotCurrent: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: colors.primary.magenta,
  },
  showProgressDotText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fonts.size.xs,
    fontWeight: 'bold',
  },
  showProgressDotTextActive: {
    color: '#fff',
  },

  // Show Step Container
  showStepContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  showStepTitle: {
    color: '#fff',
    fontSize: fonts.size.lg,
    fontWeight: 'bold',
    marginBottom: spacing.lg,
    textAlign: 'center',
    fontFamily: fonts.family.semiBold,
  },

  // Show Navigation Footer
  showNavFooter: {
    paddingTop: spacing.md,
  },
  showNavButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.base,
    alignItems: 'center',
  },
  showNavButtonPrimary: {
    backgroundColor: colors.primary.magenta,
  },
  showNavButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    opacity: 0.6,
  },
  showNavButtonText: {
    color: '#fff',
    fontSize: fonts.size.base,
    fontWeight: 'bold',
  },

  // Show Step Content Styles
  showStepContent: {
    // Container for step content
  },
  showSearchContainer: {
    // Search container
  },
  showSearchInstructions: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: fonts.size.md,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  showTextInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: borderRadius.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fonts.size.base,
    color: '#fff',
    marginBottom: spacing.md,
  },
  showSearchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  showSearchLoadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: spacing.sm,
    fontSize: fonts.size.sm,
  },
  showSearchEmpty: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  showSearchEmptyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fonts.size.sm,
    textAlign: 'center',
  },

  // Selected Venue Card
  showSelectedCard: {
    backgroundColor: 'rgba(40, 167, 69, 0.2)',
    borderWidth: 2,
    borderColor: colors.status.success,
    borderRadius: borderRadius.base,
    padding: spacing.md,
  },
  showSelectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  showSelectedTitle: {
    color: colors.status.success,
    fontSize: fonts.size.md,
    fontWeight: '600',
  },
  showChangeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.base,
  },
  showChangeButtonText: {
    color: '#fff',
    fontSize: fonts.size.sm,
    fontWeight: '600',
  },
  showSelectedName: {
    color: '#fff',
    fontSize: fonts.size.lg,
    fontWeight: 'bold',
  },
  showSelectedAddress: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: fonts.size.sm,
    marginTop: spacing.xs,
  },

  // Result Cards
  showResultCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.base,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  showResultInfo: {
    flex: 1,
  },
  showResultName: {
    color: '#fff',
    fontSize: fonts.size.base,
    fontWeight: '600',
  },
  showResultAddress: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fonts.size.sm,
    marginTop: 2,
  },
  showResultType: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fonts.size.sm,
  },
  showSelectButton: {
    backgroundColor: colors.primary.magenta,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.base,
  },
  showSelectButtonText: {
    color: '#fff',
    fontSize: fonts.size.sm,
    fontWeight: '600',
  },

  // Lineup Styles
  showLineupList: {
    marginBottom: spacing.lg,
  },
  showLineupHeader: {
    color: '#fff',
    fontSize: fonts.size.md,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  showLineupCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.base,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary.magenta,
  },
  showLineupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  showPositionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  showPositionBadgeHeadliner: {
    backgroundColor: colors.primary.magenta,
  },
  showPositionText: {
    color: '#fff',
    fontSize: fonts.size.sm,
    fontWeight: 'bold',
  },
  showLineupDetails: {
    flex: 1,
  },
  showLineupName: {
    color: '#fff',
    fontSize: fonts.size.base,
    fontWeight: '600',
  },
  showLineupType: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fonts.size.sm,
  },
  showLineupActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  showMoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  showMoveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  showRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(220, 53, 69, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  showRemoveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  showMinHint: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderRadius: borderRadius.base,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  showMinHintText: {
    color: colors.status.warning,
    fontSize: fonts.size.sm,
    textAlign: 'center',
    fontWeight: '500',
  },
  showAddPerformers: {
    marginTop: spacing.md,
  },
  showAddPerformersTitle: {
    color: '#fff',
    fontSize: fonts.size.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },

  // Date/Time Styles
  showDateTimeContainer: {
    // Container
  },
  showDateInputSection: {
    marginBottom: spacing.lg,
  },
  showTimeInputSection: {
    marginBottom: spacing.md,
  },
  showDateTimeLabel: {
    color: '#fff',
    fontSize: fonts.size.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  showInputHelper: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: fonts.size.sm,
    fontStyle: 'italic',
    marginTop: -spacing.sm,
  },
  showDatePreview: {
    backgroundColor: 'rgba(40, 167, 69, 0.2)',
    borderRadius: borderRadius.base,
    padding: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.status.success,
  },
  showDatePreviewLabel: {
    color: colors.status.success,
    fontSize: fonts.size.sm,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  showDatePreviewText: {
    color: '#fff',
    fontSize: fonts.size.lg,
    fontWeight: 'bold',
  },
  showDatePreviewTime: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: fonts.size.md,
    marginTop: spacing.xs,
  },

  // Picker Button Styles
  showPickerButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: borderRadius.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  showPickerButtonText: {
    color: '#fff',
    fontSize: fonts.size.base,
    flex: 1,
  },
  showPickerButtonPlaceholder: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  showPickerIcon: {
    fontSize: 20,
    marginLeft: spacing.sm,
  },

  // Picker Modal Styles (iOS)
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: 30,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  pickerModalTitle: {
    fontSize: fonts.size.lg,
    fontWeight: '600',
    color: '#333',
  },
  pickerModalDone: {
    backgroundColor: colors.primary.magenta,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.base,
  },
  pickerModalDoneText: {
    color: '#fff',
    fontSize: fonts.size.base,
    fontWeight: '600',
  },
  iosPicker: {
    height: 200,
  },

  // Review Styles
  showReviewCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.base,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  showReviewLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fonts.size.sm,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  showReviewValue: {
    color: '#fff',
    fontSize: fonts.size.lg,
    fontWeight: 'bold',
  },
  showReviewMember: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  showReviewMemberIcon: {
    color: '#fff',
    fontSize: fonts.size.sm,
    width: 24,
  },
  showReviewMemberName: {
    flex: 1,
    color: '#fff',
    fontSize: fonts.size.base,
  },
  showReviewMemberType: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: fonts.size.sm,
  },
  showPromoterInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.base,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary.magenta,
  },
  showPromoterTitle: {
    color: '#fff',
    fontSize: fonts.size.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  showPromoterText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: fonts.size.sm,
    marginBottom: spacing.xs,
  },
  showPromoterUpgrade: {
    color: colors.primary.magenta,
    fontSize: fonts.size.sm,
    fontWeight: '600',
    marginTop: spacing.sm,
  },

  // Submit Step Styles
  showSubmitContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  showSubmitEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  showSubmitTitle: {
    color: '#fff',
    fontSize: fonts.size.xl,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.md,
    fontFamily: fonts.family.display,
  },
  showSubmitDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: fonts.size.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  showSubmitSummary: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.base,
    padding: spacing.md,
    marginBottom: spacing.xl,
    width: '100%',
  },
  showSubmitSummaryText: {
    color: '#fff',
    fontSize: fonts.size.base,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  showCreateButton: {
    backgroundColor: colors.status.success,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    shadowColor: colors.status.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
  },
  showCreateButtonDisabled: {
    opacity: 0.6,
  },
  showCreateButtonText: {
    color: '#fff',
    fontSize: fonts.size.lg,
    fontWeight: 'bold',
    fontFamily: fonts.family.bold,
  },
  showCreateButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: fonts.size.sm,
    marginTop: spacing.xs,
  },
});

export default Create;