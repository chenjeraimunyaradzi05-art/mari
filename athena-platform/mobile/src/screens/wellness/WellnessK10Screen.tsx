/**
 * The K10: the ten questions the national health survey uses, scored by the
 * server the way the Australian Bureau of Statistics reports it.
 *
 * The questions and the answer words come from GET /wellness/reference, the
 * same list the web shows, so the phone can never be asking a different test.
 * Nothing she answers is stored: POST /wellness/k10 scores the answers and
 * keeps nothing, and this screen says so. A moderate or high score puts the
 * support lines the server chose for that score in front of her, with a call
 * button on each.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { unwrapApiData } from '../../services/api';
import { HEALTH_DISCLAIMER, wellnessApi, type K10Result, type WellnessReference } from '../../services/wellness';
import { apiMessage, loadFailure } from '../../utils/apiErrors';
import { CrisisLines } from '../../components/pillar/CrisisLines';
import { Card, LoadError, Loading, Muted, PrimaryButton, SecondaryButton, colours, pillarStyles } from '../../components/pillar/PillarUi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function WellnessK10Screen() {
  const navigation = useNavigation<Nav>();
  const [reference, setReference] = useState<WellnessReference | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<K10Result | null>(null);
  const [scoring, setScoring] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const response = await wellnessApi.reference();
      setReference(unwrapApiData<WellnessReference>(response.data));
      setLoadError(null);
      setState('ready');
    } catch (error) {
      setLoadError(loadFailure(error, 'The questions'));
      setState('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const questions = reference?.k10.questions ?? [];
  const options = reference?.k10.options ?? [];
  const answered = questions.filter((q) => answers[q.id] !== undefined).length;
  const complete = questions.length > 0 && answered === questions.length;

  const score = async () => {
    if (!complete) return;
    setScoring(true);
    try {
      const response = await wellnessApi.k10(questions.map((q) => answers[q.id]));
      setResult(unwrapApiData<K10Result>(response.data));
    } catch (error) {
      // Her answers stay on screen; nothing is lost by a failed send.
      Alert.alert('Not scored', apiMessage(error, 'Your answers could not be scored. Check your connection and try again.'));
    } finally {
      setScoring(false);
    }
  };

  if (state === 'loading') {
    return (
      <ScrollView style={pillarStyles.screen} contentContainerStyle={pillarStyles.content}>
        <Loading label="Loading the questions…" />
      </ScrollView>
    );
  }

  if (state === 'failed') {
    return (
      <ScrollView style={pillarStyles.screen} contentContainerStyle={pillarStyles.content}>
        <LoadError title="The questions could not be loaded" message={loadError ?? 'Check your connection and try again.'} onRetry={() => void load()} />
        <CrisisLines lines={null} />
      </ScrollView>
    );
  }

  if (result) {
    const serious = result.band === 'moderate' || result.band === 'severe';
    return (
      <ScrollView style={pillarStyles.screen} contentContainerStyle={pillarStyles.content}>
        <Card tone={result.band === 'low' ? 'good' : serious ? 'warn' : 'indigo'}>
          <Muted>Your score</Muted>
          <Text style={styles.score}>
            {result.score} <Text style={styles.scoreOf}>of 50, {result.label.toLowerCase()}</Text>
          </Text>
          <Text style={styles.body}>{result.meaning}</Text>
          <Text style={styles.next}>{result.nextStep}</Text>
        </Card>
        {serious ? <CrisisLines lines={result.crisisLines} title="Someone to talk to, now" /> : null}
        <PrimaryButton label="Start the daily check-in" tone="rose" onPress={() => navigation.navigate('WellnessCheckIn')} />
        <SecondaryButton
          label="Take it again"
          onPress={() => {
            setResult(null);
            setAnswers({});
          }}
        />
        <Text style={styles.disclaimer}>Nothing you answered was stored. {HEALTH_DISCLAIMER}</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={pillarStyles.screen} contentContainerStyle={pillarStyles.content}>
      <Card title="How have the last four weeks been?" subtitle="The K10, the ten questions used in the national health survey. Nothing you answer here is stored.">
        <Text style={styles.stem}>In the past four weeks, about how often did you feel…</Text>
      </Card>

      {questions.map((q) => (
        <Card key={q.id}>
          <Text style={styles.question}>
            {q.id}. …{q.text}
          </Text>
          <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={`Question ${q.id}`}>
            {options.map((o) => {
              const on = answers[q.id] === o.value;
              return (
                <TouchableOpacity
                  key={o.value}
                  style={[styles.option, on && styles.optionOn]}
                  onPress={() => setAnswers((a) => ({ ...a, [q.id]: o.value }))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Question ${q.id}: ${o.label}`}
                >
                  <Text style={[styles.optionText, on && styles.optionTextOn]}>{o.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>
      ))}

      <PrimaryButton label={scoring ? 'Scoring…' : 'See my score'} tone="rose" onPress={() => void score()} disabled={!complete} busy={scoring} />
      <Muted>{complete ? 'All ten answered.' : `${answered} of ${questions.length} answered.`}</Muted>
      <Text style={styles.disclaimer}>{HEALTH_DISCLAIMER}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stem: { marginTop: 10, color: colours.body, fontSize: 14 },
  question: { fontSize: 15, color: colours.ink, fontWeight: '600' },
  options: { marginTop: 10, gap: 6 },
  option: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#f3f1f6' },
  optionOn: { backgroundColor: colours.rose },
  optionText: { color: colours.body, fontSize: 14 },
  optionTextOn: { color: '#fff', fontWeight: '600' },
  score: { fontSize: 30, fontWeight: '700', color: colours.ink, marginTop: 2 },
  scoreOf: { fontSize: 15, fontWeight: '500', color: colours.body },
  body: { color: colours.body, fontSize: 14, lineHeight: 21, marginTop: 8 },
  next: { color: colours.ink, fontSize: 14, lineHeight: 21, marginTop: 8, fontWeight: '600' },
  disclaimer: { fontSize: 11, color: colours.faint, lineHeight: 16 },
});
