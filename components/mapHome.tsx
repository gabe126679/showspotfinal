import React, { useEffect, useState, useRef } from "react";
import { StyleSheet, View, Dimensions, Text, TouchableOpacity, StatusBar, ScrollView, Image } from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import * as Location from "expo-location";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import ShowSpotHeader from './ShowSpotHeader';
import { notificationService } from '../services/notificationService';
import NotificationManager from './NotificationManager';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

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
          <Text style={[styles.tabText, activeTab === 'S' && styles.activeTabText]}>S</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'A' && styles.activeTab]}
          onPress={() => setActiveTab('A')}
        >
          <Text style={[styles.tabText, activeTab === 'A' && styles.activeTabText]}>A</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'V' && styles.activeTab]}
          onPress={() => setActiveTab('V')}
        >
          <Text style={[styles.tabText, activeTab === 'V' && styles.activeTabText]}>V</Text>
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
        <ScrollView style={styles.showsFeedContainer}>
          {shows.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No shows available</Text>
            </View>
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
        <ScrollView style={styles.artistsFeedContainer}>
          {artists.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No artists or bands available</Text>
            </View>
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
    top: 95, // Account for header height (85px) + small margin
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 0, 0, 0.9)',
    padding: 15,
    borderRadius: 10,
    zIndex: 1000,
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  loadingContainer: {
    position: 'absolute',
    top: 95, // Account for header height (85px) + small margin
    left: 20,
    right: 20,
    backgroundColor: 'rgba(42, 40, 130, 0.9)',
    padding: 15,
    borderRadius: 10,
    zIndex: 1000,
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
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
    width: 200,
    padding: 10,
    alignItems: 'center',
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2a2882',
    textAlign: 'center',
    marginBottom: 5,
  },
  calloutDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  calloutButton: {
    backgroundColor: '#ff00ff',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
  },
  calloutButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tabsOverlay: {
    position: 'absolute',
    top: 190, // Moved down another 20px
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(42, 40, 130, 0.95)',
    borderRadius: 20,
    padding: 2,
    height: 36,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tab: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 2,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: '#ff00ff',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
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
    top: 230, // Below header and tabs
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  showCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Slightly transparent white
    marginHorizontal: 15,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  showCardContent: {
    overflow: 'hidden',
    borderRadius: 12,
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
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: '#50C878',
  },
  pendingBadge: {
    backgroundColor: '#FFD700',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  showCardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  showCardInfo: {
    flex: 1,
    marginRight: 15,
  },
  showHeadliner: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2a2882',
    marginBottom: 4,
  },
  showVenue: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  showDate: {
    fontSize: 12,
    color: '#999',
  },
  voteSection: {
    alignItems: 'center',
  },
  voteCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2a2882',
    marginBottom: 5,
  },
  voteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#ff00ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voteButtonActive: {
    backgroundColor: '#ff00ff',
  },
  voteButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff00ff',
  },
  voteButtonTextActive: {
    color: '#fff',
  },
  artistsFeedContainer: {
    position: 'absolute',
    top: 230, // Below header and tabs
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent', // Artists feed transparent like S tab
  },
  artistCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Slightly transparent white
    marginHorizontal: 15,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  artistCardContent: {
    overflow: 'hidden',
    borderRadius: 12,
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
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  artistBadge: {
    backgroundColor: '#FF6B35',
  },
  bandBadge: {
    backgroundColor: '#8E44AD',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  artistCardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  artistCardInfo: {
    flex: 1,
    marginRight: 15,
  },
  artistName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2a2882',
    marginBottom: 4,
  },
  artistMetadata: {
    fontSize: 14,
    color: '#666',
  },
  ratingSection: {
    alignItems: 'center',
  },
  ratingDisplay: {
    alignItems: 'center',
    marginBottom: 8,
  },
  averageRating: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2a2882',
    marginBottom: 4,
  },
  ratingStars: {
    flexDirection: 'row',
  },
  star: {
    fontSize: 14,
    marginHorizontal: 1,
  },
  starFilled: {
    color: '#FFD700',
  },
  starEmpty: {
    color: '#ddd',
  },
  rateButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#ff00ff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rateButtonActive: {
    backgroundColor: '#ff00ff',
  },
  rateButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ff00ff',
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  ratingModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    minWidth: 200,
  },
  ratingModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2a2882',
    marginBottom: 15,
  },
  ratingModalStars: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  ratingModalClose: {
    backgroundColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  ratingModalCloseText: {
    color: '#666',
    fontWeight: '600',
  },
  myLocationButton: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    width: 50,
    height: 50,
    backgroundColor: 'rgba(42, 40, 130, 0.95)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 500,
  },
  myLocationIcon: {
    fontSize: 20,
    color: '#fff',
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
  const scrollViewRef = useRef(null);
  
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

  return (
    <TouchableOpacity style={styles.showCard} onPress={onPress}>
      <View style={styles.showCardContent}>
        {/* Image Section */}
        <View style={styles.showImageContainer}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
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
                <View
                  key={index}
                  style={[
                    styles.showImageIndicator,
                    currentImageIndex === index && styles.showImageIndicatorActive,
                  ]}
                />
              ))}
            </View>
          )}
          
          {/* Status Badge */}
          <View style={[styles.statusBadge, show.show_status === 'active' ? styles.activeBadge : styles.pendingBadge]}>
            <Text style={styles.statusText}>{(show.show_status || 'pending').toUpperCase()}</Text>
          </View>
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
                {new Date(show.show_date).toLocaleDateString()}
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
  );
};

// ArtistCard Component
const ArtistCard = ({ artist, userRating, onRate, onPress }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const scrollViewRef = useRef(null);
  
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

  const renderStars = (rating, interactive = false) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          disabled={!interactive}
          onPress={() => interactive && onRate(i)}
        >
          <Text style={[
            styles.star,
            i <= rating ? styles.starFilled : styles.starEmpty
          ]}>
            ★
          </Text>
        </TouchableOpacity>
      );
    }
    return stars;
  };

  return (
    <TouchableOpacity style={styles.artistCard} onPress={onPress}>
      <View style={styles.artistCardContent}>
        {/* Image Section */}
        <View style={styles.artistImageContainer}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
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
                <View
                  key={index}
                  style={[
                    styles.artistImageIndicator,
                    currentImageIndex === index && styles.artistImageIndicatorActive,
                  ]}
                />
              ))}
            </View>
          )}
          
          {/* Type Badge */}
          <View style={[styles.typeBadge, artist.type === 'artist' ? styles.artistBadge : styles.bandBadge]}>
            <Text style={styles.typeBadgeText}>{artist.type.toUpperCase()}</Text>
          </View>
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
                setShowRatingModal(true);
              }}
            >
              <Text style={[styles.rateButtonText, userRating && styles.rateButtonTextActive]}>
                {userRating ? userRating : 'Rate'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {/* Rating Modal */}
      {showRatingModal && (
        <View style={styles.ratingModal}>
          <View style={styles.ratingModalContent}>
            <Text style={styles.ratingModalTitle}>Rate {artist.name}</Text>
            <View style={styles.ratingModalStars}>
              {renderStars(0, true)}
            </View>
            <TouchableOpacity
              style={styles.ratingModalClose}
              onPress={() => setShowRatingModal(false)}
            >
              <Text style={styles.ratingModalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default MapHome;
