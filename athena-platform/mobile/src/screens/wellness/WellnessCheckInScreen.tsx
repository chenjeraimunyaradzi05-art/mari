/**
 * The daily check-in: mood, stress, anxiety and energy on the same five-step
 * scales the web uses, a line about the day, and last night's sleep.
 *
 * One check-in a day; saving again replaces it. So the form waits until it has
 * read today before it offers to save: a phone that could not tell whether she
 * had already checked in must not quietly write over the one she made this
 * morning. What the server said about her streak is shown after saving, and a
 * tracker she has switched off is not asked about.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { unwrapApiData } from '../../services/api';
import { HEALTH_DISCLAIMER, SCALE_WORDS, trackerOn, wellnessApi, type Streak, type WellnessToday } from '../../services/wellness';
import { apiMessage, loadFailure } from '../../utils/apiErrors';
import { toNumber } from '../../utils/format';
import { CrisisLines } from '../../components/pillar/CrisisLines';
import { Card, LoadError, Loading, Muted, NumberField, PrimaryButton, ScaleInput, TextField, colours, pillarStyles } from '../../components/pillar/PillarUi';

type Scales = { mood: number | null; stress: number | null; anxiety: number | null; energy: number | null };

const EMPTY: Scales = { mood: null, stress: null, anxiety: null, energy: null };

function scaleOf(value: unknown): number | null {
  const n = toNumber(value);
  return n !== null && n >= 1 && n <= 5 ? Math.round(n) : null;
}

export function WellnessCheckInScreen() {
  const navigation = useNavigation();
  const [day, setDay] = useState<WellnessToday | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scales, setScales] = useState<Scales>(EMPTY);
  const [note, setNote] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ streak: Streak | null; sleepFailed: string | null } | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const response = await wellnessApi.today();
      const today = unwrapApiData<WellnessToday>(response.data);
      setDay(today);
      // Today's check-in and sleep, if she has made them, so the form edits
      // what is there rather than starting blank over it.
      const c = today.todays.CHECKIN?.payload ?? null;
      setScales({ mood: scaleOf(c?.mood), stress: scaleOf(c?.stress), anxiety: scaleOf(c?.anxiety), energy: scaleOf(c?.energy) });
      setNote(typeof c?.note === 'string' ? c.note : '');
      const s = today.todays.SLEEP?.payload ?? null;
      const hours = toNumber(s?.hours);
      setSleepHours(hours === null ? '' : String(hours));
      setSleepQuality(scaleOf(s?.quality));
      setLoadError(null);
      setState('ready');
    } catch (error) {
      setDay(null);
      setLoadError(loadFailure(error, 'Today'));
      setState('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const complete = scales.mood !== null && scales.stress !== null && scales.anxiety !== null && scales.energy !== null;
  const hours = sleepHours.trim() === '' ? null : toNumber(sleepHours);
  const hoursInvalid = sleepHours.trim() !== '' && (hours === null || hours < 0 || hours > 24);

  const save = async () => {
    if (!complete || !day) return;
    if (hoursInvalid) {
      Alert.alert('Sleep hours', 'Hours of sleep are between 0 and 24.');
      return;
    }
    setSaving(true);
    try {
      const response = await wellnessApi.addEntry({
        kind: 'CHECKIN',
        payload: { mood: scales.mood, stress: scales.stress, anxiety: scales.anxiety, energy: scales.energy, ...(note.trim() ? { note: note.trim() } : {}) },
      });
      const streak = unwrapApiData<{ streak: Streak | null }>(response.data)?.streak ?? null;
      // Sleep is its own row. If it fails the check-in has still been saved,
      // and she is told which of the two did not go through.
      let sleepFailed: string | null = null;
      if (hours !== null && trackerOn(day.settings, 'sleep')) {
        try {
          await wellnessApi.addEntry({ kind: 'SLEEP', payload: { hours, ...(sleepQuality ? { quality: sleepQuality } : {}) } });
        } catch (error) {
          sleepFailed = apiMessage(error, 'Your sleep could not be saved. Check your connection and try again.');
        }
      }
      setSaved({ streak, sleepFailed });
    } catch (error) {
      Alert.alert('Not saved', apiMessage(error, 'Your check-in could not be saved. Check your connection and try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (state === 'loading') {
    return (
      <ScrollView style={pillarStyles.screen} contentContainerStyle={pillarStyles.content}>
        <Loading label="Reading today…" />
      </ScrollView>
    );
  }

  if (state === 'failed' || !day) {
    return (
      <ScrollView style={pillarStyles.screen} contentContainerStyle={pillarStyles.content}>
        <LoadError
          title="Today could not be read"
          message={`${loadError ?? 'Today could not be loaded.'} The check-in waits until it can see whether you have already made one today, so it never writes over it.`}
          onRetry={() => void load()}
        />
        <CrisisLines lines={null} />
      </ScrollView>
    );
  }

  if (saved) {
    const streak = saved.streak?.current ?? 0;
    return (
      <ScrollView style={pillarStyles.screen} contentContainerStyle={pillarStyles.content}>
        <Card tone="rose" title="Checked in">
          <Text style={styles.body}>
            {streak > 1 ? `That is ${streak} days in a row.` : 'Thank you for taking a minute for yourself.'} Only you can read what you wrote.
          </Text>
          {saved.sleepFailed ? <Text style={styles.warn}>{saved.sleepFailed}</Text> : null}
          <PrimaryButton label="Done" tone="rose" onPress={() => navigation.goBack()} />
        </Card>
        {(scales.mood !== null && scales.mood <= 2) || (scales.anxiety !== null && scales.anxiety >= 4) ? (
          <CrisisLines lines={null} title="If you want to talk to someone now" fallbackNote={false} />
        ) : null}
      </ScrollView>
    );
  }

  if (!trackerOn(day.settings, 'checkin')) {
    return (
      <ScrollView style={pillarStyles.screen} contentContainerStyle={pillarStyles.content}>
        <Card title="Check-ins are switched off">
          <Muted>You switched the daily check-in off in your wellness privacy settings, so nothing is asked or stored here. You can switch it back on from the wellness settings on the web.</Muted>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={pillarStyles.screen} contentContainerStyle={pillarStyles.content} keyboardShouldPersistTaps="handled">
      <Card title={day.todays.CHECKIN ? "Today's check-in" : 'How is today going?'} subtitle={day.todays.CHECKIN ? 'Saving again replaces what you saved earlier today.' : 'One a day. It takes four taps.'}>
        <ScaleInput label="Mood" words={SCALE_WORDS.mood} value={scales.mood} onChange={(v) => setScales((s) => ({ ...s, mood: v }))} />
        <ScaleInput label="Stress" words={SCALE_WORDS.stress} value={scales.stress} onChange={(v) => setScales((s) => ({ ...s, stress: v }))} />
        <ScaleInput label="Anxiety" words={SCALE_WORDS.anxiety} value={scales.anxiety} onChange={(v) => setScales((s) => ({ ...s, anxiety: v }))} />
        <ScaleInput label="Energy" words={SCALE_WORDS.energy} value={scales.energy} onChange={(v) => setScales((s) => ({ ...s, energy: v }))} />
        <TextField label="A line about the day" hint="Optional. Only you read it." value={note} onChangeText={setNote} placeholder="What was going on" maxLength={500} multiline />
      </Card>

      {trackerOn(day.settings, 'sleep') && (
        <Card title="Last night's sleep" subtitle="Optional. The night that ended this morning.">
          <NumberField label="Hours" value={sleepHours} onChangeText={setSleepHours} placeholder="7.5" suffix="hours" />
          {hoursInvalid ? <Text style={styles.warn}>Hours of sleep are between 0 and 24.</Text> : null}
          <ScaleInput label="Quality" words={SCALE_WORDS.quality} value={sleepQuality} onChange={setSleepQuality} />
        </Card>
      )}

      <PrimaryButton label={saving ? 'Saving…' : 'Save check-in'} tone="rose" onPress={() => void save()} disabled={!complete || hoursInvalid} busy={saving} />
      {!complete ? <Muted>Pick a step on each of the four scales to save.</Muted> : null}

      <Text style={styles.disclaimer}>{HEALTH_DISCLAIMER}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { color: colours.body, fontSize: 14, lineHeight: 21, marginTop: 6 },
  warn: { color: colours.warn, fontSize: 13, marginTop: 8, lineHeight: 19 },
  disclaimer: { fontSize: 11, color: colours.faint, lineHeight: 16 },
});
