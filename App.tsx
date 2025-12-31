// App.tsx
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import WelcomeScreen from "./screens/WelcomeScreen";
import InitialOnboarding from "./components/InitialOnboarding";
import UserTypeSelection from "./components/UserTypeSelection";
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
import MessagesPage from './components/MessagesPage';
import NotificationsPage from './components/NotificationsPage';
import { UserProvider } from "./context/userContext";
import { MusicPlayerProvider } from "./components/player";
import BottomTabs from "./navigation/BottomTabs"; // contains Profile, MapHome, etc.
import { ToastProvider, ToastManagerConnector } from './components/Toast';
import { OnboardingProvider } from './components/OnboardingFlow';
import { STRIPE_CONFIG } from './config/stripe';

// Conditionally import Stripe - it requires native modules not available in Expo Go
let StripeProvider: React.ComponentType<any> | null = null;
try {
  StripeProvider = require('@stripe/stripe-react-native').StripeProvider;
} catch (e) {
  console.log('Stripe native module not available (expected in Expo Go)');
}

export type RootStackParamList = {
  InitialOnboarding: undefined;
  Welcome: undefined;
  UserTypeSelection: undefined;
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
  MessagesPage: undefined;
  NotificationsPage: undefined;
  BottomTabs: undefined; // 👈 all main pages now live here
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Ensure immediate render by deferring initialization
    // Add small delay to ensure all modules are loaded
    const timer = setTimeout(() => {
      try {
        setIsReady(true);
      } catch (error) {
        console.error('App initialization error:', error);
        // Still set ready to show error boundary
        setIsReady(true);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Show loading state immediately to prevent blank screen
  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2a2882" />
      </View>
    );
  }

  // Core app content
  const appContent = (
    <AppErrorBoundary>
      <UserProvider>
        <MusicPlayerProvider>
          <ToastProvider>
            <ToastManagerConnector />
            <OnboardingProvider>
              <NavigationContainer>
                <Stack.Navigator
                  initialRouteName="InitialOnboarding"
                  screenOptions={{ headerShown: false }}
                >
                  <Stack.Screen name="InitialOnboarding" component={InitialOnboarding} />
                  <Stack.Screen name="Welcome" component={WelcomeScreen} />
                  <Stack.Screen name="UserTypeSelection" component={UserTypeSelection} />
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
                  <Stack.Screen name="MessagesPage" component={MessagesPage} />
                  <Stack.Screen name="NotificationsPage" component={NotificationsPage} />
                  <Stack.Screen name="BottomTabs" component={BottomTabs} />
                </Stack.Navigator>
              </NavigationContainer>
            </OnboardingProvider>
          </ToastProvider>
        </MusicPlayerProvider>
      </UserProvider>
    </AppErrorBoundary>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {StripeProvider ? (
          <StripeProvider
            publishableKey={STRIPE_CONFIG.PUBLIC_KEY}
            merchantIdentifier="merchant.com.showspot"
          >
            {appContent}
          </StripeProvider>
        ) : (
          appContent
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});
