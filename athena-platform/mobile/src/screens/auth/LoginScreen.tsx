/**
 * Login Screen
 *
 * A suspended member is refused here, and the refusal tells her she can
 * appeal from the sign-in page. On the web that was true; in the app it was
 * an alert and nothing else, so the one route open to her was on another
 * device. The appeal is here now: the same route the web uses, proved with
 * the address and password she has just typed, answered in the server's own
 * words either way.
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
import { authApi } from '../../services/api';
import { AuthStackParamList } from '../../navigation/AppNavigator';

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

/** The sign-in refusal a suspended (or banned) account gets; the server keeps the word. */
/**
 * The server refuses a suspended account with a 403 and SUSPENDED_ACCOUNT_MESSAGE
 * (middleware/auth). When the status is known it is checked too, so a future
 * refusal that merely mentions a suspension does not open the appeal form.
 */
export const isSuspendedRefusal = (message: unknown, status?: number): boolean =>
  typeof message === 'string' &&
  message.toLowerCase().includes('suspended') &&
  (status === undefined || status === 403);

/** The server asks for at least a sentence (auth.routes.ts, /suspension-appeal). */
const APPEAL_MIN_LENGTH = 10;
const APPEAL_MAX_LENGTH = 5000;

export function LoginScreen({ navigation }: LoginScreenProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suspendedMessage, setSuspendedMessage] = useState<string | null>(null);
  const [appealReason, setAppealReason] = useState('');
  const [isAppealing, setIsAppealing] = useState(false);
  const [appealAnswer, setAppealAnswer] = useState<{ sent: boolean; message: string } | null>(null);

  const changeEmail = (value: string) => {
    setEmail(value);
    // The appeal is for the account that was refused; another address is
    // another account, and gets its own answer when she signs in with it.
    setSuspendedMessage(null);
    setAppealAnswer(null);
  };

  const sendAppeal = async () => {
    const reason = appealReason.trim();
    if (reason.length < APPEAL_MIN_LENGTH) {
      setAppealAnswer({ sent: false, message: 'Tell the reviewer what happened in at least a sentence.' });
      return;
    }
    setIsAppealing(true);
    try {
      const response = await authApi.suspensionAppeal(email.trim(), password, reason);
      setAppealAnswer({
        sent: true,
        message: response.data?.message || 'Your appeal has been sent and a person will look at it.',
      });
      setAppealReason('');
    } catch (error: any) {
      setAppealAnswer({
        sent: false,
        message: error?.response?.data?.message || 'Your appeal could not be sent. Check your connection and try again.',
      });
    } finally {
      setIsAppealing(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    if (requiresTwoFactor && twoFactorCode.trim().length < 6) {
      Alert.alert('Authenticator Code Required', 'Enter the 6-digit code from your authenticator app.');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password, requiresTwoFactor ? twoFactorCode.trim() : undefined);
      setRequiresTwoFactor(false);
      setTwoFactorCode('');
    } catch (error: any) {
      const responseMessage = error.response?.data?.message;
      if (typeof responseMessage === 'string' && responseMessage.toLowerCase().includes('two-factor')) {
        setRequiresTwoFactor(true);
        Alert.alert(
          'Authenticator Code Required',
          responseMessage.toLowerCase().includes('required')
            ? 'Enter the 6-digit code from your authenticator app.'
            : responseMessage
        );
        return;
      }

      if (isSuspendedRefusal(responseMessage, error.response?.status)) {
        setSuspendedMessage(responseMessage);
        setAppealAnswer(null);
        return;
      }

      Alert.alert('Login Failed', responseMessage || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.logo}>ATHENA</Text>
        <Text style={styles.tagline}>Your Career Journey Starts Here</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={changeEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {requiresTwoFactor && (
          <TextInput
            style={styles.input}
            placeholder="Authenticator code"
            value={twoFactorCode}
            onChangeText={setTwoFactorCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoCapitalize="none"
            maxLength={8}
          />
        )}

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>{isLoading ? 'Signing in...' : 'Sign In'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={styles.linkText}>Forgot your password?</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.linkText}>
            Don't have an account? <Text style={styles.linkBold}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </View>

      {suspendedMessage && (
        <View style={styles.appealPanel} accessibilityLiveRegion="polite">
          <Text style={styles.appealTitle}>Your account is suspended</Text>
          <Text style={styles.appealText}>{suspendedMessage}</Text>
          {appealAnswer?.sent ? (
            <Text style={styles.appealSent}>{appealAnswer.message}</Text>
          ) : (
            <>
              <Text style={styles.appealText}>
                Tell the reviewer what happened. A person reads every appeal; your account stays suspended until they decide.
              </Text>
              <TextInput
                style={[styles.input, styles.appealInput]}
                placeholder="Why the suspension should be lifted"
                accessibilityLabel="Why the suspension should be lifted"
                value={appealReason}
                onChangeText={setAppealReason}
                multiline
                maxLength={APPEAL_MAX_LENGTH}
                textAlignVertical="top"
                editable={!isAppealing}
              />
              {appealAnswer && !appealAnswer.sent && <Text style={styles.appealError}>{appealAnswer.message}</Text>}
              <TouchableOpacity
                style={[styles.button, isAppealing && styles.buttonDisabled]}
                onPress={sendAppeal}
                disabled={isAppealing}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>{isAppealing ? 'Sending...' : 'Send appeal'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
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
  appealPanel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  appealTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  appealText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 12,
  },
  appealInput: {
    minHeight: 110,
  },
  appealError: {
    color: '#b91c1c',
    fontSize: 14,
    marginBottom: 4,
  },
  appealSent: {
    fontSize: 15,
    color: '#065f46',
    lineHeight: 21,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#6366f1',
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 16,
    color: '#666',
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
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
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
