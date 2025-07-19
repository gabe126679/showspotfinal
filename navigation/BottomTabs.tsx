// navigation/BottomTabs.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import MapHome from "../components/mapHome";
import Search from "../components/search";
import Create from "../components/create";
import Player from "../components/player";
import Profile from "../components/profile";
import CustomTabBar from "../components/CustomTabBar";
import { supabase } from "../lib/supabase";

const Tab = createBottomTabNavigator();

const BottomTabs = () => {
  const navigationRef = useRef<any>(null);
  const expandPanelRef = useRef<(() => void) | null>(null);
  const [profileData, setProfileData] = useState({
    name: 'Loading...',
    type: 'spotter' as 'spotter' | 'artist' | 'venue'
  });


  const handleGesturePress = () => {
    console.log('Gesture pressed');
  };
  
  const setExpandPanelFunction = (expandFn: () => void) => {
    expandPanelRef.current = expandFn;
  };

  const handleProfileDataChange = useCallback((data: { name: string; type: 'spotter' | 'artist' | 'venue' }) => {
    setProfileData(data);
  }, []);
  
  const handleSwipeUp = () => {
    console.log('Swipe up detected!');
    // Call the expand panel function directly
    if (expandPanelRef.current) {
      expandPanelRef.current();
    } else {
      console.log('expandPanel function not yet registered');
    }
  };

  return (
    <Tab.Navigator
      id="BottomTabs"
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => {
        // Store navigation reference
        navigationRef.current = props.navigation;
        return (
          <CustomTabBar 
            {...props} 
            profileData={profileData}
            onGesturePress={handleGesturePress}
            onSwipeUp={handleSwipeUp}
          />
        );
      }}
    >
      <Tab.Screen
        name="MapHome"
        component={MapHome}
      />
      <Tab.Screen
        name="Search"
        component={Search}
      />
      <Tab.Screen
        name="Create"
        component={Create}
      />
      <Tab.Screen
        name="Player"
        component={Player}
      />
      <Tab.Screen 
        name="Profile"
        children={() => <Profile 
          onExpandPanelRef={setExpandPanelFunction}
          onProfileDataChange={handleProfileDataChange}
        />}
      />
    </Tab.Navigator>
  );
};

export default BottomTabs;
