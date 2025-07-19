import { useState } from 'react';
import {
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { StyleSheet } from 'react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const LogIn = ({ navigation }: Props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogIn = async () => {
    if (loading) return;

    if (!email || !password) {
      Alert.alert('Missing Info', 'Please enter both email and password');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.error('Login Error:', error);
        Alert.alert('Login Failed', error.message);
        return navigation.navigate('Failure');
      }

      navigation.navigate('BottomTabs');
    } catch (err) {
      console.error('Unexpected Error:', err);
      Alert.alert('Error', 'An unexpected error occurred');
      navigation.navigate('Failure');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.login}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, width: '100%' }}
      >
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: 20 }}>
          <Text style={styles.title}>Welcome Back</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter email"
            placeholderTextColor="#b4b3b3"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor="#b4b3b3"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[styles.button, { opacity: loading ? 0.5 : 1 }]}
            onPress={handleLogIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#222" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>

          <LinearGradient style={styles.signupLink} colors={['#ff00ff', '#2a2882']}>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.signupText}>Sign Up</Text>
            </TouchableOpacity>
          </LinearGradient>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  login: {
    backgroundColor: '#fff',
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Amiko-Regular',
    marginBottom: 30,
    color: '#000',
  },
  input: {
    width: '100%',
    height: 40,
    backgroundColor: '#f4f4f4',
    borderColor: '#fafafa',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 15,
    fontFamily: 'Amiko-Regular',
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#fff',
    borderColor: '#ff00ff',
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#222',
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
  },
  signupLink: {
    marginTop: 20,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 30,
  },
  signupText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    textAlign: 'center',
  },
});

export default LogIn;
