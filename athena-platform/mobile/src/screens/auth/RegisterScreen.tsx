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
  { value: Persona.MID_CAREER, label: 'Professional' },
  { value: Persona.ENTREPRENEUR, label: 'Entrepreneur' },
  { value: Persona.CREATOR, label: 'Creator' },
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
  const [womanSelfAttested, setWomanSelfAttested] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (
      password.length < 12 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      Alert.alert(
        'Error',
        'Password must be at least 12 characters and include uppercase, lowercase, number, and special characters.'
      );
      return;
    }

    if (!womanSelfAttested) {
      Alert.alert('Error', 'Please confirm the community self-attestation to continue.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await register({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail,
        password,
        persona: selectedPersona,
        womanSelfAttested,
      });
      if (result.verificationRequired) {
        Alert.alert(
          'Check your inbox',
          'We sent you a verification link. Please verify your email before signing in.',
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
      }
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
          <Text style={styles.logo}>ATHENA</Text>
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
            placeholder="Password (min 12 characters)"
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
            style={styles.attestationRow}
            onPress={() => setWomanSelfAttested((value) => !value)}
          >
            <View style={[styles.checkbox, womanSelfAttested && styles.checkboxChecked]}>
              {womanSelfAttested && <View style={styles.checkboxDot} />}
            </View>
            <Text style={styles.attestationText}>
              I confirm that I am a woman and agree to ATHENA community standards.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Text>
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
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#6366f1',
    letterSpacing: 3,
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
  attestationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  checkboxDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  attestationText: {
    flex: 1,
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 20,
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
