/**
 * One strategy calculator: the fields it needs, the answer the server works
 * out, and the rates year that answer used.
 *
 * The fields and the reading of the answer are in ./calculators. A blank
 * optional field is left out rather than sent as zero, a required one is
 * named before anything is sent, and a refusal from the server (a figure out
 * of range) is shown under the button in the server's own words. Changing a
 * field clears the answer, so a figure on screen always belongs to the
 * numbers above it.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { unwrapApiData } from '../../services/api';
import { strategyApi, type RiskQuestion, type StrategyReference } from '../../services/money';
import { apiMessage, loadFailure } from '../../utils/apiErrors';
import { AU_STATES, buildBody, findCalculator, type CalcField, type CalcSummary } from './calculators';
import { MONEY_DISCLAIMER } from './StrategyScreen';
import { AsAt, Card, Chips, LoadError, Loading, Muted, Notes, NumberField, PrimaryButton, Row, Stat, colours, pillarStyles } from '../../components/pillar/PillarUi';

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

function initialValues(fields: CalcField[]): Record<string, string> {
  const values: Record<string, string> = {};
  // Queensland, where ATHENA is based, until she picks another state.
  for (const f of fields) if (f.kind === 'state') values[f.key] = 'QLD';
  return values;
}

export function CalculatorScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Calculator'>>();
  const calc = findCalculator(route.params?.calculator ?? '');
  const fields = useMemo(() => calc?.fields ?? [], [calc]);
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(fields));
  const [questions, setQuestions] = useState<RiskQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [questionState, setQuestionState] = useState<'idle' | 'loading' | 'ready' | 'failed'>(calc?.usesRiskQuestions ? 'loading' : 'idle');
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CalcSummary | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const loadQuestions = useCallback(async () => {
    if (!calc?.usesRiskQuestions) return;
    setQuestionState('loading');
    try {
      const response = await strategyApi.reference();
      const reference = unwrapApiData<StrategyReference>(response.data);
      setQuestions(Array.isArray(reference?.investing?.questions) ? reference.investing.questions : []);
      setQuestionState('ready');
    } catch (error) {
      setQuestionError(loadFailure(error, 'The questions'));
      setQuestionState('failed');
    }
  }, [calc]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  if (!calc) {
    return (
      <View style={[pillarStyles.screen, pillarStyles.content]}>
        <Card title="That calculator is not in the app">
          <Muted>Every calculator is on the web, in the housing, business, tax and investing plans.</Muted>
        </Card>
      </View>
    );
  }

  const setValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSummary(null);
    setRunError(null);
  };

  const run = async () => {
    const { body, missing, invalid } = buildBody(fields, values);
    if (missing.length > 0) {
      setRunError(`Fill in: ${missing.join(', ')}.`);
      return;
    }
    if (invalid.length > 0) {
      setRunError(`These need a number: ${invalid.join(', ')}.`);
      return;
    }
    if (calc.usesRiskQuestions) {
      const unanswered = questions.filter((q) => answers[q.id] === undefined);
      if (questions.length === 0 || unanswered.length > 0) {
        setRunError('Answer every question first.');
        return;
      }
      body.answers = answers;
    }
    setRunning(true);
    setRunError(null);
    try {
      const response = await calc.run(body);
      setSummary(calc.summarise(unwrapApiData<unknown>(response.data)));
    } catch (error) {
      setSummary(null);
      setRunError(apiMessage(error, 'That could not be worked out. Check your connection and try again.'));
    } finally {
      setRunning(false);
    }
  };

  const renderField = (f: CalcField) => {
    const value = values[f.key] ?? '';
    switch (f.kind) {
      case 'money':
        return <NumberField key={f.key} label={f.label} prefix="$" value={value} onChangeText={(v) => setValue(f.key, v)} hint={f.hint} placeholder={f.placeholder} />;
      case 'percent':
        return <NumberField key={f.key} label={f.label} suffix="%" value={value} onChangeText={(v) => setValue(f.key, v)} hint={f.hint} placeholder={f.placeholder} />;
      case 'years':
        return <NumberField key={f.key} label={f.label} suffix="years" value={value} onChangeText={(v) => setValue(f.key, v)} hint={f.hint} placeholder={f.placeholder} />;
      case 'number':
        return <NumberField key={f.key} label={f.label} value={value} onChangeText={(v) => setValue(f.key, v)} hint={f.hint} placeholder={f.placeholder} />;
      case 'toggle':
        return (
          <View key={f.key} style={styles.field}>
            <Chips label={f.label} options={YES_NO} value={value === 'yes' || value === 'no' ? value : null} onChange={(v) => setValue(f.key, v)} />
            {f.hint ? <Muted>{f.hint}</Muted> : null}
          </View>
        );
      case 'state':
        return (
          <View key={f.key} style={styles.field}>
            <Chips label={f.label} options={AU_STATES} value={(AU_STATES.find((s) => s.value === value)?.value ?? null)} onChange={(v) => setValue(f.key, v)} />
          </View>
        );
      case 'choice':
        return (
          <View key={f.key} style={styles.field}>
            <Chips label={f.label} options={f.choices ?? []} value={value || null} onChange={(v) => setValue(f.key, v)} />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView style={pillarStyles.screen} contentContainerStyle={pillarStyles.content} keyboardShouldPersistTaps="handled">
      <Card title={calc.title} subtitle={calc.blurb}>
        {calc.usesRiskQuestions && questionState === 'loading' && <Loading label="Loading the questions…" />}
        {calc.usesRiskQuestions && questionState === 'failed' && questionError && <LoadError title="The questions could not be loaded" message={questionError} onRetry={() => void loadQuestions()} />}
        {calc.usesRiskQuestions &&
          questionState === 'ready' &&
          questions.map((q) => (
            <View key={q.id} style={styles.question}>
              <Text style={styles.questionText}>{q.text}</Text>
              {q.options.map((o) => {
                const on = answers[q.id] === o.score;
                return (
                  <TouchableOpacity
                    key={o.score}
                    style={[styles.option, on && styles.optionOn]}
                    onPress={() => {
                      setAnswers((a) => ({ ...a, [q.id]: o.score }));
                      setSummary(null);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.optionText, on && styles.optionTextOn]}>{o.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        {fields.map(renderField)}
        <PrimaryButton label={running ? 'Working it out…' : 'Work it out'} onPress={() => void run()} busy={running} disabled={calc.usesRiskQuestions === true && questionState !== 'ready'} />
        {runError ? <Text style={styles.error}>{runError}</Text> : null}
      </Card>

      {summary && (
        <Card tone="indigo">
          <Stat big label={summary.headline.label} value={summary.headline.value} sub={summary.headline.sub} />
          <View style={styles.rows}>
            {summary.rows.map((row) => (
              <Row key={row.label} label={row.label} value={row.value} />
            ))}
          </View>
          <Notes notes={summary.notes} />
          <AsAt text={summary.asAt ? `Rates and thresholds for the ${summary.asAt}.` : null} />
        </Card>
      )}

      <Text style={styles.disclaimer}>{MONEY_DISCLAIMER} Nothing you type here is stored.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 12 },
  question: { marginTop: 14 },
  questionText: { fontSize: 14, fontWeight: '600', color: colours.ink, marginBottom: 6 },
  option: { borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: '#f3f4f8', marginTop: 5 },
  optionOn: { backgroundColor: colours.primary },
  optionText: { color: colours.body, fontSize: 14 },
  optionTextOn: { color: '#fff', fontWeight: '600' },
  rows: { marginTop: 10 },
  error: { color: colours.bad, marginTop: 10, fontSize: 13, lineHeight: 19 },
  disclaimer: { fontSize: 11, color: colours.faint, lineHeight: 16 },
});
