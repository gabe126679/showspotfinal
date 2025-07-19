import React from "react";
import { StyleSheet, View, Image, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "../context/userContext";
import { LinearGradient } from 'expo-linear-gradient';
import HomeIcon from "../assets/home-icon.svg";
import SearchIcon from "../assets/search-icon.svg";
import PlayerIcon from "../assets/player-icon.svg";
import CreateIcon from "../assets/create-icon.svg";
import ProfileIcon from "../assets/profile-icon.svg";
import SwipeupIcon from "../assets/swipe-up-icon.svg";

const Profile = () => {
  const navigation = useNavigation();
  const { user, loading } = useUser();

  const name = user?.full_name || "Loading...";
  const profileImage = user?.spotter_profile_picture;

  return (
    <SafeAreaView style={styles.spotterProfile}>
      <View style={styles.view}>
        {/* Profile Header */}
        <View style={[styles.profileHeader, styles.profileLayout]}>
          <View style={[styles.userStatus, styles.userPosition]}>
            <Text style={[styles.artist, styles.venuePosition]}>Artist</Text>
          </View>
          <LinearGradient
            style={[styles.userStatus1, styles.userPosition]}
            colors={["#ff00ff", "#2a2882"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          >
            <Text style={styles.spotter}>Spotter</Text>
          </LinearGradient>
          <View style={[styles.userStatus2, styles.userPosition]}>
            <Text style={[styles.venue, styles.venuePosition]}>Venue</Text>
          </View>
        </View>

        {/* Profile Picture */}
        <View style={[styles.spotterProfilePicture, styles.swipeUpIconPosition]}>
          {profileImage ? (
            <Image
              style={styles.BackgroundProfileImage}
              resizeMode="cover"
              source={{ uri: profileImage }}
            />
          ) : (
            <View style={[styles.placeholderImage, styles.BackgroundProfileImage]} />
          )}
          <View style={[styles.name, styles.iconLayout]}>
            <Text style={styles.placeholderImage}>{name}</Text>
          </View>
          <SwipeupIcon style={{ ...styles.swipeUpIcon, ...styles.swipeUpIconPosition }} width={393} height={18} />
        </View>

        {/* Footer */}
        <View style={[styles.footerProfile, styles.profileLayout]}>
          <TouchableOpacity onPress={() => navigation.navigate("Map" as never)} style={[styles.homeIcon, styles.iconLayout]}>
            <HomeIcon width={60} height={60} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Search" as never)} style={[styles.searchIcon, styles.iconLayout]}>
            <SearchIcon width={60} height={60} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Create" as never)} style={[styles.createIcon, styles.iconLayout]}>
            <CreateIcon width={60} height={60} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Player" as never)} style={[styles.playerIcon, styles.iconLayout]}>
            <PlayerIcon width={60} height={60} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.profileIcon, styles.iconLayout]}>
            <ProfileIcon width={60} height={60} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
    spotterProfile: {
        backgroundColor: "#fff",
        flex: 1
    },
    profileLayout: {
        height: 85,
        borderWidth: 1.5,
        borderColor: "#ff00ff",
        borderStyle: "solid",
        width: 393,
        left: 0,
        position: "absolute",
        overflow: "hidden",
        backgroundColor: "#fff"
    },
    iconLayout: {
        height: 60,
        position: "absolute",
        overflow: "hidden"
    },
    swipeUpIconPosition: {
        width: 393,
        position: "absolute",
        left: 0,
        overflow: "hidden"
    },
    userPosition: {
        width: 131,
        borderColor: "#fafafa",
        marginTop: -42.5,
        left: "50%",
        top: "50%",
        height: 85,
        borderWidth: 1.5,
        borderStyle: "solid",
        position: "absolute",
        overflow: "hidden"
    },
    venuePosition: {
        color: "#b4b3b3",
        fontFamily: "Amiko-Regular",
        fontSize: 24,
        marginTop: -15.5,
        textAlign: "center",
        left: "50%",
        top: "50%",
        position: "absolute"
    },
    homeIcon: {
        marginLeft: -176.5,
        marginTop: -29.5,
        top: "50%",
        left: "50%"
    },
    searchIcon: {
        marginLeft: -103.5,
        marginTop: -29.5,
        top: "50%",
        left: "50%"
    },
    playerIcon: {
        marginLeft: 42.5,
        marginTop: -29.5,
        top: "50%",
        left: "50%"
    },
    createIcon: {
        marginLeft: -30.5,
        marginTop: -29.5,
        top: "50%",
        left: "50%"
    },
    profileIcon: {
        right: 20,
        marginTop: -29.5,
        top: "50%"
    },
    footerProfile: {
        top: 768
    },
    BackgroundProfileImage: {
        marginTop: -343.5,
        marginLeft: -196.57,
        height: 688,
        left: "50%",
        top: "50%",
        width: 393,
        position: "absolute"
    },
    placeholderImage: {
        marginTop: -20,
        marginLeft: -120,
        fontSize: 32,
        fontFamily: "Audiowide-Regular",
        textAlign: "center",
        color: "#fff",
        left: "50%",
        top: "50%",
        position: "absolute"
    },
    name: {
        bottom: 56,
        width: 250,
        height: 60,
        left: 0
    },
    swipeUpIcon: {
        bottom: 0
    },
    spotterProfilePicture: {
        top: 83,
        height: 685,
        backgroundColor: "#fff"
    },
    artist: {
        marginLeft: -33.5
    },
    userStatus: {
        marginLeft: -65.5,
        backgroundColor: "#f4f4f4",
        width: 131,
        borderColor: "#fafafa",
        marginTop: -42.5
    },
    spotter: {
        marginLeft: -45.5,
        fontFamily: "Amiko-Regular",
        fontSize: 24,
        marginTop: -15.5,
        textAlign: "center",
        color: "#fff",
        left: "50%",
        top: "50%",
        position: "absolute"
    },
    userStatus1: {
        marginLeft: -196.5,
        backgroundColor: "transparent",
        width: 131,
        borderColor: "#fafafa",
        marginTop: -42.5
    },
    venue: {
        marginLeft: -38.5
    },
    userStatus2: {
        marginLeft: 65.5,
        backgroundColor: "#f4f4f4",
        width: 131,
        borderColor: "#fafafa",
        marginTop: -42.5
    },
    profileHeader: {
        top: 0
    },
    view: {
        width: "100%",
        height: 852,
        overflow: "hidden",
        backgroundColor: "#fff",
        flex: 1
    }
});

export default Profile;
