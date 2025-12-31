import React, { useEffect, useState, useRef } from "react";
import { StyleSheet, View, Dimensions, Text, TouchableOpacity, StatusBar, ScrollView, Image, Animated, Easing } from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import * as Location from "expo-location";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import ShowSpotHeader from './ShowSpotHeader';
import { notificationService } from '../services/notificationService';
import NotificationManager from './NotificationManager';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop, Path } from 'react-native-svg';
import { useOnboarding } from './OnboardingFlow';
import EmptyState from './EmptyState';

const { width, height } = Dimensions.get("window");

// Custom Venue Icon Component
const VenueIcon = () => (
  <View style={styles.venueIconContainer}>
    <Svg height="40" width="40" viewBox="0 0 40 40">
      <Defs>
        <RadialGradient id="venueGradient" cx="50%" cy="30%" rx="60%" ry="70%">
          <Stop offset="0%" stopColor="#FFD700" stopOpacity="1" />
          <Stop offset="100%" stopColor="#50C878" stopOpacity="1" />
        </RadialGradient>
      </Defs>
      <Circle
        cx="20"
        cy="20"
        r="18"
        fill="url(#venueGradient)"
        stroke="#fff"
        strokeWidth="2"
      />
      {/* Venue building icon */}
      <View style={styles.venueIconText}>
        <Text style={styles.venueIconEmoji}>🏛️</Text>
      </View>
    </Svg>
  </View>
);

