/**
 * Safety: safe mode and its settings, emergency contacts, and the panic
 * button, on the phone where they are most needed.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, StyleSheet, TextInput, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { safetyApi, SafetySettings, unwrapApiData } from '../services/api';

const HELPLINE = { name: '1800RESPECT', number: '1800737732', display: '1800 737 732' };

const SETTING_ROWS: Array<{ key: keyof SafetySettings; label: string; detail: string }> = [
  { key: 'isSafeMode', label: 'Safe mode', detail: 'Hides you from search, limits who can message you and keeps notifications neutral.' },
  { key: 'hideFromSearch', label: 'Hide from search', detail: 'Your profile does not come up when people search.' },
  { key: 'allowMessages', label: 'Allow messages', detail: 'Off means only people you already talk with can reach you.' },
  { key: 'notificationsSafe', label: 'Neutral notifications', detail: 'Notifications show no names or message text on the lock screen.' },
  { key: 'panicButtonEnabled', label: 'Panic button', detail: 'Shows the button below; pressing it alerts your emergency contacts.' },
];

export function SafetyScreen() {
  const [settings, setSettings] = useState<SafetySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [contact, setContact] = useState({ name: '', phone: '', relationship: '' });
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await safetyApi.settings();
      setSettings(unwrapApiData<SafetySettings>(response.data));
    } catch (error) {
      console.error('Failed to load safety settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
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
    Alert.alert('Alert your emergency contacts?', 'They will be told you need help now.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send alert',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await safetyApi.panic();
            const result = unwrapApiData<{ message?: string; notified?: number }>(response.data);
            Alert.alert('Alert sent', result?.message || `${result?.notified ?? 'Your'} contacts were told.`);
          } catch (error: any) {
            Alert.alert('The alert did not go out', error?.response?.data?.message || 'Call 000 if you are in danger.');
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
    setIsSaving(true);
    try {
      await safetyApi.addContact({ name: contact.name.trim(), phone: contact.phone.trim(), relationship: contact.relationship.trim(), notifyOnPanic: true });
      setContact({ name: '', phone: '', relationship: '' });
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.helpBox}>
        <Ionicons name="call-outline" size={20} color="#9f1239" />
        <View style={styles.helpText}>
          <Text style={styles.helpTitle}>If you are in danger now, call 000.</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${HELPLINE.number}`)}>
            <Text style={styles.helpLink}>
              {HELPLINE.name} · {HELPLINE.display}, 24 hours
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {settings?.panicButtonEnabled && (
        <TouchableOpacity style={styles.panicButton} onPress={panic} accessibilityLabel="Panic button">
          <Ionicons name="alert-circle" size={24} color="#fff" />
          <Text style={styles.panicText}>I need help now</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Settings</Text>
      <View style={styles.card}>
        {SETTING_ROWS.map((row) => (
          <View key={row.key} style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>{row.label}</Text>
              <Text style={styles.settingDetail}>{row.detail}</Text>
            </View>
            <Switch value={Boolean(settings?.[row.key])} onValueChange={(value) => toggle(row.key, value)} disabled={isLoading || !settings} trackColor={{ true: '#6366f1' }} />
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Emergency contacts</Text>
      <View style={styles.card}>
        {(settings?.emergencyContacts ?? []).length === 0 && <Text style={styles.muted}>Nobody yet. Add someone who should be told if you press the panic button.</Text>}
        {(settings?.emergencyContacts ?? []).map((c) => (
          <View key={c.id} style={styles.contactRow}>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>{c.name}</Text>
              <Text style={styles.settingDetail}>
                {c.relationship} · {c.phone}
              </Text>
            </View>
            <TouchableOpacity onPress={() => removeContact(c.id, c.name)} accessibilityLabel={`Remove ${c.name}`}>
              <Ionicons name="trash-outline" size={20} color="#999" />
            </TouchableOpacity>
          </View>
        ))}
        <View style={styles.form}>
          <TextInput value={contact.name} onChangeText={(v) => setContact({ ...contact, name: v })} placeholder="Name" style={styles.input} />
          <TextInput value={contact.phone} onChangeText={(v) => setContact({ ...contact, phone: v })} placeholder="Phone" keyboardType="phone-pad" style={styles.input} />
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
  panicButton: { marginTop: 15, backgroundColor: '#dc2626', borderRadius: 14, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  panicText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase', marginTop: 24, marginBottom: 8, letterSpacing: 0.5 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 6 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: '500', color: '#333' },
  settingDetail: { fontSize: 12, color: '#777', marginTop: 2 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  muted: { color: '#888', padding: 10, fontSize: 13 },
  form: { padding: 10, gap: 8 },
  input: { backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#333' },
  addButton: { backgroundColor: '#6366f1', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 4 },
  addButtonText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
