// App.tsx
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import WelcomeScreen from "./screens/WelcomeScreen";
import LogIn from "./app/login";
import Signup from "./app/signup";
import Success from "./app/success";
import Failure from "./app/failure";
import Picture from "./app/picture";
import ArtistSignup from './app/artistSignup';
import ArtistPicture from './app/artistPicture';
import VenueSignup from './app/venueSignup';
import VenuePicture from './app/venuePicture';
import BandPicture from './app/bandPicture';
import BandPublicProfile from './components/bandPublicProfile';
import ArtistPublicProfile from './components/artistPublicProfile';
import VenuePublicProfile from './components/venuePublicProfile';
import ShowBill from './components/ShowBill';
import VenueAcceptanceWizard from './components/VenueAcceptanceWizard';
import { UserProvider } from "./context/userContext";
import { MusicPlayerProvider } from "./components/player";
import BottomTabs from "./navigation/BottomTabs"; // contains Profile, MapHome, etc.

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  Success: undefined;
  Failure: undefined;
  Picture: undefined;
  ArtistSignup: undefined;
  ArtistPicture: undefined;
  VenueSignup: undefined;
  VenuePicture: undefined;
  BandPicture: { band_id: string };
  BandPublicProfile: { band_id: string };
  ArtistPublicProfile: { artist_id: string };
  VenuePublicProfile: { venue_id: string };
  ShowBill: { show_id: string };
  VenueAcceptanceWizard: { show_id: string };
  BottomTabs: undefined; // 👈 all main pages now live here
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <UserProvider>
        <MusicPlayerProvider>
          <NavigationContainer>
            <Stack.Navigator
              id={undefined}
              initialRouteName="Welcome"
              screenOptions={{ headerShown: false }}
            >
              <Stack.Screen name="Welcome" component={WelcomeScreen} />
              <Stack.Screen name="Login" component={LogIn} />
              <Stack.Screen name="Signup" component={Signup} />
              <Stack.Screen name="Success" component={Success} />
              <Stack.Screen name="Failure" component={Failure} />
              <Stack.Screen name="Picture" component={Picture} />
              <Stack.Screen name="ArtistSignup" component={ArtistSignup} />
              <Stack.Screen name="ArtistPicture" component={ArtistPicture} />
              <Stack.Screen name="VenueSignup" component={VenueSignup} />
              <Stack.Screen name="VenuePicture" component={VenuePicture} />
              <Stack.Screen name="BandPicture" component={BandPicture} />
              <Stack.Screen name="BandPublicProfile" component={BandPublicProfile} />
              <Stack.Screen name="ArtistPublicProfile" component={ArtistPublicProfile} />
              <Stack.Screen name="VenuePublicProfile" component={VenuePublicProfile} />
              <Stack.Screen name="ShowBill" component={ShowBill} />
              <Stack.Screen name="VenueAcceptanceWizard" component={VenueAcceptanceWizard} />
              <Stack.Screen name="BottomTabs" component={BottomTabs} />
            </Stack.Navigator>
          </NavigationContainer>
        </MusicPlayerProvider>
      </UserProvider>
    </GestureHandlerRootView>
  );
}
