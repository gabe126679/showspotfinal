// navigation/BottomTabs.tsx
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import MapHome from "../components/mapHome";
import Search from "../components/search";
import Create from "../components/create";
import Player from "../components/player";
import Profile from "../components/profile";

import HomeIcon from "../assets/home-icon.svg";
import SearchIcon from "../assets/search-icon.svg";
import CreateIcon from "../assets/create-icon.svg";
import PlayerIcon from "../assets/player-icon.svg";
import ProfileIcon from "../assets/profile-icon.svg";

const Tab = createBottomTabNavigator();

const BottomTabs = () => {
  return (
    <Tab.Navigator
      id="BottomTabs"
        screenOptions={{
            headerShown: false,
            tabBarStyle: {
            backgroundColor: "rgba(10, 10, 15, 0.95)",
            borderTopColor: "rgba(255, 255, 255, 0.1)",
            borderTopWidth: 1,
            height: 85,
            paddingBottom: 12,
            paddingTop: 8,
            zIndex: 999,
            },
            tabBarShowLabel: false,
            tabBarActiveTintColor: "#ff00ff",
            tabBarInactiveTintColor: "#888",
        }}
    >
      <Tab.Screen
        name="MapHome"
        component={MapHome}
        options={{
          tabBarIcon: ({ color }) => <HomeIcon width={50} height={50} fill={color} />,
        }}
      />
      <Tab.Screen
        name="Search"
        component={Search}
        options={{
          tabBarIcon: ({ color }) => <SearchIcon width={50} height={50} fill={color} />,
        }}
      />
      <Tab.Screen
        name="Create"
        component={Create}
        options={{
          tabBarIcon: ({ color }) => <CreateIcon width={50} height={50} fill={color} />,
        }}
      />
      <Tab.Screen
        name="Player"
        component={Player}
        options={{
          tabBarIcon: ({ color }) => <PlayerIcon width={50} height={50} fill={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={Profile}
        options={{
          tabBarIcon: ({ color }) => <ProfileIcon width={50} height={50} fill={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

export default BottomTabs;
