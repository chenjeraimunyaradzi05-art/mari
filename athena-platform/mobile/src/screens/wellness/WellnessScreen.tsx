/**
 * Wellness: the day at a glance, and the way to someone to talk to.
 *
 * This used to be a card that opened the website. It is now the phone's own
 * view of the same records: today's check-in, the streak, water, the cycle,
 * the day's medications and the next appointment, from GET /wellness/today.
 * The crisis lines come first, as they do on the web, because someone may have
 * opened this at 2am; if the list cannot be loaded the three lines that are
 * always answered are shown instead of nothing.
 *
 * A day that could not be read is said to be unreadable, with a retry. It is
 * never drawn as "you have not checked in today", which would be a statement
 * about her day made because of a statement about the network.
 *
 * The deeper tools (the practitioner directory, the forums and circles, the
 * medication list and the doctor's report) stay on the web for now, and each
 * row says so before it is tapped.
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { unwrapApiData } from '../../services/api';
import { HEALTH_DISCLAIMER, SCALE_WORDS, trackerOn, wellnessApi, type WellnessReference, type WellnessToday } from '../../services/wellness';
import { apiMessage, loadFailure } from '../../utils/apiErrors';
import { shortDate, toNumber } from '../../utils/format';
import { CrisisLines } from '../../components/pillar/CrisisLines';
import { Card, LoadError, Loading, Muted, NavRow, PrimaryButton, SectionTitle, Stat, WebRow, colours, pillarStyles } from '../../components/pillar/PillarUi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type DoseStatus = 'taken' | 'skipped';

export function WellnessScreen() {
  const navigation = useNavigation<Nav>();
  const [reference, setReference] = useState<WellnessReference | null>(null);
  const [day, setDay] = useState<WellnessToday | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [savingWater, setSavingWater] = useState(false);

  const load = useCallback(async () => {
    setState((current) => (current === 'ready' ? current : 'loading'));
    const [ref, today] = await Promise.allSettled([wellnessApi.reference(), wellnessApi.today()]);
    // The reference only feeds the crisis lines, which fall back to the three
    // always-answered numbers, so its failure does not fail the screen.
    if (ref.status === 'fulfilled') setReference(unwrapApiData<WellnessReference>(ref.value.data));
    if (today.status === 'fulfilled') {
      setDay(unwrapApiData<WellnessToday>(today.value.data));
      setLoadError(null);
      setState('ready');
    } else {
      // Dropped with the error: yesterday's numbers are not today's.
      setDay(null);
      setLoadError(loadFailure(today.reason, 'Your day'));
      setState('failed');
    }
    setRefreshing(false);
  }, []);

  // On focus, so coming back from a check-in shows it.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const addGlass = async () => {
    setSavingWater(true);
    try {
      await wellnessApi.addEntry({ kind: 'HYDRATION', payload: { glasses: 1 }, add: true });
      await load();
    } catch (error) {
      Alert.alert('Not saved', apiMessage(error, 'That glass could not be saved. Check your connection and try again.'));
    } finally {
      setSavingWater(false);
    }
  };

  const markDose = (medicationId: string, name: string, time: string) => {
    const save = async (status: DoseStatus) => {
      try {
        await wellnessApi.addEntry({ kind: 'MEDICATION_DOSE', payload: { medicationId, time, status } });
        await load();
      } catch (error) {
        Alert.alert('Not saved', apiMessage(error, 'That could not be saved. Check your connection and try again.'));
      }
    };
    Alert.alert(`${name} at ${time}`, undefined, [
      { text: 'Taken', onPress: () => void save('taken') },
      { text: 'Skipped', onPress: () => void save('skipped') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const checkin = day?.todays.CHECKIN ?? null;
  const mood = toNumber(checkin?.payload?.mood);
  const glasses = toNumber(day?.todays.HYDRATION?.payload?.glasses) ?? 0;
  const streak = day?.checkinStreak.current ?? 0;

  return (
    <ScrollView
      style={pillarStyles.screen}
      contentContainerStyle={pillarStyles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      <View>
        <Text style={styles.title}>Looked after, on your terms</Text>
        <Muted>Everything health-related is encrypted before it is stored, and read only by you.</Muted>
      </View>

      <CrisisLines lines={reference?.crisisLines} limit={4} />

      <SectionTitle>Today</SectionTitle>
      {state === 'loading' && <Loading label="Reading your day…" />}
      {state === 'failed' && loadError && <LoadError message={loadError} onRetry={() => void load()} title="Your day could not be read" />}
      {state === 'ready' && day && (
        <>
          <Card tone="rose">
            {!trackerOn(day.settings, 'checkin') ? (
              <Muted>Check-ins are switched off in your wellness settings.</Muted>
            ) : checkin ? (
              <>
                <Text style={styles.big}>Checked in today</Text>
                <Muted>{mood ? `Mood: ${SCALE_WORDS.mood[mood - 1] ?? mood}.` : 'Saved.'} You can change it until the day ends.</Muted>
                <PrimaryButton label="Update today's check-in" tone="rose" onPress={() => navigation.navigate('WellnessCheckIn')} />
              </>
            ) : (
              <>
                <Text style={styles.big}>How is today going?</Text>
                <Muted>Four taps: mood, stress, anxiety and energy. A line about the day if you want one.</Muted>
                <PrimaryButton label="Check in" tone="rose" icon="heart-outline" onPress={() => navigation.navigate('WellnessCheckIn')} />
              </>
            )}
            {streak > 0 && <Text style={styles.streak}>{streak === 1 ? 'One day checked in.' : `${streak} days in a row.`}</Text>}
          </Card>

          {day.headline && (
            <Card tone={day.headline.crisis ? 'warn' : 'indigo'} title={day.headline.title}>
              <Text style={styles.body}>{day.headline.body}</Text>
            </Card>
          )}

          {trackerOn(day.settings, 'hydration') && (
            <Card>
              <View style={styles.inline}>
                <Stat label="Water today" value={glasses === 1 ? '1 glass' : `${glasses} glasses`} sub="About 2 litres is the adequate intake." />
                <PrimaryButton label="+ One glass" onPress={() => void addGlass()} busy={savingWater} />
              </View>
            </Card>
          )}

          {trackerOn(day.settings, 'cycle') && day.cycle.hasData && (
            <Card title="Cycle">
              <Text style={styles.body}>
                {day.cycle.daysUntilNextPeriod !== null && day.cycle.daysUntilNextPeriod >= 0
                  ? `Next period in about ${day.cycle.daysUntilNextPeriod} day${day.cycle.daysUntilNextPeriod === 1 ? '' : 's'}${day.cycle.nextPeriod ? `, around ${shortDate(day.cycle.nextPeriod)}` : ''}.`
                  : 'Your next period may be due now.'}
                {day.cycle.dayOfCycle ? ` Day ${day.cycle.dayOfCycle} of this cycle.` : ''}
              </Text>
              <Muted>A prediction from what you have logged ({day.cycle.confidence} confidence), not a certainty.</Muted>
            </Card>
          )}

          {trackerOn(day.settings, 'medications') && day.medications.length > 0 && (
            <Card title="Medications today" subtitle="Tap a time to mark it taken or skipped.">
              {day.medications.map((med) => (
                <View key={med.id} style={styles.med}>
                  <Text style={styles.medName}>
                    {med.name ?? 'Medication'}
                    {med.dose ? ` · ${med.dose}` : ''}
                  </Text>
                  <View style={styles.times}>
                    {med.times.map((t) => (
                      <TouchableOpacity
                        key={t.time}
                        style={[styles.time, t.status === 'taken' && styles.timeTaken, t.status === 'skipped' && styles.timeSkipped]}
                        onPress={() => markDose(med.id, med.name ?? 'Medication', t.time)}
                        accessibilityRole="button"
                        accessibilityLabel={`${med.name ?? 'Medication'} at ${t.time}, ${t.status ?? 'not marked'}`}
                      >
                        <Text style={styles.timeText}>
                          {t.time}
                          {t.status ? ` · ${t.status}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </Card>
          )}

          {day.nextBooking && (
            <Card title="Next appointment">
              <Text style={styles.body}>
                {day.nextBooking.practitioner?.name ?? 'Your practitioner'},{' '}
                {new Date(day.nextBooking.scheduledAt).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </Text>
            </Card>
          )}
        </>
      )}

      <SectionTitle>Check on yourself</SectionTitle>
      <Card>
        <NavRow icon="moon-outline" label="How have the last four weeks been?" hint="The K10, the ten questions the national health survey uses. Nothing you answer is stored." onPress={() => navigation.navigate('WellnessK10')} />
        <NavRow icon="heart-outline" label="Daily check-in" hint="Mood, stress, anxiety, energy, and last night's sleep" onPress={() => navigation.navigate('WellnessCheckIn')} />
      </Card>

      <SectionTitle>More on the web</SectionTitle>
      <Card>
        <WebRow icon="medkit-outline" label="Find a practitioner" hint="GPs, psychologists and more, with bookings" path="/dashboard/wellness/practitioners" />
        <WebRow icon="people-outline" label="Forums and support circles" hint="Moderated, with content warnings" path="/dashboard/wellness/forums" />
        <WebRow icon="bandage-outline" label="Medications and the doctor's report" path="/dashboard/wellness/medications" />
        <WebRow icon="analytics-outline" label="What the days are saying" hint="Patterns across sleep, mood and your cycle" path="/dashboard/wellness/insights" />
        <WebRow icon="lock-closed-outline" label="Wellness privacy settings" hint="Switch trackers off, or delete your health records" path="/dashboard/wellness/settings" />
      </Card>

      <Text style={styles.disclaimer}>{HEALTH_DISCLAIMER}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: colours.ink, marginBottom: 4 },
  big: { fontSize: 17, fontWeight: '700', color: colours.ink, marginBottom: 4 },
  body: { color: colours.body, fontSize: 14, lineHeight: 21 },
  streak: { marginTop: 10, color: colours.roseDeep, fontWeight: '600' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  med: { marginTop: 10 },
  medName: { color: colours.ink, fontWeight: '600' },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  time: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  timeTaken: { backgroundColor: colours.goodSoft, borderColor: '#a7f3d0' },
  timeSkipped: { backgroundColor: '#f3f4f6' },
  timeText: { fontSize: 12, color: colours.body },
  disclaimer: { fontSize: 11, color: colours.faint, lineHeight: 16, marginTop: 4 },
});
