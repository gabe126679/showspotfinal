import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { Audio } from 'expo-av';

const AudioDebugger = () => {
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const debugAudioFile = async (filePath: string) => {
    let debugLog = `=== DEBUGGING AUDIO FILE ===\n`;
    debugLog += `File path: ${filePath}\n\n`;

    try {
      // 1. Test signed URL creation
      debugLog += `1. Creating signed URL...\n`;
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('songs')
        .createSignedUrl(filePath, 3600);

      if (signedUrlError) {
        debugLog += `❌ Signed URL Error: ${signedUrlError.message}\n`;
        setDebugInfo(debugLog);
        return;
      }

      const signedUrl = signedUrlData.signedUrl;
      debugLog += `✅ Signed URL created: ${signedUrl}\n\n`;

      // 2. Test HTTP access
      debugLog += `2. Testing HTTP access...\n`;
      try {
        const response = await fetch(signedUrl, { method: 'HEAD' });
        debugLog += `✅ HTTP Status: ${response.status} ${response.statusText}\n`;
        debugLog += `✅ Content-Type: ${response.headers.get('content-type')}\n`;
        debugLog += `✅ Content-Length: ${response.headers.get('content-length')}\n\n`;
      } catch (fetchError) {
        debugLog += `❌ HTTP Error: ${fetchError.message}\n\n`;
      }

      // 3. Test actual file download
      debugLog += `3. Testing file download...\n`;
      try {
        const downloadResponse = await fetch(signedUrl);
        const arrayBuffer = await downloadResponse.arrayBuffer();
        debugLog += `✅ File downloaded: ${arrayBuffer.byteLength} bytes\n`;
        
        // Check if it's a valid audio file by looking at the first few bytes
        const uint8Array = new Uint8Array(arrayBuffer);
        const header = Array.from(uint8Array.slice(0, 4))
          .map(b => b.toString(16).padStart(2, '0'))
          .join(' ');
        debugLog += `✅ File header: ${header}\n\n`;
      } catch (downloadError) {
        debugLog += `❌ Download Error: ${downloadError.message}\n\n`;
      }

      // 4. Test with Audio.Sound
      debugLog += `4. Testing with Audio.Sound...\n`;
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        const { sound, status } = await Audio.Sound.createAsync(
          { uri: signedUrl },
          { shouldPlay: false }
        );

        debugLog += `✅ Sound object created\n`;
        debugLog += `✅ Initial status: ${JSON.stringify(status, null, 2)}\n`;

        // Test playback
        try {
          await sound.playAsync();
          debugLog += `✅ Playback started successfully\n`;
          
          // Stop after 2 seconds
          setTimeout(async () => {
            await sound.pauseAsync();
            await sound.unloadAsync();
            debugLog += `✅ Sound cleaned up\n`;
          }, 2000);
        } catch (playError) {
          debugLog += `❌ Playback Error: ${playError.message}\n`;
          await sound.unloadAsync();
        }

      } catch (audioError) {
        debugLog += `❌ Audio Error: ${audioError.message}\n`;
      }

      setDebugInfo(debugLog);

    } catch (error) {
      debugLog += `❌ General Error: ${error.message}\n`;
      setDebugInfo(debugLog);
    }
  };

  const testCurrentSong = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        Alert.alert('Error', 'Not logged in');
        return;
      }

      // Get the first song from the database
      const { data: songs, error } = await supabase
        .from('songs')
        .select('*')
        .eq('spotter_id', userId)
        .limit(1);

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      if (!songs || songs.length === 0) {
        Alert.alert('Error', 'No songs found');
        return;
      }

      await debugAudioFile(songs[0].song_file);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  if (!isDebugMode) {
    return (
      <TouchableOpacity 
        style={styles.debugButton}
        onPress={() => setIsDebugMode(true)}
      >
        <Text style={styles.debugButtonText}>🔧 Debug Audio</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.debugContainer}>
      <Text style={styles.debugTitle}>Audio Debugger</Text>
      
      <TouchableOpacity style={styles.button} onPress={testCurrentSong}>
        <Text style={styles.buttonText}>Test Current Song</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.closeButton} 
        onPress={() => setIsDebugMode(false)}
      >
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>

      {debugInfo ? (
        <View style={styles.debugOutput}>
          <Text style={styles.debugText}>{debugInfo}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  debugButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#ff00ff',
    padding: 10,
    borderRadius: 8,
    zIndex: 1000,
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  debugContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    zIndex: 1000,
    padding: 20,
  },
  debugTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#ff00ff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#666',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  closeButtonText: {
    color: '#fff',
    textAlign: 'center',
  },
  debugOutput: {
    flex: 1,
    backgroundColor: '#000',
    padding: 10,
    borderRadius: 8,
  },
  debugText: {
    color: '#0f0',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});

export default AudioDebugger;