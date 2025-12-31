// screens/WelcomeScreen.tsx
import { useEffect, useRef } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from "react-native-svg";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Welcome">;

const { width, height } = Dimensions.get("window");

// Feature icons as SVG components
const MapPinIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
      fill="#ff00ff"
    />
  </Svg>
);

const MusicIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
      fill="#8b00ff"
    />
  </Svg>
);

const TicketIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M22 10V6c0-1.11-.9-2-2-2H4c-1.1 0-1.99.89-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zm-9 7.5h-2v-2h2v2zm0-4.5h-2v-2h2v2zm0-4.5h-2v-2h2v2z"
      fill="#2a2882"
    />
  </Svg>
);

const WelcomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const feature1Anim = useRef(new Animated.Value(0)).current;
  const feature2Anim = useRef(new Animated.Value(0)).current;
  const feature3Anim = useRef(new Animated.Value(0)).current;
  const buttonsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for logo glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Staggered feature animations
    Animated.stagger(150, [
      Animated.parallel([
        Animated.timing(feature1Anim, {
          toValue: 1,
          duration: 500,
          delay: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          delay: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(feature2Anim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(feature3Anim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(buttonsAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const FeatureItem = ({
    icon,
    title,
    description,
    animValue,
    delay,
  }: {
    icon: React.ReactNode;
    title: string;
    description: string;
    animValue: Animated.Value;
    delay: number;
  }) => (
    <Animated.View
      style={[
        styles.featureItem,
        {
          opacity: animValue,
          transform: [
            {
              translateX: animValue.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.featureIconContainer}>{icon}</View>
      <View style={styles.featureTextContainer}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </Animated.View>
  );

  return (
    <LinearGradient
      colors={["#0a0a0f", "#1a1035", "#0a0a0f"]}
      locations={[0, 0.5, 1]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
        {/* Animated Background Elements */}
        <View style={styles.decorativeContainer}>
          <Animated.View
            style={[
              styles.decorativeCircle,
              styles.circle1,
              { transform: [{ scale: pulseAnim }] },
            ]}
          />
          <Animated.View
            style={[
              styles.decorativeCircle,
              styles.circle2,
              {
                transform: [
                  {
                    scale: pulseAnim.interpolate({
                      inputRange: [1, 1.1],
                      outputRange: [1.1, 1],
                    }),
                  },
                ],
              },
            ]}
          />
          <View style={[styles.decorativeCircle, styles.circle3]} />
          {/* Floating music notes */}
          <Animated.View
            style={[
              styles.floatingNote,
              styles.note1,
              {
                transform: [
                  {
                    translateY: pulseAnim.interpolate({
                      inputRange: [1, 1.1],
                      outputRange: [0, -10],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.noteText}>{"~"}</Text>
          </Animated.View>
          <Animated.View
            style={[
              styles.floatingNote,
              styles.note2,
              {
                transform: [
                  {
                    translateY: pulseAnim.interpolate({
                      inputRange: [1, 1.1],
                      outputRange: [0, 8],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.noteText}>{"~"}</Text>
          </Animated.View>
        </View>

        {/* Logo Section */}
        <Animated.View
          style={[
            styles.logoSection,
            {
              opacity: fadeAnim,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Animated.View
            style={[styles.logoGlow, { transform: [{ scale: pulseAnim }] }]}
          >
            <Image
              style={styles.logo}
              source={require("../assets/showspotlogo.png")}
              resizeMode="cover"
            />
          </Animated.View>

          <Text style={styles.title}>ShowSpot</Text>
          <Text style={styles.subtitle}>Your Live Music Companion</Text>
        </Animated.View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <FeatureItem
            icon={<MapPinIcon />}
            title="Discover Shows"
            description="Find live music near you"
            animValue={feature1Anim}
            delay={0}
          />
          <FeatureItem
            icon={<MusicIcon />}
            title="Support Artists"
            description="Buy music & tip performers"
            animValue={feature2Anim}
            delay={150}
          />
          <FeatureItem
            icon={<TicketIcon />}
            title="Get Tickets"
            description="Never miss a show again"
            animValue={feature3Anim}
            delay={300}
          />
        </View>

        {/* Buttons Section */}
        <Animated.View
          style={[
            styles.buttonsSection,
            {
              opacity: buttonsAnim,
              transform: [
                {
                  translateY: buttonsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable
            onPress={() => navigation.navigate("Signup")}
            style={({ pressed }) => [
              styles.buttonWrapper,
              pressed && styles.buttonPressed,
            ]}
          >
            <LinearGradient
              colors={["#ff00ff", "#8b00ff", "#2a2882"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("Login")}
            style={({ pressed }) => [
              styles.buttonWrapper,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>
                I already have an account
              </Text>
            </View>
          </Pressable>

          <Text style={styles.termsText}>
            By continuing, you agree to our{" "}
            <Text style={styles.termsLink}>Terms of Service</Text>
            {" "}and{" "}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  logoSection: {
    alignItems: "center",
    marginTop: height * 0.06,
  },
  logoGlow: {
    shadowColor: "#ff00ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 20,
  },
  logo: {
    width: width * 0.4,
    height: width * 0.44,
    borderRadius: 24,
  },
  title: {
    fontSize: 38,
    fontFamily: "Audiowide-Regular",
    textAlign: "center",
    color: "#ffffff",
    marginTop: 20,
    letterSpacing: 3,
    textShadowColor: "#ff00ff",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 25,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Amiko-Regular",
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  decorativeContainer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
    overflow: "hidden",
  },
  decorativeCircle: {
    position: "absolute",
    borderRadius: 999,
  },
  circle1: {
    width: 350,
    height: 350,
    backgroundColor: "#ff00ff",
    opacity: 0.08,
    top: -100,
    right: -120,
  },
  circle2: {
    width: 250,
    height: 250,
    backgroundColor: "#8b00ff",
    opacity: 0.06,
    bottom: 150,
    left: -100,
  },
  circle3: {
    width: 180,
    height: 180,
    backgroundColor: "#2a2882",
    opacity: 0.1,
    top: height * 0.4,
    right: -60,
  },
  floatingNote: {
    position: "absolute",
    opacity: 0.15,
  },
  note1: {
    top: height * 0.15,
    left: 30,
  },
  note2: {
    top: height * 0.25,
    right: 40,
  },
  noteText: {
    fontSize: 60,
    color: "#ff00ff",
    fontWeight: "300",
  },
  featuresSection: {
    paddingVertical: 10,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255, 0, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: "Amiko-Bold",
    color: "#ffffff",
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    fontFamily: "Amiko-Regular",
    color: "rgba(255, 255, 255, 0.5)",
  },
  buttonsSection: {
    width: "100%",
    marginBottom: 30,
  },
  buttonWrapper: {
    marginBottom: 12,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#ff00ff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonText: {
    fontSize: 18,
    fontFamily: "Amiko-Bold",
    color: "#ffffff",
    letterSpacing: 1,
  },
  secondaryButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 0, 255, 0.4)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: "Amiko-SemiBold",
    color: "rgba(255, 255, 255, 0.9)",
    letterSpacing: 0.5,
  },
  termsText: {
    fontSize: 12,
    fontFamily: "Amiko-Regular",
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.35)",
    marginTop: 20,
    lineHeight: 18,
  },
  termsLink: {
    color: "rgba(255, 0, 255, 0.7)",
  },
});

export default WelcomeScreen;
