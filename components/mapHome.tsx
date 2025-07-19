import React, { useEffect, useState } from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";

const { width, height } = Dimensions.get("window");

const MapHome = () => {
  const [region, setRegion] = useState(null);
  const [venues, setVenues] = useState([]);

  // Fetch user location on load
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const userLoc = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: userLoc.coords.latitude,
        longitude: userLoc.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    })();
  }, []);

  // Fetch venues from Supabase
const fetchVenues = async () => {
  const { data, error } = await supabase
    .from("venues")
    .select("venueID, venueName, venueAddress");

  if (error) {
    console.error("Error fetching venues:", error);
    return;
  }

  const parsedVenues = (data || []).map(v => {
    let parsedAddress = v.venueAddress;
    if (typeof v.venueAddress === "string") {
      try {
        parsedAddress = JSON.parse(v.venueAddress);
      } catch (e) {
        console.warn("Invalid address JSON:", v.venueAddress);
        return null;
      }
    }
    return {
      ...v,
      venueAddress: parsedAddress,
    };
  }).filter(v =>
    v &&
    v.venueAddress &&
    typeof v.venueAddress.latitude === "number" &&
    typeof v.venueAddress.longitude === "number"
  );

  setVenues(parsedVenues);
};


  // Setup real-time subscription to venues
  useEffect(() => {
    let channel: any = null;

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn("No session found; skipping real-time setup.");
        return;
      }

      channel = supabase
        .channel("venues-realtime")
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "venues",
        }, payload => {
          console.log("Venue change received:", payload);
          fetchVenues(); // Re-fetch on insert/update/delete
        })
        .subscribe();

      console.log("Subscribed to real-time venue updates.");
      fetchVenues(); // Initial load
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        console.log("Real-time venue channel removed.");
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      {region && (
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={region}
          showsUserLocation
          showsMyLocationButton
          customMapStyle={aubergineStyle}
        >
          {venues.map(venue => (
            <Marker
              key={venue.venueID}
              coordinate={{
                latitude: venue.venueAddress.latitude,
                longitude: venue.venueAddress.longitude,
              }}
              title={venue.venueName}
              description={venue.venueAddress.address}
            />
          ))}
        </MapView>
      )}
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
    paddingBottom: 100, // Account for bottom tab bar
  },
  map: {
    width,
    height,
  },
});

export default MapHome;
