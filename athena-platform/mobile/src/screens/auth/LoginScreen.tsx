/**
 * Login Screen
 *
 * A suspended member is refused here, and the refusal tells her she can
 * appeal from the sign-in page. On the web that was true; in the app it was
 * an alert and nothing else, so the one route open to her was on another
 * device. The appeal is here now: the same route the web uses, proved with
 * the address and password she has just typed, answered in the server's own
 * words either way.
 *
 * Two more refusals leave a member stuck rather than wrong, and each gets a way
 * out. Registration opens no session, so a member whose confirmation email never
 * came, or whose link expired, is told to verify her email and would have had no
 * way to ask for another from the phone. And a member who locked her own account
 * is refused with the right password and needs a new unlock email.
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

/**
 * The sign-in refusal for an address nobody has confirmed. Matches the sentence
 * the server sends (middleware/auth.ts, EMAIL_NOT_VERIFIED_MESSAGE; pinned by
 * server/tests/integration/auth-recovery.test.ts), as isSuspendedRefusal
 * matches the suspended one, and checks the status when it is known.
 */
export const isUnverifiedRefusal = (message: unknown, status?: number): boolean =>
  typeof message === 'string' &&
  message.toLowerCase().includes('verify your email') &&
  (status === undefined || status === 403);

/**
 * The sign-in refusal for an account the member locked herself (server
 * ACCOUNT_LOCKED_MESSAGE). It says nothing about being suspended: it is not a
 * moderation state, so it must not open the appeal.
 */
export const isLockedRefusal = (message: unknown, status?: number): boolean =>
  typeof message === 'string' &&
  message.toLowerCase().includes('account is locked') &&
  (status === undefined || status === 403);

type StuckKind = 'unconfirmed' | 'locked';

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
  // The unconfirmed-address and locked-account refusals: what the server said,
  // and the answer to her asking for another email.
  const [stuck, setStuck] = useState<{ kind: StuckKind; message: string } | null>(null);
  const [stuckAnswer, setStuckAnswer] = useState<{ sent: boolean; message: string } | null>(null);
  const [isSendingStuck, setIsSendingStuck] = useState(false);

  const changeEmail = (value: string) => {
    setEmail(value);
    // The appeal is for the account that was refused; another address is
    // another account, and gets its own answer when she signs in with it.
    setSuspendedMessage(null);
    setAppealAnswer(null);
    setStuck(null);
    setStuckAnswer(null);
  };

  const sendStuckEmail = async () => {
    if (!stuck) return;
    setIsSendingStuck(true);
    try {
      if (stuck.kind === 'locked') await authApi.requestUnlock(email.trim());
      else await authApi.resendVerification(email.trim());
      // Both routes answer the same for every address, so this says what may be
      // true and never that an account exists.
      setStuckAnswer({
        sent: true,
        message:
          stuck.kind === 'locked'
            ? 'If that account is locked, a link to unlock it is on its way. It works once, for 24 hours.'
            : 'If that address has an account waiting to be confirmed, a new link is on its way. It works for 24 hours.',
      });
    } catch {
      setStuckAnswer({ sent: false, message: 'We could not send another just now. Please wait a little and try again.' });
    } finally {
      setIsSendingStuck(false);
    }
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
      Alert.alert(
        'Authenticator Code Required',
        'Enter the 6-digit code from your authenticator app, or one of your recovery codes if you have lost your phone.'
      );
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
            ? 'Enter the 6-digit code from your authenticator app, or one of your recovery codes if you have lost your phone.'
            : responseMessage
        );
        return;
      }

      if (isSuspendedRefusal(responseMessage, error.response?.status)) {
        setSuspendedMessage(responseMessage);
        setAppealAnswer(null);
        return;
      }

      if (isUnverifiedRefusal(responseMessage, error.response?.status)) {
        setStuck({ kind: 'unconfirmed', message: responseMessage });
        setStuckAnswer(null);
        return;
      }

      if (isLockedRefusal(responseMessage, error.response?.status)) {
        setStuck({ kind: 'locked', message: responseMessage });
        setStuckAnswer(null);
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
            // Not a number pad and not eight characters: one of the ten recovery codes
            // (ten letters and numbers, printed in two groups) goes in this box too, and
            // typing one is the only way back in for a member who has lost her phone.
            keyboardType="default"
            textContentType="oneTimeCode"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={32}
            accessibilityLabel="Authenticator code, or one of your recovery codes"
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

      {stuck && (
        <View style={styles.appealPanel} accessibilityLiveRegion="polite">
          <Text style={styles.appealTitle}>
            {stuck.kind === 'locked' ? 'Your account is locked' : 'Confirm your email first'}
          </Text>
          <Text style={styles.appealText}>{stuck.message}</Text>
          <Text style={styles.appealText}>
            {stuck.kind === 'locked'
              ? 'The unlock link is in the email we sent when you locked your account. Look in your junk folder too. If you cannot find it, we can send a new one.'
              : 'Did the email not arrive, or has the link expired? We can send a new one to the address you typed.'}
          </Text>
          {stuckAnswer && (
            <Text style={stuckAnswer.sent ? styles.appealSent : styles.appealError}>{stuckAnswer.message}</Text>
          )}
          <TouchableOpacity
            style={[styles.button, isSendingStuck && styles.buttonDisabled]}
            onPress={sendStuckEmail}
            disabled={isSendingStuck}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>
              {isSendingStuck
                ? 'Sending...'
                : stuck.kind === 'locked'
                  ? 'Email me a new unlock link'
                  : 'Send me a new link'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

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
