/**
 * Sign-in and devices.
 *
 * Where she sees every device her account is signed in on, ends any of them
 * (or all of them), and changes her password. The web has had this page for a
 * while; the phone had nothing, so a woman who had lost a phone, or shared a
 * computer, had to find a browser to get her account back. Everything here is
 * the server's: the list is her own sessions and nobody else's, ending one
 * stops its access token at once and closes its live connection, and changing
 * the password ends every other session.
 *
 * Devices are named by browser and system ("Chrome on Windows"), never by the
 * raw user-agent string, and the only place shown is the address the sign-in
 * came from: there is no location data behind it and none is invented.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { sessionsApi, unwrapApiData } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { apiMessage, errorStatus } from '../utils/apiErrors';
import { describeDevice } from '../utils/deviceLabel';
import { openOnWeb } from './OpensOnWebScreen';
import { Card, LoadError, Loading, Muted, PrimaryButton, SecondaryButton, colours } from '../components/pillar/PillarUi';

interface Device {
  id: string;
  label: string;
  isCurrent: boolean;
  signedIn: string | null;
  address: string | null;
}

interface SessionRecord {
  id: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt?: string | null;
  isCurrent?: boolean;
}

/** The server's own floor for a new password, said before she sends rather than after. */
export const NEW_PASSWORD_MIN_LENGTH = 12;
const PASSWORD_SHAPE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/;
const PASSWORD_RULE =
  'Use at least 12 characters, with an uppercase letter, a lowercase letter, a number and a symbol.';

function readDevices(payload: unknown): Device[] {
  const records = unwrapApiData<SessionRecord[]>(payload);
  if (!Array.isArray(records)) return [];
  return records.map((record) => ({
    id: record.id,
    label: describeDevice(record.userAgent),
    isCurrent: Boolean(record.isCurrent),
    signedIn: record.createdAt ?? null,
    address: record.ipAddress ?? null,
  }));
}

function whenSignedIn(value: string | null): string {
  if (!value) return 'Sign-in time unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sign-in time unknown';
  return `Signed in ${date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`;
}

