// App.tsx
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WelcomeScreen from "./screens/WelcomeScreen";
import LogIn from "./app/login";
import Signup from "./app/signup";
import Success from "./app/success";
import Failure from "./app/failure";
import Picture from "./app/picture";
import Profile from "./components/profile";
import Home from "./components/home";
import Search from "./components/search";
import Create from "./components/create";
import Player from "./components/player";
import { UserProvider } from "./context/userContext"; 
// 👈 import context

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  Success: { name: string };
  Failure: undefined;
  Picture: undefined;
  Profile: undefined;
  Home: undefined;
  Search: undefined;
  Create: undefined;
  Player: undefined;
};

console.log("Home Component:", Home);

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {

  console.log("Home Component:", Home);

  return (
    <UserProvider>
      <NavigationContainer>
        <Stack.Navigator
          id={undefined}
          initialRouteName="Profile"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Login" component={LogIn} />
          <Stack.Screen name="Signup" component={Signup} />
          <Stack.Screen name="Success" component={Success} />
          <Stack.Screen name="Failure" component={Failure} />
          <Stack.Screen name="Picture" component={Picture} />
          <Stack.Screen name="Profile" component={Profile} />
          <Stack.Screen name="Home" component={Home} />
          <Stack.Screen name="Search" component={Search} />
          <Stack.Screen name="Create" component={Create} />
          <Stack.Screen name="Player" component={Player} />
        </Stack.Navigator>
      </NavigationContainer>
    </UserProvider>
  );
}
