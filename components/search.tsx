import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../lib/supabase";
import EmptyState from "./EmptyState";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface SearchResult {
  id: string;
  name: string;
  type: 'artist' | 'band' | 'venue';
  image?: string;
  location?: string;
  memberCount?: number;
  capacity?: number;
  bio?: string;
}

const Search = () => {
  const navigation = useNavigation();
  
  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'artist' | 'band' | 'venue'>('all');
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    
    
    // Test database connection
    testDatabaseConnection();
  }, []);

  const testDatabaseConnection = async () => {
    try {
      console.log('Testing database connection...');
      
      // Test artists table
      const { data: artistsTest, error: artistsError } = await supabase
        .from('artists')
        .select('*')
        .limit(1);
      console.log('Artists test:', { data: artistsTest, error: artistsError });
      
      // Test bands table
      const { data: bandsTest, error: bandsError } = await supabase
        .from('bands')
        .select('*')
        .limit(1);
      console.log('Bands test:', { data: bandsTest, error: bandsError });
      
      // Test venues table
      const { data: venuesTest, error: venuesError } = await supabase
        .from('venues')
        .select('*')
        .limit(1);
      console.log('Venues test:', { data: venuesTest, error: venuesError });
      
    } catch (error) {
      console.error('Database connection test failed:', error);
    }
  };

  // Debounced search function
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length > 1) {
        performSearch(searchQuery.trim());
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeFilter]);

  const performSearch = async (query: string) => {
    setLoading(true);
    console.log('Performing search for:', query, 'with filter:', activeFilter);
    
    try {
      const results: SearchResult[] = [];

      // Search artists
      if (activeFilter === 'all' || activeFilter === 'artist') {
        console.log('Searching artists...');
        const { data: artists, error: artistError } = await supabase
          .from('artists')
          .select('artist_id, artist_name, artist_profile_image, main_instrument')
          .ilike('artist_name', `%${query}%`)
          .limit(10);

        console.log('Artists query result:', { artists, error: artistError });

        if (!artistError && artists) {
          const artistResults = artists.map(artist => ({
            id: artist.artist_id,
            name: artist.artist_name,
            type: 'artist' as const,
            image: artist.artist_profile_image,
            bio: artist.main_instrument ? `Plays ${artist.main_instrument}` : undefined,
          }));
          console.log('Mapped artist results:', artistResults);
          results.push(...artistResults);
        }
      }

      // Search bands
      if (activeFilter === 'all' || activeFilter === 'band') {
        console.log('Searching bands...');
        const { data: bands, error: bandError } = await supabase
          .from('bands')
          .select('band_id, band_name, band_profile_picture, band_description, band_members, band_status')
          .ilike('band_name', `%${query}%`)
          .limit(10);

        console.log('Bands query result:', { bands, error: bandError });

        if (!bandError && bands) {
          const bandResults = bands.map(band => ({
            id: band.band_id,
            name: band.band_name,
            type: 'band' as const,
            image: band.band_profile_picture,
            bio: band.band_description || `Status: ${band.band_status}`,
            memberCount: band.band_members?.length || 0,
          }));
          console.log('Mapped band results:', bandResults);
          results.push(...bandResults);
        }
      }

      // Search venues
      if (activeFilter === 'all' || activeFilter === 'venue') {
        console.log('Searching venues...');
        const { data: venues, error: venueError } = await supabase
          .from('venues')
          .select('venue_id, venue_name, venue_profile_image, venue_address, venue_max_cap, venue_owner')
          .ilike('venue_name', `%${query}%`)
          .limit(10);

        console.log('Venues query result:', { venues, error: venueError });

        if (!venueError && venues) {
          const venueResults = venues.map(venue => ({
            id: venue.venue_id,
            name: venue.venue_name,
            type: 'venue' as const,
            image: venue.venue_profile_image,
            location: venue.venue_address?.address || venue.venue_address?.city || 'Location TBD',
            capacity: parseInt(venue.venue_max_cap) || undefined,
            bio: venue.venue_owner ? `Owned by ${venue.venue_owner}` : undefined,
          }));
          console.log('Mapped venue results:', venueResults);
          results.push(...venueResults);
        }
      }

      console.log('Total search results:', results);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultPress = (result: SearchResult) => {
    // Navigate to appropriate profile
    switch (result.type) {
      case 'artist':
        navigation.navigate('ArtistPublicProfile' as never, { artist_id: result.id } as never);
        break;
      case 'band':
        navigation.navigate('BandPublicProfile' as never, { band_id: result.id } as never);
        break;
      case 'venue':
        navigation.navigate('VenuePublicProfile' as never, { venue_id: result.id } as never);
        break;
    }
  };


  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    searchRef.current?.focus();
  };

  const renderFilterButton = (filter: typeof activeFilter, label: string) => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.filterButton,
        activeFilter === filter && styles.activeFilterButton
      ]}
      onPress={() => setActiveFilter(filter)}
    >
      <Text style={[
        styles.filterButtonText,
        activeFilter === filter && styles.activeFilterButtonText
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderSearchResult = (result: SearchResult) => (
    <TouchableOpacity
      key={`${result.type}-${result.id}`}
      style={styles.resultItem}
      onPress={() => handleResultPress(result)}
    >
      <Image
        source={{
          uri: result.image || 'https://via.placeholder.com/60'
        }}
        style={styles.resultImage}
      />
      <View style={styles.resultInfo}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultName} numberOfLines={1}>
            {result.name}
          </Text>
          <View style={[
            styles.typeTag,
            { backgroundColor: 
              result.type === 'artist' ? '#ff00ff' : 
              result.type === 'band' ? '#2a2882' : '#00ff00' 
            }
          ]}>
            <Text style={styles.typeTagText}>
              {result.type.toUpperCase()}
            </Text>
          </View>
        </View>
        
        {result.location && (
          <Text style={styles.resultDetails} numberOfLines={1}>
            📍 {result.location}
          </Text>
        )}
        
        {result.memberCount !== undefined && (
          <Text style={styles.resultDetails}>
            👥 {result.memberCount} members
          </Text>
        )}
        
        {result.capacity && (
          <Text style={styles.resultDetails}>
            🏛️ Capacity: {result.capacity}
          </Text>
        )}
        
        {result.bio && (
          <Text style={styles.resultBio} numberOfLines={2}>
            {result.bio}
          </Text>
        )}
      </View>
      
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2a2882" />
      
      {/* Header with gradient */}
      <LinearGradient
        colors={["#2a2882", "#ff00ff"]}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Discover</Text>
        <Text style={styles.headerSubtitle}>Find artists, bands & venues</Text>
      </LinearGradient>

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <Animated.View style={[styles.searchSection, { opacity: fadeAnim }]}>
          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <View style={styles.searchBar}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                ref={searchRef}
                style={styles.searchInput}
                placeholder="Search artists, bands, venues..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Filter Buttons */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filtersContainer}
            contentContainerStyle={styles.filtersContent}
          >
            {renderFilterButton('all', 'All')}
            {renderFilterButton('artist', 'Artists')}
            {renderFilterButton('band', 'Bands')}
            {renderFilterButton('venue', 'Venues')}
          </ScrollView>
        </Animated.View>

        {/* Results or Recent Searches */}
        <ScrollView 
          style={styles.resultsContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ff00ff" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : searchQuery.trim().length > 1 ? (
            searchResults.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
                </Text>
                {console.log('Rendering search results:', searchResults)}
                {searchResults.map(renderSearchResult)}
              </>
            ) : (
              <EmptyState
                icon="search"
                title="No Results Found"
                subtitle={`We couldn't find anything matching "${searchQuery}". Try adjusting your search or explore different categories.`}
                actionLabel="Clear Search"
                onAction={clearSearch}
                compact
                style={styles.emptyStateContainer}
              />
            )
          ) : (
            <View style={styles.tipsContainer}>
                <Text style={styles.sectionTitle}>Search Tips</Text>
                <View style={styles.tipItem}>
                  <Text style={styles.tipEmoji}>🎤</Text>
                  <Text style={styles.tipText}>Find your favorite artists and discover new music</Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipEmoji}>🎸</Text>
                  <Text style={styles.tipText}>Explore bands and see upcoming shows</Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipEmoji}>🏛️</Text>
                  <Text style={styles.tipText}>Discover venues hosting live music events</Text>
                </View>
              </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 20 : 30,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Audiowide-Regular',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 5,
    fontFamily: 'Amiko-Regular',
  },
  content: {
    flex: 1,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchBarContainer: {
    marginBottom: 15,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontFamily: 'Amiko-Regular',
  },
  clearButton: {
    padding: 5,
  },
  clearButtonText: {
    fontSize: 18,
    color: '#666',
  },
  filtersContainer: {
    marginBottom: 5,
  },
  filtersContent: {
    paddingRight: 20,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  activeFilterButton: {
    backgroundColor: '#ff00ff',
    borderColor: '#ff00ff',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    fontFamily: 'Amiko-Regular',
  },
  activeFilterButtonText: {
    color: '#fff',
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
    fontFamily: 'Amiko-Regular',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 20,
    fontFamily: 'Amiko-Regular',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  resultInfo: {
    flex: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  resultName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
    fontFamily: 'Amiko-Regular',
  },
  typeTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeTagText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
    fontFamily: 'Amiko-Regular',
  },
  resultDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
    fontFamily: 'Amiko-Regular',
  },
  resultBio: {
    fontSize: 13,
    color: '#888',
    marginTop: 5,
    fontStyle: 'italic',
    fontFamily: 'Amiko-Regular',
  },
  chevron: {
    fontSize: 24,
    color: '#ccc',
    marginLeft: 10,
  },
  emptyStateContainer: {
    paddingTop: 40,
    paddingBottom: 40,
  },
  tipsContainer: {
    marginTop: 20,
    paddingBottom: 100,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tipEmoji: {
    fontSize: 24,
    marginRight: 15,
  },
  tipText: {
    fontSize: 15,
    color: '#666',
    flex: 1,
    fontFamily: 'Amiko-Regular',
  },
});

export default Search;