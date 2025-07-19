import { Text, View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Failure() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.text}>❌ Something went wrong during sign up.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  text: {
    fontSize: 20,
    textAlign: "center",
    fontWeight: "bold",
    color: "#b00020",
  },
});
