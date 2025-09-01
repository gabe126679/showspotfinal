// Minimal App.tsx to test basic startup
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function App() {
  console.log('App starting...');
  
  try {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>ShowSpot</Text>
          <Text style={styles.subtitle}>Testing Minimal App</Text>
        </View>
      </SafeAreaView>
    );
  } catch (error) {
    console.error('App render error:', error);
    return (
      <View style={styles.container}>
        <Text>Error loading app</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2a2882',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
});