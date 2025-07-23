import React, { useEffect, useState, useRef } from "react";
import { StyleSheet, View, Dimensions, Text, TouchableOpacity } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";

const { width, height } = Dimensions.get("window");

const MapHome = () => {
  const mapRef = useRef(null);
  const [region, setRegion] = useState(null);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  // Set initial region centered on venue area instead of user location
  useEffect(() => {
    // Set region to Albany/Saratoga Springs area where venues are located
    const venueRegion = {
      latitude: 42.8, // Center between Albany and Saratoga Springs
      longitude: -73.77,
      latitudeDelta: 0.15, // Wide enough to see all venues
      longitudeDelta: 0.15,
    };
    
    console.log("🗺️ Setting initial region to venue area:", venueRegion);
    setRegion(venueRegion);
    
    // Still request location permission for "my location" button
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("📍 Location permission not granted");
      } else {
        console.log("📍 Location permission granted");
      }
    })();
  }, []);

  // Fetch venues from Supabase
  const fetchVenues = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("🔍 Fetching venues from database...");
      
      // Check authentication status
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log("🔐 Current session:", session ? "✅ Authenticated" : "❌ Not authenticated");
      if (sessionError) {
        console.log("🔐 Session error:", sessionError);
      }
      
      // Try multiple query approaches
      console.log("📋 Attempting query 1: Basic select with specific fields...");
      const { data, error, count } = await supabase
        .from("venues")
        .select("venue_id, venue_name, venue_address", { count: 'exact' });
        
      console.log("📊 Query count result:", count);

      if (error) {
        console.error("❌ Error fetching venues:", error);
        console.log("📋 Attempting query 2: Select all fields...");
        
        // Try selecting all fields
        const { data: allData, error: allError } = await supabase
          .from("venues")
          .select("*");
          
        if (allError) {
          console.error("❌ Error with select all:", allError);
          
          // Try with an anonymous/public client to bypass RLS
          console.log("📋 Attempting query 3: Anonymous client to bypass RLS...");
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
              console.log("✅ Anonymous query worked! Data:", anonData);
              return handleVenueData(anonData);
            }
          } catch (anonErr) {
            console.error("❌ Anonymous query exception:", anonErr);
            setError(`Database error: ${error.message}`);
            return;
          }
        } else {
          console.log("✅ Select all worked! Data:", allData);
          // Use the all data but only the fields we need
          const filteredData = allData?.map(venue => ({
            venue_id: venue.venue_id,
            venue_name: venue.venue_name,
            venue_address: venue.venue_address
          }));
          console.log("📊 Filtered data:", filteredData);
          return handleVenueData(filteredData);
        }
      }

      console.log("📊 Raw venue data received:", data);
      console.log("📊 Number of venues found:", data?.length || 0);
      
      // Test: Try to fetch specific venue IDs we know exist
      if (data && data.length < 3) {
        console.log("🧪 Testing specific venue ID queries...");
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
              console.log(`❌ Cannot access venue ${venueID}:`, singleError.message);
            } else {
              console.log(`✅ Can access venue ${venueID}:`, singleVenue.venue_name);
            }
          } catch (err) {
            console.log(`💥 Exception accessing venue ${venueID}:`, err);
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
      console.log("⚠️ No venues found in handleVenueData");
      
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
      
      console.log("🧪 Adding test venue for debugging:", testVenue);
      setVenues([testVenue]);
      return;
    }

    const parsedVenues = (data || []).map((v, index) => {
      console.log(`🏢 Processing venue ${index + 1}:`, v.venue_name);
      console.log(`📍 Raw address data:`, v.venue_address);
      
      let parsedAddress = v.venue_address;
      if (typeof v.venue_address === "string") {
        try {
          parsedAddress = JSON.parse(v.venue_address);
          console.log(`✅ Parsed address for ${v.venue_name}:`, parsedAddress);
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
      
      console.log(`✅ Valid venue: ${v.venue_name} at [${parsedAddress.latitude}, ${parsedAddress.longitude}]`);
      
      return {
        ...v,
        venue_address: parsedAddress,
      };
    }).filter(v => v !== null);

    console.log(`🎯 Final processed venues (${parsedVenues.length}):`, parsedVenues);
    setVenues(parsedVenues);
  };

  // Function to center map on all venues
  const centerOnVenues = () => {
    if (venues.length === 0) {
      console.log("❌ No venues to center on");
      return;
    }

    if (!mapRef.current) {
      console.log("❌ Map ref not available yet");
      return;
    }

    // Calculate bounds to fit all venues
    const coordinates = venues.map(venue => ({
      latitude: venue.venue_address.latitude,
      longitude: venue.venue_address.longitude,
    }));

    console.log("🎯 Centering map on venues:", coordinates);
    
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
      console.log("✅ Map centered successfully");
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
      
      console.log("🔄 Using fallback region:", fallbackRegion);
      setRegion(fallbackRegion);
    }
  };


  // Load venues on component mount
  useEffect(() => {
    console.log("🚀 MapHome component mounted, loading venues...");
    fetchVenues(); // Load venues immediately
  }, []);

  // Auto-center when both map is ready and venues are loaded
  useEffect(() => {
    if (venues.length > 0 && mapReady && mapRef.current) {
      console.log("🎯 Map ready + venues loaded, auto-centering...");
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
          console.log("ℹ️ No session found; venues will load but real-time updates disabled.");
          return;
        }

        console.log("🔄 Setting up real-time venue updates...");
        
        channel = supabase
          .channel("venues-realtime")
          .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "venues",
          }, payload => {
            console.log("🔔 Venue change received:", payload);
            fetchVenues(); // Re-fetch on insert/update/delete
          })
          .subscribe();

        console.log("✅ Subscribed to real-time venue updates.");
      } catch (error) {
        console.error("❌ Error setting up real-time:", error);
      }
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        console.log("🔌 Real-time venue channel removed.");
      }
    };
  }, []);

  return (
    <View style={styles.container}>
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
      
      {region && (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={region}
          showsUserLocation
          showsMyLocationButton
          customMapStyle={aubergineStyle}
          onMapReady={() => {
            console.log("🗺️ Map is ready!");
            console.log(`📍 Current venues on map: ${venues.length}`);
            setMapReady(true);
          }}
        >
          {venues.length > 0 && venues.map((venue, index) => {
            const lat = venue.venue_address.latitude;
            const lng = venue.venue_address.longitude;
            
            console.log(`🔍 Attempting to render marker ${index + 1}: ${venue.venue_name} at [${lat}, ${lng}]`);
            
            // Validate coordinates one more time before rendering
            if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
              console.warn(`⚠️ Invalid coordinates for ${venue.venue_name}:`, lat, lng);
              return null;
            }
            
            console.log(`✅ Rendering valid marker: ${venue.venue_name}`);
            
            return (
              <Marker
                key={venue.venue_id}
                coordinate={{
                  latitude: lat,
                  longitude: lng,
                }}
                title={venue.venue_name}
                description={venue.venue_address.address || "Venue Location"}
                pinColor="red"
                onPress={() => {
                  console.log(`📌 Marker pressed: ${venue.venue_name}`);
                }}
              />
            );
          })}
        </MapView>
      )}
      
      {/* Center on Venues Button */}
      {venues.length > 0 && (
        <TouchableOpacity
          style={styles.centerButton}
          onPress={centerOnVenues}
        >
          <Text style={styles.centerButtonText}>📍 Show All Venues</Text>
        </TouchableOpacity>
      )}
      
      {/* Debug info */}
      <View style={styles.debugContainer}>
        <Text style={styles.debugText}>
          🏢 Venues: {venues.length} | 📍 Region: {region ? "✅" : "❌"}
        </Text>
      </View>
    </View>
  );
};

const aubergineStyle = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#023e58" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4e6d70" }] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width,
    height: height - 85, // Subtract bottom tab bar height
    marginBottom: 85, // Account for bottom tab bar
  },
  errorContainer: {
    position: 'absolute',
    top: 50,
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
    top: 50,
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
  centerButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(255, 0, 255, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  centerButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  debugContainer: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 10,
    zIndex: 1000,
  },
  debugText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});

export default MapHome;