const MapHome = () => {
  const navigation = useNavigation();
  const mapRef = useRef(null);
  const [region, setRegion] = useState(null);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('V'); // V for Venues (default), S for Shows, A for Artists
  const [shows, setShows] = useState([]);
  const [artists, setArtists] = useState([]);
  const [userVotes, setUserVotes] = useState({});
  const [userRatings, setUserRatings] = useState({});

  // Onboarding
  const { startTutorial, isOnboardingActive } = useOnboarding();

  // Get current user and set initial region
  useEffect(() => {
    getCurrentUser();
    fetchShows();
    fetchArtists();
    fetchShows();
    
    // Set region to Albany/Saratoga Springs area where venues are located
    const venueRegion = {
      latitude: 42.8, // Center between Albany and Saratoga Springs
      longitude: -73.77,
      latitudeDelta: 0.15, // Wide enough to see all venues
      longitudeDelta: 0.15,
    };
    
    setRegion(venueRegion);
    
    // Still request location permission for "my location" button
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
      } else {
      }
    })();
  }, []);

  // Trigger map onboarding tutorial when map is ready and data is loaded
  useEffect(() => {
    if (mapReady && !loading && venues.length > 0) {
      // Small delay to ensure everything is rendered
      const timer = setTimeout(() => {
        startTutorial('map');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [mapReady, loading, venues.length, startTutorial]);

  const getCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
  };

  const handleMyLocationPress = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const userLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

      if (mapRef.current) {
        mapRef.current.animateToRegion(userLocation, 1000);
      }
    } catch (error) {
      console.error('Error getting user location:', error);
    }
  };

  const fetchShows = async () => {
    try {
      // Fetch shows from the shows table with venue details
      const { data: allShows, error } = await supabase
        .from('shows')
        .select(`
          show_id,
          show_members,
          show_venue,
          show_status,
          show_date,
          show_voters,
          venues!show_venue(venue_name, venue_profile_image)
        `)
        .in('show_status', ['active', 'pending'])
        .order('show_date', { ascending: true });

      if (error) {
        console.error('Error fetching shows:', error);
        return;
      }

      // Process shows to gather member images
      const processedShows = await Promise.all((allShows || []).map(async (show) => {
        const memberImages = [];
        
        // Add venue image first
        if (show.venues?.venue_profile_image) {
          memberImages.push(show.venues.venue_profile_image);
        }
        
        // Get images from show members
        if (show.show_members && Array.isArray(show.show_members)) {
          for (const member of show.show_members) {
            if (member.show_member_type === 'artist' && member.show_member_id) {
              const { data: artist } = await supabase
                .from('artists')
                .select('artist_profile_image')
                .eq('artist_id', member.show_member_id)
                .single();
              
              if (artist?.artist_profile_image) {
                memberImages.push(artist.artist_profile_image);
              }
            } else if (member.show_member_type === 'band' && member.show_member_id) {
              const { data: band } = await supabase
                .from('bands')
                .select('band_profile_picture')
                .eq('band_id', member.show_member_id)
                .single();
              
              if (band?.band_profile_picture) {
                memberImages.push(band.band_profile_picture);
              }
            }
          }
        }
        
        return {
          ...show,
          show_images: memberImages
        };
      }));

      setShows(processedShows);
      
      // Update user vote info for each show if user is available
      if (processedShows) {
        const votes = {};
        for (const show of processedShows) {
          const hasVoted = currentUser ? (show.show_voters?.includes(currentUser.id) || false) : false;
          votes[show.show_id] = hasVoted;
        }
        setUserVotes(votes);
      }
    } catch (error) {
      console.error('Error fetching shows:', error);
    }
  };

  const handleVoteShow = async (showId: string) => {
    if (!currentUser) return;

    try {
      const hasVoted = userVotes[showId];
      
      if (!hasVoted) {
        // Add vote using the database function
        const { data, error } = await supabase.rpc('add_show_vote', {
          show_id: showId,
          user_id: currentUser.id
        });

        if (error) throw error;
        
        if (data) {
          setUserVotes(prev => ({ ...prev, [showId]: true }));
          // Refresh shows to get updated vote counts
          fetchShows();
        }
      }
    } catch (error) {
      console.error('Error voting for show:', error);
    }
  };

  const fetchArtists = async () => {
    try {
      // Fetch both individual artists and bands
      const { data: individualArtists, error: artistsError } = await supabase
        .from('artists')
        .select(`
          artist_id,
          artist_name,
          artist_profile_image,
          artist_secondary_images,
          main_instrument
        `)
        .order('created_at', { ascending: false });

      const { data: bands, error: bandsError } = await supabase
        .from('bands')
        .select(`
          band_id,
          band_name,
          band_profile_picture,
          band_genre
        `)
        .order('created_at', { ascending: false });

      if (artistsError) console.error('Error fetching artists:', artistsError);
      if (bandsError) console.error('Error fetching bands:', bandsError);

      // Combine and format artists and bands
      const formattedArtists = (individualArtists || []).map(artist => ({
        id: artist.artist_id,
        name: artist.artist_name,
        type: 'artist' as const,
        profile_image: artist.artist_profile_image,
        secondary_images: artist.artist_secondary_images || [],
        metadata: artist.main_instrument
      }));

      const formattedBands = (bands || []).map(band => ({
        id: band.band_id,
        name: band.band_name,
        type: 'band' as const,
        profile_image: band.band_profile_picture,
        secondary_images: [],
        metadata: band.band_genre
      }));

      const allArtists = [...formattedArtists, ...formattedBands];
      // Shuffle array for random order
      const shuffled = allArtists.sort(() => Math.random() - 0.5);
      setArtists(shuffled);
      
      // Fetch user ratings if logged in
      if (currentUser && shuffled.length > 0) {
        const ratings = {};
        for (const artist of shuffled) {
          const { data: userRating } = await supabase
            .from('individual_ratings')
            .select('rating_value')
            .eq('entity_id', artist.id)
            .eq('entity_type', artist.type)
            .eq('rater_id', currentUser.id)
            .single();
          
          ratings[artist.id] = userRating?.rating_value || null;
        }
        setUserRatings(ratings);
      }
    } catch (error) {
      console.error('Error fetching artists:', error);
    }
  };

  const handleRateArtist = async (artistId: string, artistType: 'artist' | 'band', rating: number) => {
    if (!currentUser) return;

    try {
      // Use the database function to handle rating
      const { data, error } = await supabase.rpc('rate_entity', {
        entity_id: artistId,
        entity_type: artistType,
        user_id: currentUser.id,
        rating_value: rating
      });

      if (error) throw error;

      if (data) {
        setUserRatings(prev => ({ ...prev, [artistId]: rating }));
        // No need to refresh all artists - the rating will update via props
      }
    } catch (error) {
      console.error('Error rating artist:', error);
    }
  };

  // Fetch venues from Supabase
  const fetchVenues = async () => {
    try {
      setLoading(true);
      setError(null);
      
      
      // Check authentication status
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
      }
      
      // Try multiple query approaches
      const { data, error, count } = await supabase
        .from("venues")
        .select("venue_id, venue_name, venue_address", { count: 'exact' });
        

      if (error) {
        console.error("❌ Error fetching venues:", error);
        
        // Try selecting all fields
        const { data: allData, error: allError } = await supabase
          .from("venues")
          .select("*");
          
        if (allError) {
          console.error("❌ Error with select all:", allError);
          
          // Try with an anonymous/public client to bypass RLS
          try {
            const anonClient = supabase;
            const { data: anonData, error: anonError } = await anonClient
              .from("venues")
              .select("venue_id, venue_name, venue_address");
            
            if (anonError) {
              console.error("❌ Anonymous query failed:", anonError);
              setError(`All queries failed. Last error: ${anonError.message}`);
              return;
            } else {
              return handleVenueData(anonData);
            }
          } catch (anonErr) {
            console.error("❌ Anonymous query exception:", anonErr);
            setError(`Database error: ${error.message}`);
            return;
          }
        } else {
          // Use the all data but only the fields we need
          const filteredData = allData?.map(venue => ({
            venue_id: venue.venue_id,
            venue_name: venue.venue_name,
            venue_address: venue.venue_address
          }));
          return handleVenueData(filteredData);
        }
      }

      
      // Test: Try to fetch specific venue IDs we know exist
      if (data && data.length < 3) {
        const knownVenueIDs = [
          "27c3f880-6138-4598-876e-c54c86ea3aa7", // Spac
          "6dc28860-ef22-4078-80dd-f6ee290c4cb9", // Empire live  
          "d4269526-891f-407b-a252-57364a4ca10b"  // Bogies
        ];
        
        for (const venueID of knownVenueIDs) {
          try {
            const { data: singleVenue, error: singleError } = await supabase
              .from("venues")
              .select("venue_id, venue_name, venue_address")
              .eq("venue_id", venueID)
              .single();
              
            if (singleError) {
            } else {
            }
          } catch (err) {
          }
        }
      }
      
      return handleVenueData(data);
      
    } catch (err) {
      console.error("💥 Unexpected error in fetchVenues:", err);
      setError(`Unexpected error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Separate function to handle venue data processing
  const handleVenueData = (data: any[]) => {
    if (!data || data.length === 0) {
      
      // For testing: Add a default venue marker in NYC
      const testVenue = {
        venue_id: "test-venue-1",
        venue_name: "Test Venue NYC",
        venue_address: {
          latitude: 40.7128,
          longitude: -74.0060,
          address: "Test Location, New York, NY"
        }
      };
      
      setVenues([testVenue]);
      return;
    }

    const parsedVenues = (data || []).map((v, index) => {
      
      let parsedAddress = v.venue_address;
      if (typeof v.venue_address === "string") {
        try {
          parsedAddress = JSON.parse(v.venue_address);
        } catch (e) {
          console.warn(`❌ Invalid address JSON for ${v.venue_name}:`, v.venue_address);
          return null;
        }
      }
      
      // Validate required fields
      if (!parsedAddress || 
          typeof parsedAddress.latitude !== "number" || 
          typeof parsedAddress.longitude !== "number") {
        console.warn(`❌ Invalid coordinates for ${v.venue_name}:`, parsedAddress);
        return null;
      }
      
      
      return {
        ...v,
        venue_address: parsedAddress,
      };
    }).filter(v => v !== null);

    setVenues(parsedVenues);
  };

  // Function to center map on all venues
  const centerOnVenues = () => {
    if (venues.length === 0) {
      return;
    }

    if (!mapRef.current) {
      return;
    }

    // Calculate bounds to fit all venues
    const coordinates = venues.map(venue => ({
      latitude: venue.venue_address.latitude,
      longitude: venue.venue_address.longitude,
    }));

    
    try {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: {
          top: 120,
          right: 50,
          bottom: 250, // Extra padding for bottom tab bar
          left: 50,
        },
        animated: true,
      });
    } catch (error) {
      console.error("❌ Error centering map:", error);
      
      // Fallback: set region manually
      const avgLat = coordinates.reduce((sum, coord) => sum + coord.latitude, 0) / coordinates.length;
      const avgLng = coordinates.reduce((sum, coord) => sum + coord.longitude, 0) / coordinates.length;
      
      const fallbackRegion = {
        latitude: avgLat,
        longitude: avgLng,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      };
      
      setRegion(fallbackRegion);
    }
  };

  // Handle notification press
  const handleNotificationPress = () => {
    setShowNotifications(true);
  };

  // Handle message press - navigate to messages page
  const handleMessagePress = () => {
    navigation.navigate('MessagesPage' as never);
  };


  // Load venues on component mount
  useEffect(() => {
    fetchVenues(); // Load venues immediately
  }, []);

  // Auto-center when both map is ready and venues are loaded
  useEffect(() => {
    if (venues.length > 0 && mapReady && mapRef.current) {
      setTimeout(() => {
        centerOnVenues();
      }, 500); // Shorter delay since we know map is ready
    }
  }, [venues, mapReady]);


  // Setup real-time subscription to venues
  useEffect(() => {
    let channel: any = null;

    const setupRealtime = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          return;
        }

        
        channel = supabase
          .channel("venues-realtime")
          .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "venues",
          }, payload => {
            fetchVenues(); // Re-fetch on insert/update/delete
          })
          .subscribe();

      } catch (error) {
        console.error("❌ Error setting up real-time:", error);
      }
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2a2882" />
      <ShowSpotHeader 
        showBackButton={false}
        onNotificationPress={handleNotificationPress}
        onMessagePress={handleMessagePress}
        isVenue={false}
      />
      
      {/* Notification Manager */}
      <NotificationManager
        showNotificationPage={showNotifications}
        onCloseNotificationPage={() => setShowNotifications(false)}
      />
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
        </View>
      )}
      
      {loading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>🔍 Loading venues...</Text>
        </View>
      )}
      
      {/* S/A/V Tabs Overlay - Always visible */}
      <View style={styles.tabsOverlay}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'S' && styles.activeTab]}
          onPress={() => setActiveTab('S')}
        >
          <Text style={[styles.tabText, activeTab === 'S' && styles.activeTabText]}>Shows</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'A' && styles.activeTab]}
          onPress={() => setActiveTab('A')}
        >
          <Text style={[styles.tabText, activeTab === 'A' && styles.activeTabText]}>Artists</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'V' && styles.activeTab]}
          onPress={() => setActiveTab('V')}
        >
          <Text style={[styles.tabText, activeTab === 'V' && styles.activeTabText]}>Venues</Text>
        </TouchableOpacity>
      </View>
      
      {/* Map is always rendered in the background */}
      {region && (
        <View style={styles.mapWrapper}>
          {/* Dark blue overlay to enhance the theme */}
          <View style={styles.mapOverlay} />
          <MapView
              ref={mapRef}
              style={styles.map}
              region={region}
              showsUserLocation={true}
              mapType="mutedStandard"
              userInterfaceStyle="dark"
              showsPointsOfInterest={false}
              showsBuildings={false}
              showsTraffic={false}
              onMapReady={() => {
                setMapReady(true);
              }}
            >
          {venues.length > 0 && venues.map((venue, index) => {
            const lat = venue.venue_address.latitude;
            const lng = venue.venue_address.longitude;
            
            
            // Validate coordinates one more time before rendering
            if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
              console.warn(`⚠️ Invalid coordinates for ${venue.venue_name}:`, lat, lng);
              return null;
            }
            
            
            return (
              <Marker
                key={venue.venue_id}
                coordinate={{
                  latitude: lat,
                  longitude: lng,
                }}
                onPress={() => {
                }}
              >
                <VenueIcon />
                <Callout 
                  onPress={() => {
                    console.log('Navigating to venue profile:', venue.venue_id);
                    (navigation as any).navigate('VenuePublicProfile', { venue_id: venue.venue_id });
                  }}
                >
                  <View style={styles.calloutContainer}>
                    <Text style={styles.calloutTitle}>{venue.venue_name}</Text>
                    <Text style={styles.calloutDescription}>
                      {venue.venue_address.address || "Venue Location"}
                    </Text>
                    <View style={styles.calloutButton}>
                      <Text style={styles.calloutButtonText}>View Profile</Text>
                    </View>
                  </View>
                </Callout>
              </Marker>
            );
          })}
            </MapView>
          </View>
      )}

      {/* Custom My Location Button - Only show on V (venues) tab */}
      {region && activeTab === 'V' && (
        <TouchableOpacity 
          style={styles.myLocationButton}
          onPress={handleMyLocationPress}
        >
          <Text style={styles.myLocationIcon}>📍</Text>
        </TouchableOpacity>
      )}

      {/* Tab content overlays */}
      {activeTab === 'S' ? (
        <ScrollView
          style={styles.showsFeedContainer}
          contentContainerStyle={styles.feedContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Upcoming Shows</Text>
              <View style={styles.sectionCount}>
                <Text style={styles.sectionCountText}>{shows.length}</Text>
              </View>
            </View>
            <Text style={styles.sectionSubtitle}>Vote for shows you want to see happen</Text>
          </View>

          {shows.length === 0 ? (
            <EmptyState
              icon="show"
              title="No Shows Yet"
              subtitle="Check back soon for upcoming shows in your area. Be the first to promote a show!"
              actionLabel="Promote a Show"
              onAction={() => navigation.navigate('Create' as never)}
              compact
            />
          ) : (
            shows.map((show) => (
              <ShowCard
                key={show.show_id}
                show={show}
                hasVoted={userVotes[show.show_id] || false}
                onVote={() => handleVoteShow(show.show_id)}
                onPress={() => navigation.navigate('ShowBill', { show_id: show.show_id })}
              />
            ))
          )}
        </ScrollView>
      ) : activeTab === 'A' ? (
        <ScrollView
          style={styles.artistsFeedContainer}
          contentContainerStyle={styles.feedContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Discover Artists</Text>
              <View style={styles.sectionCount}>
                <Text style={styles.sectionCountText}>{artists.length}</Text>
              </View>
            </View>
            <Text style={styles.sectionSubtitle}>Rate and follow your favorite performers</Text>
          </View>

          {artists.length === 0 ? (
            <EmptyState
              icon="music"
              title="No Artists Yet"
              subtitle="Artists and bands will appear here once they join ShowSpot"
              actionLabel="Become an Artist"
              onAction={() => navigation.navigate('ArtistSignup' as never)}
              compact
            />
          ) : (
            artists.map((artist) => (
              <ArtistCard
                key={artist.id}
                artist={artist}
                userRating={userRatings[artist.id]}
                onRate={(rating) => handleRateArtist(artist.id, artist.type, rating)}
                onPress={() => {
                  if (artist.type === 'artist') {
                    navigation.navigate('ArtistPublicProfile', { artist_id: artist.id });
                  } else {
                    navigation.navigate('BandPublicProfile', { band_id: artist.id });
                  }
                }}
              />
            ))
          )}
        </ScrollView>
      ) : null}
    </View>
  );
};

// Apple Maps with ShowSpot dark blue theme

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(42, 40, 130, 0.12)', // ShowSpot blue with transparency
    zIndex: 1,
    pointerEvents: 'none',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  errorContainer: {
    position: 'absolute',
    top: 95,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 50, 50, 0.95)',
    padding: 16,
    borderRadius: 16,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: 'rgba(255, 100, 100, 0.5)',
    shadowColor: '#ff3333',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  errorText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: 'bold',
    fontFamily: 'Amiko-Bold',
  },
  loadingContainer: {
    position: 'absolute',
    top: 95,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(10, 10, 20, 0.95)',
    padding: 16,
    borderRadius: 16,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.3)',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  loadingText: {
    color: '#ff00ff',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: 'bold',
    fontFamily: 'Amiko-Bold',
  },
  venueIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  venueIconText: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  venueIconEmoji: {
    fontSize: 16,
    textAlign: 'center',
  },
  calloutContainer: {
    width: 220,
    padding: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 12,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2a2882',
    textAlign: 'center',
    marginBottom: 6,
    fontFamily: 'Amiko-Bold',
  },
  calloutDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Amiko-Regular',
  },
  calloutButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  calloutButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'Amiko-Bold',
  },
  tabsOverlay: {
    position: 'absolute',
    top: 140, // Increased for iPhone 16 safe area + header clearance
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 10, 20, 0.92)',
    borderRadius: 28,
    padding: 5,
    zIndex: 1000,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 0, 255, 0.4)',
  },
  tab: {
    backgroundColor: 'transparent',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    marginHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: '#ff00ff',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Amiko-Bold',
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: '#fff',
    textShadowColor: 'rgba(255, 255, 255, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  feedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#f5f5f5',
  },
  feedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2a2882',
    marginBottom: 10,
  },
  feedSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  showsFeedContainer: {
    position: 'absolute',
    top: 200, // Below header and tabs (adjusted for iPhone 16)
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  feedHeaderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2a2882',
    textAlign: 'center',
    paddingVertical: 20,
    backgroundColor: 'rgba(255, 255, 255, 0)', // Fully transparent
    marginBottom: 10,
  },
  feedContentContainer: {
    paddingBottom: 120, // Space for bottom tab bar
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'Audiowide-Regular',
    textShadowColor: 'rgba(255, 0, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  sectionCount: {
    marginLeft: 10,
    backgroundColor: 'rgba(255, 0, 255, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.5)',
  },
  sectionCountText: {
    fontSize: 13,
    color: '#fff',
    fontFamily: 'Amiko-Bold',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: 'Amiko-Regular',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'Amiko-Bold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    fontFamily: 'Amiko-Regular',
    lineHeight: 20,
  },
  showCard: {
    backgroundColor: 'rgba(20, 20, 35, 0.9)',
    marginHorizontal: 15,
    marginVertical: 10,
    borderRadius: 20,
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 255, 0.15)',
  },
  showCardContent: {
    overflow: 'hidden',
    borderRadius: 20,
  },
  showImageContainer: {
    position: 'relative',
    height: 200,
  },
  showImageSlide: {
    width: width - 30,
    height: 200,
  },
  showImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e1e1e1',
  },
  showImageIndicators: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  showImageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  showImageIndicatorActive: {
    backgroundColor: '#ff00ff',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  activeBadge: {
    backgroundColor: '#00ff88',
    shadowColor: '#00ff88',
    shadowOpacity: 0.5,
  },
  pendingBadge: {
    backgroundColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOpacity: 0.5,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: 'Amiko-Bold',
    letterSpacing: 0.5,
  },
  showCardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(10, 10, 20, 0.6)',
  },
  showCardInfo: {
    flex: 1,
    marginRight: 15,
  },
  showHeadliner: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
    fontFamily: 'Amiko-Bold',
  },
  showVenue: {
    fontSize: 14,
    color: '#ff00ff',
    marginBottom: 4,
    fontFamily: 'Amiko-Regular',
  },
  showDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Amiko-Regular',
  },
  voteSection: {
    alignItems: 'center',
  },
  voteCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 6,
    fontFamily: 'Audiowide-Regular',
  },
  voteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 0, 255, 0.15)',
    borderWidth: 2,
    borderColor: '#ff00ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  voteButtonActive: {
    backgroundColor: '#ff00ff',
    shadowOpacity: 0.8,
  },
  voteButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ff00ff',
  },
  voteButtonTextActive: {
    color: '#fff',
  },
  artistsFeedContainer: {
    position: 'absolute',
    top: 200, // Below header and tabs (adjusted for iPhone 16)
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  artistCard: {
    backgroundColor: 'rgba(20, 20, 35, 0.9)',
    marginHorizontal: 15,
    marginVertical: 10,
    borderRadius: 20,
    shadowColor: '#8b00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(139, 0, 255, 0.15)',
  },
  artistCardContent: {
    overflow: 'hidden',
    borderRadius: 20,
  },
  artistImageContainer: {
    position: 'relative',
    height: 200,
  },
  artistImageSlide: {
    width: width - 30,
    height: 200,
  },
  artistImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e1e1e1',
  },
  artistImageIndicators: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  artistImageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  artistImageIndicatorActive: {
    backgroundColor: '#ff00ff',
  },
  typeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  artistBadge: {
    backgroundColor: '#ff00ff',
    shadowColor: '#ff00ff',
    shadowOpacity: 0.5,
  },
  bandBadge: {
    backgroundColor: '#8b00ff',
    shadowColor: '#8b00ff',
    shadowOpacity: 0.5,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Amiko-Bold',
    letterSpacing: 0.5,
  },
  artistCardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(10, 10, 20, 0.6)',
  },
  artistCardInfo: {
    flex: 1,
    marginRight: 15,
  },
  artistName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
    fontFamily: 'Amiko-Bold',
  },
  artistMetadata: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Amiko-Regular',
  },
  ratingSection: {
    alignItems: 'center',
  },
  ratingDisplay: {
    alignItems: 'center',
    marginBottom: 8,
  },
  averageRating: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
    fontFamily: 'Audiowide-Regular',
  },
  ratingStars: {
    flexDirection: 'row',
  },
  star: {
    fontSize: 16,
    marginHorizontal: 2,
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  starFilled: {
    color: '#FFD700',
  },
  starEmpty: {
    color: 'rgba(255, 255, 255, 0.3)',
    textShadowRadius: 0,
  },
  rateButton: {
    backgroundColor: 'rgba(139, 0, 255, 0.15)',
    borderWidth: 2,
    borderColor: '#8b00ff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#8b00ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  rateButtonActive: {
    backgroundColor: '#8b00ff',
    shadowOpacity: 0.6,
  },
  rateButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#8b00ff',
    fontFamily: 'Amiko-SemiBold',
  },
  rateButtonTextActive: {
    color: '#fff',
  },
  ratingModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  ratingModalContent: {
    backgroundColor: 'rgba(20, 20, 35, 0.95)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    minWidth: 240,
    borderWidth: 1,
    borderColor: 'rgba(139, 0, 255, 0.3)',
    shadowColor: '#8b00ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  ratingModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 18,
    fontFamily: 'Amiko-Bold',
    textAlign: 'center',
  },
  ratingModalStars: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  ratingModalClose: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  ratingModalCloseText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    fontFamily: 'Amiko-SemiBold',
  },
  ratingModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  ratingSubmitButton: {
    flex: 1,
    backgroundColor: '#ff00ff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  ratingSubmitDisabled: {
    backgroundColor: 'rgba(255, 0, 255, 0.3)',
    shadowOpacity: 0,
  },
  ratingSubmitText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: 'Amiko-Bold',
  },
  selectedRatingText: {
    color: '#FFD700',
    fontSize: 16,
    fontFamily: 'Amiko-SemiBold',
    marginBottom: 16,
  },
  starTouchable: {
    padding: 4,
  },
  modalStar: {
    fontSize: 32,
    marginHorizontal: 4,
    textShadowColor: 'rgba(255, 215, 0, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  indicatorTouchable: {
    padding: 6,
  },
  imageCountBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  imageCountText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Amiko-SemiBold',
  },
  myLocationButton: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    width: 54,
    height: 54,
    backgroundColor: 'rgba(10, 10, 20, 0.9)',
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff00ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 500,
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 255, 0.4)',
  },
  myLocationIcon: {
    fontSize: 22,
    color: '#ff00ff',
  },
});

// Helper function to get headliner from show_members
const getHeadlinerFromMembers = (showMembers) => {
  if (!showMembers || !Array.isArray(showMembers)) return 'Unknown Show';
  
  const headliner = showMembers.find(member => 
    member.show_member_position === 'headliner'
  );
  
  return headliner ? headliner.show_member_name : showMembers[0]?.show_member_name || 'Unknown Show';
};

// ShowCard Component
const ShowCard = ({ show, hasVoted, onVote, onPress }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [voteCount, setVoteCount] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollViewRef = useRef(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Use show images from members and venue
  const displayImages = show.show_images && show.show_images.length > 0
    ? show.show_images
    : ['https://via.placeholder.com/300x200/2a2882/ffffff?text=Show+Image'];

  useEffect(() => {
    // Get vote count from the show_voters array length
    const count = show.show_voters?.length || 0;
    setVoteCount(count);
  }, [show.show_voters, hasVoted]);

  const handleScroll = (event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    setCurrentImageIndex(index);
  };

  const handlePressIn = () => {
    if (!isScrolling) {
      Animated.spring(scaleAnim, {
        toValue: 0.98,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const handleCardPress = () => {
    if (!isScrolling) {
      onPress();
    }
  };

  return (
    <Animated.View style={[styles.showCard, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={handleCardPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.showCardContent}>
          {/* Image Section - Separate touch handling */}
          <View style={styles.showImageContainer}>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              nestedScrollEnabled={true}
              directionalLockEnabled={true}
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              onScrollBeginDrag={() => setIsScrolling(true)}
              onScrollEndDrag={() => setTimeout(() => setIsScrolling(false), 100)}
              onMomentumScrollEnd={() => setIsScrolling(false)}
              scrollEventThrottle={16}
            >
              {displayImages.map((image, index) => (
                <View key={index} style={styles.showImageSlide}>
                  <Image
                    source={{ uri: image }}
                    style={styles.showImage}
                    resizeMode="cover"
                  />
                </View>
              ))}
            </ScrollView>

            {/* Image Indicators */}
            {displayImages.length > 1 && (
              <View style={styles.showImageIndicators}>
                {displayImages.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => {
                      scrollViewRef.current?.scrollTo({ x: index * (width - 30), animated: true });
                      setCurrentImageIndex(index);
                    }}
                    style={styles.indicatorTouchable}
                  >
                    <View
                      style={[
                        styles.showImageIndicator,
                        currentImageIndex === index && styles.showImageIndicatorActive,
                      ]}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Status Badge */}
            <View style={[styles.statusBadge, show.show_status === 'active' ? styles.activeBadge : styles.pendingBadge]}>
              <Text style={styles.statusText}>{(show.show_status || 'pending').toUpperCase()}</Text>
            </View>

            {/* Image count indicator */}
            {displayImages.length > 1 && (
              <View style={styles.imageCountBadge}>
                <Text style={styles.imageCountText}>{currentImageIndex + 1}/{displayImages.length}</Text>
              </View>
            )}
          </View>

          {/* Content Section */}
          <View style={styles.showCardDetails}>
            <View style={styles.showCardInfo}>
              <Text style={styles.showHeadliner} numberOfLines={1}>
                {getHeadlinerFromMembers(show.show_members)}
              </Text>
              <Text style={styles.showVenue} numberOfLines={1}>
                @ {show.venues?.venue_name || show.venue_name}
              </Text>
              {show.show_date && (
                <Text style={styles.showDate}>
                  {new Date(show.show_date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </Text>
              )}
            </View>

            {/* Vote Section */}
            <View style={styles.voteSection}>
              <Text style={styles.voteCount}>{voteCount}</Text>
              <TouchableOpacity
                style={[styles.voteButton, hasVoted && styles.voteButtonActive]}
                onPress={(e) => {
                  e.stopPropagation();
                  onVote();
                }}
              >
                <Text style={[styles.voteButtonText, hasVoted && styles.voteButtonTextActive]}>
                  {hasVoted ? '✓' : '+'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ArtistCard Component
const ArtistCard = ({ artist, userRating, onRate, onPress }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollViewRef = useRef(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const allImages = [artist.profile_image, ...(artist.secondary_images || [])].filter(Boolean);
  const displayImages = allImages.length > 0 ? allImages : ['https://via.placeholder.com/300x200/2a2882/ffffff?text=No+Image'];

  useEffect(() => {
    const fetchAverageRating = async () => {
      try {
        const { data: ratingData, error } = await supabase
          .from('ratings')
          .select('current_rating')
          .eq('entity_id', artist.id)
          .eq('entity_type', artist.type)
          .single();

        if (!error && ratingData) {
          setAverageRating(ratingData.current_rating || 0);
        }
      } catch (error) {
        console.error('Error fetching average rating:', error);
      }
    };

    fetchAverageRating();
  }, [artist.id, userRating]);

  const handleScroll = (event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    setCurrentImageIndex(index);
  };

  const handlePressIn = () => {
    if (!isScrolling) {
      Animated.spring(scaleAnim, {
        toValue: 0.98,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const handleCardPress = () => {
    if (!isScrolling) {
      onPress();
    }
  };

  const handleRatingSelect = (rating) => {
    setSelectedRating(rating);
  };

  const handleRatingSubmit = () => {
    if (selectedRating > 0) {
      onRate(selectedRating);
      setShowRatingModal(false);
      setSelectedRating(0);
    }
  };

  const renderStars = (rating, interactive = false) => {
    const stars = [];
    const displayRating = interactive ? selectedRating : rating;
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          disabled={!interactive}
          onPress={() => interactive && handleRatingSelect(i)}
          style={styles.starTouchable}
        >
          <Text style={[
            interactive ? styles.modalStar : styles.star,
            i <= displayRating ? styles.starFilled : styles.starEmpty
          ]}>
            ★
          </Text>
        </TouchableOpacity>
      );
    }
    return stars;
  };

  return (
    <Animated.View style={[styles.artistCard, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={handleCardPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.artistCardContent}>
          {/* Image Section */}
          <View style={styles.artistImageContainer}>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              nestedScrollEnabled={true}
              directionalLockEnabled={true}
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              onScrollBeginDrag={() => setIsScrolling(true)}
              onScrollEndDrag={() => setTimeout(() => setIsScrolling(false), 100)}
              onMomentumScrollEnd={() => setIsScrolling(false)}
              scrollEventThrottle={16}
            >
              {displayImages.map((image, index) => (
                <View key={index} style={styles.artistImageSlide}>
                  <Image
                    source={{ uri: image }}
                    style={styles.artistImage}
                    resizeMode="cover"
                  />
                </View>
              ))}
            </ScrollView>

            {/* Image Indicators */}
            {displayImages.length > 1 && (
              <View style={styles.artistImageIndicators}>
                {displayImages.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => {
                      scrollViewRef.current?.scrollTo({ x: index * (width - 30), animated: true });
                      setCurrentImageIndex(index);
                    }}
                    style={styles.indicatorTouchable}
                  >
                    <View
                      style={[
                        styles.artistImageIndicator,
                        currentImageIndex === index && styles.artistImageIndicatorActive,
                      ]}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Type Badge */}
            <View style={[styles.typeBadge, artist.type === 'artist' ? styles.artistBadge : styles.bandBadge]}>
              <Text style={styles.typeBadgeText}>{artist.type.toUpperCase()}</Text>
            </View>

            {/* Image count indicator */}
            {displayImages.length > 1 && (
              <View style={styles.imageCountBadge}>
                <Text style={styles.imageCountText}>{currentImageIndex + 1}/{displayImages.length}</Text>
              </View>
            )}
          </View>

          {/* Content Section */}
          <View style={styles.artistCardDetails}>
            <View style={styles.artistCardInfo}>
              <Text style={styles.artistName} numberOfLines={1}>
                {artist.name}
              </Text>
              {artist.metadata && (
                <Text style={styles.artistMetadata} numberOfLines={1}>
                  {artist.metadata}
                </Text>
              )}
            </View>

            {/* Rating Section */}
            <View style={styles.ratingSection}>
              <View style={styles.ratingDisplay}>
                <Text style={styles.averageRating}>{averageRating.toFixed(1)}</Text>
                <View style={styles.ratingStars}>
                  {renderStars(Math.round(averageRating))}
                </View>
              </View>
              <TouchableOpacity
                style={[styles.rateButton, userRating && styles.rateButtonActive]}
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedRating(userRating || 0);
                  setShowRatingModal(true);
                }}
              >
                <Text style={[styles.rateButtonText, userRating && styles.rateButtonTextActive]}>
                  {userRating ? `${userRating}★` : 'Rate'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Rating Modal - Improved */}
      {showRatingModal && (
        <TouchableOpacity
          style={styles.ratingModal}
          activeOpacity={1}
          onPress={() => setShowRatingModal(false)}
        >
          <View style={styles.ratingModalContent}>
            <Text style={styles.ratingModalTitle}>Rate {artist.name}</Text>
            <View style={styles.ratingModalStars}>
              {renderStars(0, true)}
            </View>
            {selectedRating > 0 && (
              <Text style={styles.selectedRatingText}>{selectedRating} Star{selectedRating !== 1 ? 's' : ''}</Text>
            )}
            <View style={styles.ratingModalButtons}>
              <TouchableOpacity
                style={[styles.ratingSubmitButton, selectedRating === 0 && styles.ratingSubmitDisabled]}
                onPress={handleRatingSubmit}
                disabled={selectedRating === 0}
              >
                <Text style={styles.ratingSubmitText}>Submit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ratingModalClose}
                onPress={() => {
                  setShowRatingModal(false);
                  setSelectedRating(0);
                }}
              >
                <Text style={styles.ratingModalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

export default MapHome;
