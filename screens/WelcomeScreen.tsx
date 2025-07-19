// screens/WelcomeScreen.tsx
import { Image, StyleSheet, Text, View, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Welcome">;



const WelcomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView style={styles.container}>
      <Image
        style={styles.logo}
        source={require("../assets/showspotlogo.png")}
        resizeMode="cover"
      />
      <Text style={styles.title}>ShowSpot</Text>

      <View style={styles.buttons}>
        <Pressable onPress={() => navigation.navigate("Signup")}>
          <LinearGradient
            colors={["#ff00ff", "#2a2882"]}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Get Started</Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={() => navigation.navigate("Login")}>
          <View style={[styles.button, styles.outlineButton]}>
            <Text style={[styles.buttonText, styles.outlineText]}>Log In</Text>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: {
    marginTop: 80,
    width: 200,
    height: 220,
    borderRadius: 20,
  },
  title: {
    fontSize: 32,
    fontFamily: "Audiowide-Regular",
    textAlign: "center",
    color: "#222",
    marginVertical: 40,
  },
  buttons: {
    width: "100%",
    marginBottom: 40,
  },
  button: {
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: "Amiko-Regular",
    color: "#fff",
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: "#ff00ff",
    backgroundColor: "transparent",
  },
  outlineText: {
    color: "#222",
  },
});

export default WelcomeScreen;
