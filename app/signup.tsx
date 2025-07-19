import { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

const SignUp = ({ navigation }: Props) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (loading) return;
    if (!fullName || !email || !password) {
      Alert.alert('Missing Info', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (signUpError) {
        console.error('Signup Error:', signUpError);
        Alert.alert('Signup Failed', signUpError.message);
        return navigation.navigate('Failure');
      }

      let user = null;
      for (let i = 0; i < 5; i++) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          user = sessionData.session.user;
          break;
        }
        await new Promise(res => setTimeout(res, 1000));
      }

      if (!user) {
        Alert.alert('Session Error', 'Could not retrieve session.');
        return navigation.navigate('Failure');
      }

      const { error: insertError } = await supabase.from('spotters').insert([
        {
          id: user.id,
          full_name: fullName,
          email,
        },
      ]);

      if (insertError) {
        console.error('Insert Error:', insertError);
        Alert.alert('Insert Failed', insertError.message);
        return navigation.navigate('Failure');
      }

      navigation.navigate('Picture');

    } catch (err) {
      console.error('Unexpected Error:', err);
      Alert.alert('Unexpected Error', 'Something went wrong.');
      navigation.navigate('Failure');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.signUp}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, width: '100%' }}
      >
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: 20 }}>
          <Text style={styles.title}>Sign up for ShowSpot</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter full name"
            placeholderTextColor="#b4b3b3"
            value={fullName}
            onChangeText={setFullName}
          />
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
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Signing up...' : 'Continue'}
            </Text>
          </TouchableOpacity>

          <LinearGradient style={styles.loginLink} colors={['#ff00ff', '#2a2882']}>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginText}>Log In</Text>
            </TouchableOpacity>
          </LinearGradient>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  signUp: {
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
  loginLink: {
    marginTop: 20,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 30,
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Amiko-Regular',
    textAlign: 'center',
  },
});

export default SignUp;
