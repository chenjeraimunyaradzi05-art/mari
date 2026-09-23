/**
 * Safety: safe mode and its settings, emergency contacts, and the panic
 * button, on the phone where they are most needed.
 *
 * Two things on this screen used to tell a woman something that was not true,
 * and both are the kind of untruth that gets someone hurt:
 *
 * 1. A failed settings fetch was caught, logged to a console nobody reads,
 *    and left `settings` null. Every switch then drew from `settings?.[key]`,
 *    so all five protections showed OFF, the panic button vanished without a
 *    word and the contacts list said "Nobody yet". On a flaky connection the
 *    app told a survivor she was exposed when she was not — and if she
 *    touched a switch to "fix" it, the write overwrote the real setting.
 *    Nothing on this screen may now render a protection in a state that was
 *    not read from the server: until the fetch succeeds there are no
 *    switches, only a named error and a retry.
 *
 * 2. The panic button reported a fixed "Alert sent" built from `result.notified`,
 *    a field the server does not return. The server returns who was emailed and
 *    who could not be reached, and that is what is shown now — loudly, and with
 *    an offer to dial 000, when nobody was reached at all.
 *
 * Email is the only channel the server's panic alert has, so the contact form
 * asks for an email address and will not save a contact without one. A
 * contact saved before that rule existed is flagged in the list, because a
 * contact the button cannot reach is worse than no contact at all: it looks
 * like cover that is not there.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, StyleSheet, TextInput, Alert, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { safetyApi, SafetySettings, unwrapApiData } from '../services/api';
import { describePanicOutcome, isEmailAddress, type PanicMessage, type PanicOutcome } from '../utils/panicAlert';

const HELPLINE = { name: '1800RESPECT', number: '1800737732', display: '1800 737 732' };

const SETTING_ROWS: Array<{ key: keyof SafetySettings; label: string; detail: string }> = [
  { key: 'isSafeMode', label: 'Safe mode', detail: 'Hides you from search, limits who can message you and keeps notifications neutral.' },
  { key: 'hideFromSearch', label: 'Hide from search', detail: 'Your profile does not come up when people search.' },
  { key: 'allowMessages', label: 'Allow messages', detail: 'Off means only people you already talk with can reach you.' },
  { key: 'notificationsSafe', label: 'Neutral notifications', detail: 'Notifications show no names or message text on the lock screen.' },
  { key: 'panicButtonEnabled', label: 'Panic button', detail: 'Shows the button below; pressing it alerts your emergency contacts.' },
];

const EMPTY_CONTACT = { name: '', phone: '', email: '', relationship: '' };

const callEmergency = () => Linking.openURL('tel:000');

export function SafetyScreen() {
  const [settings, setSettings] = useState<SafetySettings | null>(null);
  // 'loading' and 'failed' both mean: we do not know what her protections are,
  // and must not draw them.
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contact, setContact] = useState(EMPTY_CONTACT);
  const [isSaving, setIsSaving] = useState(false);
  // The last panic result stays on screen after the alert box is dismissed;
  // in a crisis a dialog is read once and gone.
  const [panicResult, setPanicResult] = useState<PanicMessage | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoadState((current) => (current === 'ready' ? current : 'loading'));
    try {
      const response = await safetyApi.settings();
      setSettings(unwrapApiData<SafetySettings>(response.data));
      setLoadError(null);
      setLoadState('ready');
    } catch (error: any) {
      // The previous settings are dropped with the error: showing the last
      // ones we read would be the same lie in a slower form.
      setSettings(null);
      setLoadError(error?.response?.data?.message || 'This phone could not reach ATHENA.');
      setLoadState('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (key: keyof SafetySettings, value: boolean) => {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, [key]: value });
    try {
      const response = await safetyApi.update({ [key]: value });
      setSettings(unwrapApiData<SafetySettings>(response.data));
    } catch (error: any) {
      setSettings(previous);
      Alert.alert('Not saved', error?.response?.data?.message || 'Try again in a moment.');
    }
  };

  const panic = () => {
    Alert.alert('Alert your emergency contacts?', 'They will be emailed and told you need help now.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send alert',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await safetyApi.panic();
            const outcome = describePanicOutcome(unwrapApiData<PanicOutcome>(response.data));
            setPanicResult(outcome);
            Alert.alert(
              outcome.title,
              outcome.body,
              outcome.reachedNobody
                ? [
                    { text: 'Call 000', style: 'destructive', onPress: callEmergency },
                    { text: 'Close', style: 'cancel' },
                  ]
                : [{ text: 'Close' }]
            );
          } catch (error: any) {
            const message = error?.response?.data?.message || 'The alert did not leave this phone.';
            setPanicResult({ title: 'The alert did not go out', body: `${message} Nobody has been told. Call 000 if you are in danger.`, reachedNobody: true });
            Alert.alert('The alert did not go out', `${message} Nobody has been told.`, [
              { text: 'Call 000', style: 'destructive', onPress: callEmergency },
              { text: 'Close', style: 'cancel' },
            ]);
          }
        },
      },
    ]);
  };

  const addContact = async () => {
    if (!contact.name.trim() || contact.phone.trim().length < 5 || !contact.relationship.trim()) {
      Alert.alert('Add a name, a phone number and how you know them');
      return;
    }
    if (!isEmailAddress(contact.email)) {
      Alert.alert(
        'An email address is needed',
        'The panic button alerts your contacts by email — it is the only way ATHENA can reach them. Without an address, this person cannot be told.'
      );
      return;
    }
    setIsSaving(true);
    try {
      await safetyApi.addContact({
        name: contact.name.trim(),
        phone: contact.phone.trim(),
        email: contact.email.trim(),
        relationship: contact.relationship.trim(),
        notifyOnPanic: true,
      });
      setContact(EMPTY_CONTACT);
      await load();
    } catch (error: any) {
      Alert.alert('Not added', error?.response?.data?.message || 'Try again in a moment.');
    } finally {
      setIsSaving(false);
    }
  };

  const removeContact = (id: string, name: string) => {
    Alert.alert(`Remove ${name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await safetyApi.removeContact(id);
            await load();
          } catch (error: any) {
            Alert.alert('Not removed', error?.response?.data?.message || 'Try again in a moment.');
          }
        },
      },
    ]);
  };

  // The one object the render is allowed to draw protections from: non-null
  // only when a fetch actually succeeded, so a switch cannot be drawn from a
  // guess.
  const loaded = loadState === 'ready' ? settings : null;
  const contacts = loaded?.emergencyContacts ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.helpBox}>
        <Ionicons name="call-outline" size={20} color="#9f1239" />
        <View style={styles.helpText}>
          <TouchableOpacity onPress={callEmergency} accessibilityRole="button" accessibilityLabel="Call 000">
            <Text style={styles.helpTitle}>If you are in danger now, call 000.</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${HELPLINE.number}`)}>
            <Text style={styles.helpLink}>
              {HELPLINE.name} · {HELPLINE.display}, 24 hours
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loadState === 'failed' && (
        <View style={styles.errorBox} accessibilityLiveRegion="polite">
          <Text style={styles.errorTitle}>Your settings could not be read</Text>
          <Text style={styles.errorBody}>
            {loadError} Nothing has changed — safe mode and your other protections are still exactly as you last saved them. This screen will not
            show them, or the panic button, until it can read them, so that it never tells you a protection is off when it is on.
          </Text>
          <View style={styles.errorActions}>
            <TouchableOpacity style={styles.retryButton} onPress={() => void load()} accessibilityRole="button">
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.callButton} onPress={callEmergency} accessibilityRole="button">
              <Text style={styles.callText}>Call 000</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loaded?.panicButtonEnabled && (
        <TouchableOpacity style={styles.panicButton} onPress={panic} accessibilityLabel="Panic button">
          <Ionicons name="alert-circle" size={24} color="#fff" />
          <Text style={styles.panicText}>I need help now</Text>
        </TouchableOpacity>
      )}

      {panicResult && (
        <View style={[styles.panicResult, panicResult.reachedNobody && styles.panicResultBad]} accessibilityLiveRegion="assertive">
          <Text style={[styles.panicResultTitle, panicResult.reachedNobody && styles.panicResultTitleBad]}>{panicResult.title}</Text>
          <Text style={styles.panicResultBody}>{panicResult.body}</Text>
          {panicResult.reachedNobody && (
            <TouchableOpacity style={styles.callButton} onPress={callEmergency} accessibilityRole="button">
              <Text style={styles.callText}>Call 000</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Settings</Text>
      <View style={styles.card}>
        {loadState === 'loading' && (
          <View style={styles.pending}>
            <ActivityIndicator color="#6366f1" />
            <Text style={styles.muted}>Reading your settings…</Text>
          </View>
        )}
        {loadState === 'failed' && <Text style={styles.muted}>Not shown: your settings could not be read just now. Tap “Try again” above.</Text>}
        {loaded &&
          SETTING_ROWS.map((row) => (
            <View key={row.key} style={styles.settingRow}>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>{row.label}</Text>
                <Text style={styles.settingDetail}>{row.detail}</Text>
              </View>
              <Switch value={Boolean(loaded[row.key])} onValueChange={(value) => toggle(row.key, value)} trackColor={{ true: '#6366f1' }} />
            </View>
          ))}
      </View>

      <Text style={styles.sectionTitle}>Emergency contacts</Text>
      <View style={styles.card}>
        {loadState === 'loading' && <Text style={styles.muted}>Reading your contacts…</Text>}
        {loadState === 'failed' && <Text style={styles.muted}>Not shown: your contacts could not be read just now. Tap “Try again” above.</Text>}
        {loaded && contacts.length === 0 && (
          <Text style={styles.muted}>Nobody yet. Add someone who should be told if you press the panic button.</Text>
        )}
        {loaded &&
          contacts.map((c) => (
            <View key={c.id} style={styles.contactRow}>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>{c.name}</Text>
                <Text style={styles.settingDetail}>
                  {c.relationship} · {c.phone}
                </Text>
                {c.email ? (
                  <Text style={styles.settingDetail}>{c.email}</Text>
                ) : (
                  <Text style={styles.contactWarning}>No email address — the panic button cannot reach them. Remove and add them again.</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => removeContact(c.id, c.name)} accessibilityLabel={`Remove ${c.name}`}>
                <Ionicons name="trash-outline" size={20} color="#999" />
              </TouchableOpacity>
            </View>
          ))}
        <View style={styles.form}>
          <Text style={styles.formNote}>The alert is sent by email, so an email address is required.</Text>
          <TextInput value={contact.name} onChangeText={(v) => setContact({ ...contact, name: v })} placeholder="Name" style={styles.input} />
          <TextInput value={contact.phone} onChangeText={(v) => setContact({ ...contact, phone: v })} placeholder="Phone" keyboardType="phone-pad" style={styles.input} />
          <TextInput
            value={contact.email}
            onChangeText={(v) => setContact({ ...contact, email: v })}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <TextInput value={contact.relationship} onChangeText={(v) => setContact({ ...contact, relationship: v })} placeholder="How you know them" style={styles.input} />
          <TouchableOpacity style={[styles.addButton, isSaving && styles.disabled]} onPress={addContact} disabled={isSaving}>
            <Text style={styles.addButtonText}>{isSaving ? 'Adding…' : 'Add contact'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 15, paddingBottom: 40 },
  helpBox: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#fff1f2', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#fecdd3' },
  helpText: { flex: 1 },
  helpTitle: { fontWeight: '600', color: '#9f1239' },
  helpLink: { color: '#be123c', marginTop: 4, textDecorationLine: 'underline' },
  errorBox: { marginTop: 15, backgroundColor: '#fffbeb', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#fcd34d' },
  errorTitle: { fontWeight: '700', color: '#92400e', fontSize: 15 },
  errorBody: { color: '#92400e', marginTop: 6, fontSize: 13, lineHeight: 19 },
  errorActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  retryButton: { backgroundColor: '#92400e', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  retryText: { color: '#fff', fontWeight: '600' },
  callButton: { backgroundColor: '#dc2626', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start', marginTop: 4 },
  callText: { color: '#fff', fontWeight: '700' },
  panicButton: { marginTop: 15, backgroundColor: '#dc2626', borderRadius: 14, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  panicText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  panicResult: { marginTop: 12, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  panicResultBad: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  panicResultTitle: { fontWeight: '700', color: '#111827' },
  panicResultTitleBad: { color: '#991b1b' },
  panicResultBody: { marginTop: 6, fontSize: 13, color: '#374151', lineHeight: 19 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase', marginTop: 24, marginBottom: 8, letterSpacing: 0.5 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 6 },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: '500', color: '#333' },
  settingDetail: { fontSize: 12, color: '#777', marginTop: 2 },
  contactWarning: { fontSize: 12, color: '#b45309', marginTop: 4 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  muted: { color: '#888', padding: 10, fontSize: 13 },
  form: { padding: 10, gap: 8 },
  formNote: { fontSize: 12, color: '#777' },
  input: { backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#333' },
  addButton: { backgroundColor: '#6366f1', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 4 },
  addButtonText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
