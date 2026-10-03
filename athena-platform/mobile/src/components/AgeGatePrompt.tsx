/**
 * What the phone does when ATHENA turns a write down on the minimum age.
 *
 * Mounted once, at the root. The API layer announces the two refusals
 * (services/api.ts: onAgeGateRefusal) and this answers them wherever they came
 * from, so no screen has to know about them:
 *
 *  - DATE_OF_BIRTH_REQUIRED: the account has no date of birth (it was made
 *    before one was asked for). She is asked for it here, once, and carries on.
 *    The server keeps it for good and she cannot change it afterwards, so it says
 *    that.
 *  - MINIMUM_AGE_NOT_MET: the date on the account is under the minimum. There is
 *    nothing to fill in and the number is not said back to her; she is told, in
 *    the server's words, and offered the way to write to us.
 *
 * The date is what she tells us, and nothing here calls it verified.
 */

import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, onAgeGateRefusal } from '../services/api';
import { DATE_OF_BIRTH_PATTERN, isAdultDateOfBirth, type AgeGateRefusal } from '../utils/ageGate';
import { apiMessage } from '../utils/apiErrors';
import { openOnWeb } from '../screens/OpensOnWebScreen';
import { PrimaryButton, SecondaryButton, colours } from './pillar/PillarUi';

export function AgeGatePrompt() {
  const [refusal, setRefusal] = useState<AgeGateRefusal | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onAgeGateRefusal((next) => {
        setRefusal(next);
        setError(null);
      }),
    []
  );

  if (!refusal) return null;

  const close = () => {
    if (saving) return;
    setRefusal(null);
    setValue('');
    setError(null);
  };

  const save = async () => {
    const date = value.trim();
    // The same rule the server applies, said at once. The wording does not name
    // the age back: that turns the form into a calculator.
    if (!DATE_OF_BIRTH_PATTERN.test(date) || !isAdultDateOfBirth(date)) {
      setError('Please enter your date of birth as YYYY-MM-DD. ATHENA accounts are for adults.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.post('/users/me/date-of-birth', { dateOfBirth: date });
      setRefusal(null);
      setValue('');
      Alert.alert('Thank you', 'Your date of birth is saved. You can carry on with what you were doing.');
    } catch (failure) {
      setError(apiMessage(failure, 'Your date of birth could not be saved. Nothing has changed; try again.'));
    } finally {
      setSaving(false);
    }
  };

  const contactUs = () => {
    void openOnWeb('/contact').catch(() =>
      Alert.alert('We could not open the web page', 'Open ATHENA in your phone’s browser and use Contact us.')
    );
  };

  const asksForDate = refusal.code === 'DATE_OF_BIRTH_REQUIRED';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close} accessibilityViewIsModal>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet} accessibilityRole="alert">
          <Text style={styles.title}>{asksForDate ? 'Add your date of birth' : 'This account cannot do that'}</Text>
          <Text style={styles.body}>{refusal.message}</Text>

          {asksForDate ? (
            <>
              <Text style={styles.body}>
                ATHENA is for adults. Tell us your date of birth once and you can carry on. We keep it, and you cannot change it afterwards.
              </Text>
              <Text style={styles.label}>Date of birth</Text>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={setValue}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                autoCorrect={false}
                accessibilityLabel="Date of birth, year then month then day"
                editable={!saving}
              />
              {error ? (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <PrimaryButton label="Save date of birth" onPress={() => void save()} busy={saving} />
                <SecondaryButton label="Not now" onPress={close} disabled={saving} />
              </View>
            </>
          ) : (
            <View style={styles.actions}>
              <PrimaryButton label="Contact us" onPress={contactUs} />
              <SecondaryButton label="Close" onPress={close} />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: colours.card, borderRadius: 16, padding: 20, gap: 10 },
  title: { fontSize: 18, fontWeight: '700', color: colours.ink },
  body: { fontSize: 14, color: colours.body, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colours.body, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colours.ink,
    minHeight: 44,
  },
  error: { fontSize: 13, color: colours.bad },
  actions: { gap: 10, marginTop: 6 },
});
