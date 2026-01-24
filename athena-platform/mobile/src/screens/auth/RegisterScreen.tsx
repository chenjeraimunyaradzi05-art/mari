/**
 * Register Screen
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../navigation/AppNavigator';
import { Persona } from '@shared/src';

type RegisterScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
};

const PERSONAS = [
  { value: Persona.EARLY_CAREER, label: 'Early Career' },
  { value: Persona.CAREER_CHANGER, label: 'Professional' },
  { value: Persona.ENTREPRENEUR, label: 'Entrepreneur' },
  { value: Persona.MENTOR, label: 'Mentor' },
  { value: Persona.EMPLOYER, label: 'Employer' },
];

export function RegisterScreen({ navigation }: RegisterScreenProps) {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPersona, setSelectedPersona] = useState(Persona.EARLY_CAREER);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!firstName || !lastName || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        firstName,
        lastName,
        email,
        password,
        persona: selectedPersona,
      });
    } catch (error: any) {
      Alert.alert('Registration Failed', error.response?.data?.message || 'Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>Create Account</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.nameRow}>
            <TextInput
              style={[styles.input, styles.nameInput]}
              placeholder="First Name"
              value={firstName}
              onChangeText={setFirstName}
            />
            <TextInput
              style={[styles.input, styles.nameInput]}
              placeholder="Last Name"
              value={lastName}
              onChangeText={setLastName}
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Password (min 8 characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text style={styles.label}>I am a...</Text>
          <View style={styles.personaContainer}>
            {PERSONAS.map((persona) => (
              <TouchableOpacity
                key={persona.value}
                style={[
                  styles.personaButton,
                  selectedPersona === persona.value && styles.personaButtonSelected,
                ]}
                onPress={() => setSelectedPersona(persona.value)}
              >
                <Text
                  style={[
                    styles.personaText,
                    selectedPersona === persona.value && styles.personaTextSelected,
                  ]}
                >
                  {persona.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => Alert.alert('Coming Soon', 'Google sign-up will be available soon.')}
          >
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialButton, styles.appleButton]}
            onPress={() => Alert.alert('Coming Soon', 'Apple sign-up will be available soon.')}
          >
            <Text style={[styles.socialButtonText, styles.appleButtonText]}>Continue with Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkBold}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginTop: 10,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
  },
  nameInput: {
    flex: 1,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 10,
  },
  personaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  personaButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  personaButtonSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  personaText: {
    fontSize: 14,
    color: '#666',
  },
  personaTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#9ca3af',
  },
  socialButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  socialButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  appleButton: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  appleButtonText: {
    color: '#fff',
  },
  linkText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  linkBold: {
    color: '#6366f1',
    fontWeight: '600',
  },
});