export function SecurityScreen() {
  const { logout } = useAuth();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await sessionsApi.list();
      setDevices(readDevices(response.data));
    } catch (error) {
      setLoadError(apiMessage(error, 'Your devices could not be loaded. Check your connection and try again.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signOutDevice = (device: Device) => {
    Alert.alert('Sign out this device?', `${device.label} will be signed out straight away.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setBusyId(device.id);
          setDeviceError(null);
          try {
            await sessionsApi.revoke(device.id);
            await load();
          } catch (error) {
            setDeviceError(apiMessage(error, 'That device could not be signed out. Nothing has changed; try again.'));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const signOutEverywhere = () => {
    Alert.alert('Sign out of every device?', 'This includes this phone. You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out everywhere',
        style: 'destructive',
        onPress: async () => {
          setSigningOutAll(true);
          setDeviceError(null);
          try {
            await sessionsApi.signOutEverywhere();
          } catch (error) {
            setDeviceError(apiMessage(error, 'Your devices could not be signed out. Nothing has changed; try again.'));
            setSigningOutAll(false);
            return;
          }
          // The server has ended every session, this one too; this clears what
          // the phone holds and puts the sign-in screen back.
          await logout();
        },
      },
    ]);
  };

  // Beyond signing out everywhere: every session ends, this phone's included,
  // and nobody can sign in again, with the password or Google or Facebook,
  // until she unlocks the account from the link the server emails her. Signing
  // out everywhere alone leaves the door open to anyone who knows the password.
  const lockAccount = () => {
    Alert.alert(
      'Lock your account?',
      'Every device, including this phone, is signed out, and nobody can sign in again, with your password or with Google or Facebook, until you unlock it from the link we email you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Lock my account',
          style: 'destructive',
          onPress: async () => {
            setLocking(true);
            setLockError(null);
            let emailed = true;
            try {
              const response = await sessionsApi.lockAccount();
              emailed = unwrapApiData<{ unlockEmailSent?: boolean }>(response.data)?.unlockEmailSent !== false;
            } catch (error) {
              // A refusal is the server saying nothing happened. No answer at all
              // (the phone gives up after ten seconds), or a failure on our side,
              // says nothing about whether the lock went through before the
              // connection dropped, and "nothing has changed" would be a guess.
              const status = errorStatus(error);
              setLockError(
                status === null || status >= 500
                  ? 'We did not get an answer, so we cannot tell whether your account was locked. Press Lock my account again: if it is already locked you will be taken to the sign-in screen.'
                  : apiMessage(error, 'Your account could not be locked. Nothing has changed; try again.')
              );
              setLocking(false);
              return;
            }
            // Said before she is signed out, so she knows what to look for.
            Alert.alert(
              'Your account is locked',
              emailed
                ? 'We have emailed you a link to unlock it.'
                : 'We could not send the unlock email just now. Ask for a new one from the sign-in screen.'
            );
            // The server has ended every session, this one too; this clears what
            // the phone holds and puts the sign-in screen back.
            await logout();
          },
        },
      ]
    );
  };

  const changePassword = async () => {
    setPasswordNotice(null);
    if (!currentPassword) {
      setPasswordError('Enter your current password.');
      return;
    }
    if (newPassword.length < NEW_PASSWORD_MIN_LENGTH || !PASSWORD_SHAPE.test(newPassword)) {
      setPasswordError(PASSWORD_RULE);
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('Choose a password you have not used here before.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The two new passwords do not match.');
      return;
    }

    setChanging(true);
    setPasswordError(null);
    try {
      await sessionsApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordNotice('Your password has been changed, and every other device has been signed out.');
      await load();
    } catch (error) {
      setPasswordError(apiMessage(error, 'Your password could not be changed. Nothing has changed; try again.'));
    } finally {
      setChanging(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Sign-in and devices</Text>
      <Text style={styles.subtitle}>
        See where your account is signed in, and end any session you do not recognise.
      </Text>

      <Card title="Devices signed in">
        {loadError ? (
          <LoadError message={loadError} onRetry={() => void load()} title="Your devices did not load" />
        ) : devices === null ? (
          <Loading label="Loading your devices" />
        ) : devices.length === 0 ? (
          <Muted>No signed-in devices were returned.</Muted>
        ) : (
          devices.map((device) => (
            <View key={device.id} style={styles.device}>
              <View style={styles.deviceText}>
                <Text style={styles.deviceName}>
                  {device.label}
                  {device.isCurrent ? '  ·  This device' : ''}
                </Text>
                <Text style={styles.deviceMeta}>
                  {whenSignedIn(device.signedIn)}
                  {device.address ? `  ·  IP ${device.address}` : ''}
                </Text>
              </View>
              {device.isCurrent ? null : (
                <TouchableOpacity
                  style={[styles.deviceButton, busyId === device.id && styles.disabled]}
                  onPress={() => signOutDevice(device)}
                  disabled={busyId !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Sign out ${device.label}`}
                >
                  <Text style={styles.deviceButtonText}>Sign out</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
        {deviceError ? <Text style={styles.error}>{deviceError}</Text> : null}
        {devices && devices.length > 0 ? (
          <View style={styles.spaced}>
            <SecondaryButton label="Sign out of every device" onPress={signOutEverywhere} disabled={signingOutAll} />
          </View>
        ) : null}
      </Card>

      <Card
        title="Lock my account"
        subtitle="Think someone else has your account? Lock it. Every device is signed out and nobody can sign in until you unlock it from a link we email you. Signing out of every device is gentler, but anyone who knows your password can sign straight back in."
      >
        <SecondaryButton label="Lock my account" onPress={lockAccount} disabled={locking} />
        {lockError ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {lockError}
          </Text>
        ) : null}
      </Card>

      <Card
        title="Two-factor sign-in"
        subtitle="An extra code from an authenticator app when you sign in. You turn it on or off, and save your recovery codes, on the web. If it is already on, this app asks for the code when you sign in."
      >
        <SecondaryButton
          label="Manage two-factor on the web"
          onPress={() =>
            void openOnWeb('/dashboard/settings/security').catch(() =>
              Alert.alert(
                'We could not open the web page',
                'Open ATHENA in your phone’s browser, then go to Settings, then Security.'
              )
            )
          }
        />
      </Card>

      <Card
        title="Delete your account"
        subtitle="This erases your personal information straight away, ends any membership you pay for, and signs you out everywhere. It cannot be undone. It is done on the web, in the Privacy Centre, where you can also download your data first. You may be asked to sign in there, and for your password again (and your authenticator code, if you use two-factor)."
      >
        <SecondaryButton
          label="Delete my account on the web"
          onPress={() =>
            void openOnWeb('/privacy-center').catch(() =>
              Alert.alert(
                'We could not open the web page',
                'Open ATHENA in your phone’s browser, then go to the Privacy Centre.'
              )
            )
          }
        />
      </Card>

      <Card title="Change your password" subtitle="Changing it signs every other device out.">
        <Text style={styles.label}>Current password</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          accessibilityLabel="Current password"
        />
        <Text style={styles.label}>New password</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          accessibilityLabel="New password"
        />
        <Text style={styles.hint}>{PASSWORD_RULE}</Text>
        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          accessibilityLabel="Confirm new password"
        />
        <View style={styles.spaced}>
          <PrimaryButton label="Change password" onPress={() => void changePassword()} busy={changing} />
        </View>
        {passwordError ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {passwordError}
          </Text>
        ) : null}
        {passwordNotice ? (
          <Text style={styles.notice} accessibilityLiveRegion="polite">
            {passwordNotice}
          </Text>
        ) : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.page },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: colours.ink },
  subtitle: { marginTop: 6, fontSize: 14, color: colours.muted, lineHeight: 20 },
  device: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colours.line,
  },
  deviceText: { flex: 1, paddingRight: 8 },
  deviceName: { fontSize: 15, fontWeight: '600', color: colours.ink },
  deviceMeta: { marginTop: 2, fontSize: 13, color: colours.muted },
  deviceButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceButtonText: { color: colours.bad, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  spaced: { marginTop: 14 },
  label: { marginTop: 12, marginBottom: 6, fontSize: 14, fontWeight: '600', color: colours.body },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colours.ink,
    backgroundColor: '#fff',
  },
  hint: { marginTop: 6, fontSize: 13, color: colours.muted, lineHeight: 18 },
  error: { marginTop: 10, fontSize: 14, color: colours.bad, lineHeight: 20 },
  notice: { marginTop: 10, fontSize: 14, color: colours.good, lineHeight: 20 },
});
