import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

const Create = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Create</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: "flex-start", 
    backgroundColor: "#fff",
    paddingBottom: 100 // Account for bottom tab bar
  },
  content: { alignItems: "center", marginTop: 100 },
  title: { fontSize: 32, fontWeight: "bold", color: "#2a2882" },
});

export default Create;
