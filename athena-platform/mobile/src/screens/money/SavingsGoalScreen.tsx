/**
 * One savings goal, or a new one.
 *
 * ATHENA moves no money. A goal fills when she records what she has put
 * aside herself, and the form says that in as many words, because a button
 * that reads "add $200" on a finance screen is easily taken for a transfer.
 * The server refuses automatic saving for the same reason (it holds no
 * mandate to move her money), so the switch for it is not offered here.
 *
 * There is no route for a single goal, so an existing goal is read from her
 * list. A goal that is not in the list is said to be gone; a list that could
 * not be read is said to be unreadable.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { unwrapApiData } from '../../services/api';
import { GOAL_TYPES, financeApi, type GoalStatus, type GoalType, type SavingsGoal } from '../../services/money';
import { apiMessage, loadFailure } from '../../utils/apiErrors';
import { aud, localDay, longDate, shortDate, toNumber, words } from '../../utils/format';
import { Card, Chips, LoadError, Loading, Muted, NumberField, PrimaryButton, ProgressBar, Row, SecondaryButton, SectionTitle, TextField, colours, pillarStyles } from '../../components/pillar/PillarUi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const WHEN = [
  { value: '6', label: 'In 6 months' },
  { value: '12', label: 'In a year' },
  { value: '24', label: 'In 2 years' },
  { value: '36', label: 'In 3 years' },
  { value: '60', label: 'In 5 years' },
  { value: 'none', label: 'No date' },
] as const;
type When = (typeof WHEN)[number]['value'];

function monthsFromNow(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return localDay(d);
}

export function SavingsGoalScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'SavingsGoal'>>();
  const goalId = route.params?.goalId;
  return goalId ? <GoalView goalId={goalId} /> : <NewGoal />;
}

function NewGoal() {
  const navigation = useNavigation<Nav>();
  const [name, setName] = useState('');
  const [type, setType] = useState<GoalType>('EMERGENCY_FUND');
  const [target, setTarget] = useState('');
  const [when, setWhen] = useState<When>('12');
  const [monthly, setMonthly] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetAmount = toNumber(target);
  const months = when === 'none' ? null : Number(when);
  // Plain division, no interest: what putting the same amount aside each
  // month would take. Shown as a guide, and only when she has given both.
  const perMonth = targetAmount && months ? Math.ceil(targetAmount / months) : null;

  const create = async () => {
    if (!name.trim()) {
      setError('Give the goal a name.');
      return;
    }
    if (targetAmount === null || targetAmount <= 0) {
      setError('Set a target above $0.');
      return;
    }
    const monthlyTarget = monthly.trim() ? toNumber(monthly) : null;
    if (monthly.trim() && (monthlyTarget === null || monthlyTarget < 0)) {
      setError('The monthly amount needs to be a number.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await financeApi.createGoal({
        name: name.trim(),
        type,
        targetAmount,
        ...(months ? { targetDate: monthsFromNow(months) } : {}),
        ...(monthlyTarget !== null ? { monthlyTarget } : {}),
      });
      const created = unwrapApiData<SavingsGoal>(response.data);
      navigation.replace('SavingsGoal', { goalId: created.id });
    } catch (err) {
      setError(apiMessage(err, 'The goal could not be saved. Check your connection and try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={pillarStyles.screen} contentContainerStyle={pillarStyles.content} keyboardShouldPersistTaps="handled">
      <Card title="A new goal" subtitle="One bar that fills as you put money aside.">
        <TextField label="What it is for" value={name} onChangeText={setName} placeholder="A safety net, a deposit, a course" maxLength={120} />
        <View style={styles.field}>
          <Chips label="Kind" options={GOAL_TYPES} value={type} onChange={setType} />
        </View>
        <NumberField label="Target" prefix="$" value={target} onChangeText={setTarget} placeholder="10000" />
        <View style={styles.field}>
          <Chips label="By when" options={WHEN} value={when} onChange={setWhen} />
        </View>
        {perMonth ? <Muted>{`About ${aud(perMonth)} a month gets you there.`}</Muted> : null}
        <NumberField label="What you plan to put aside each month" prefix="$" value={monthly} onChangeText={setMonthly} hint="Optional. Set up the transfer with your bank; ATHENA cannot move money for you." />
        <PrimaryButton label="Save the goal" onPress={() => void create()} busy={saving} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>
    </ScrollView>
  );
}

function GoalView({ goalId }: { goalId: string }) {
  const [goal, setGoal] = useState<SavingsGoal | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'gone' | 'failed'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [reached, setReached] = useState(false);
  const [changing, setChanging] = useState(false);

  const load = useCallback(async () => {
    setState((current) => (current === 'ready' ? current : 'loading'));
    try {
      const response = await financeApi.goals();
      const list = unwrapApiData<SavingsGoal[]>(response.data);
      const found = (Array.isArray(list) ? list : []).find((g) => g.id === goalId) ?? null;
      setGoal(found);
      setState(found ? 'ready' : 'gone');
      setLoadError(null);
    } catch (error) {
      setGoal(null);
      setLoadError(loadFailure(error, 'This goal'));
      setState('failed');
    }
  }, [goalId]);

  useEffect(() => {
    void load();
  }, [load]);

  const record = async () => {
    const value = toNumber(amount);
    if (value === null || value <= 0) {
      setRecordError('Type the amount you put aside, in dollars.');
      return;
    }
    setRecording(true);
    setRecordError(null);
    try {
      const response = await financeApi.contribute(goalId, { amount: value, ...(note.trim() ? { note: note.trim() } : {}) });
      const message = (response.data as { message?: unknown } | undefined)?.message;
      setReached(typeof message === 'string' && /completed/i.test(message));
      setAmount('');
      setNote('');
      await load();
    } catch (error) {
      setRecordError(apiMessage(error, 'That could not be recorded. Check your connection and try again.'));
    } finally {
      setRecording(false);
    }
  };

  const setStatus = (status: GoalStatus, confirm?: { title: string; body: string }) => {
    const apply = async () => {
      setChanging(true);
      try {
        await financeApi.updateGoal(goalId, { status });
        await load();
      } catch (error) {
        Alert.alert('Not changed', apiMessage(error, 'Check your connection and try again.'));
      } finally {
        setChanging(false);
      }
    };
    if (!confirm) {
      void apply();
      return;
    }
    Alert.alert(confirm.title, confirm.body, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: () => void apply() },
    ]);
  };

  if (state === 'loading') {
    return (
      <View style={pillarStyles.screen}>
        <Loading label="Reading the goal…" />
      </View>
    );
  }
  if (state === 'gone') {
    return (
      <View style={[pillarStyles.screen, pillarStyles.content]}>
        <Card title="This goal is no longer there">
          <Muted>It may have been removed on the web. Your other goals are on the Finance screen.</Muted>
        </Card>
      </View>
    );
  }
  if (state === 'failed' || !goal) {
    return (
      <View style={[pillarStyles.screen, pillarStyles.content]}>
        <LoadError title="This goal could not be read" message={loadError ?? 'Check your connection and try again.'} onRetry={() => void load()} />
      </View>
    );
  }

  const current = toNumber(goal.currentAmount) ?? 0;
  const target = toNumber(goal.targetAmount) ?? 0;
  const monthly = toNumber(goal.monthlyTarget);
  const active = goal.status === 'ACTIVE';
  const type = GOAL_TYPES.find((t) => t.value === goal.type)?.label ?? words(goal.type);

  return (
    <ScrollView style={pillarStyles.screen} contentContainerStyle={pillarStyles.content} keyboardShouldPersistTaps="handled">
      <Card title={goal.name} subtitle={[type, active ? null : words(goal.status)].filter(Boolean).join(' · ')}>
        <Text style={styles.amounts}>
          {aud(current)} <Text style={styles.of}>of {aud(target)}</Text>
        </Text>
        <ProgressBar pct={goal.progressPct} tone={goal.status === 'COMPLETED' ? 'good' : 'indigo'} />
        {goal.targetDate ? <Row label="By" value={longDate(goal.targetDate)} /> : null}
        {monthly ? <Row label="Planned each month" value={aud(monthly)} /> : null}
        {target > current ? <Row label="Still to go" value={aud(target - current)} /> : null}
      </Card>

      {reached ? (
        <Card tone="good" title="Goal reached">
          <Muted>That is the whole target. Well done.</Muted>
        </Card>
      ) : null}

      {active ? (
        <Card title="Record money you have put aside" subtitle="ATHENA does not move money. This keeps a record of a transfer you made yourself, so the bar shows where you are.">
          <NumberField label="Amount" prefix="$" value={amount} onChangeText={setAmount} placeholder="200" />
          <TextField label="A note" value={note} onChangeText={setNote} placeholder="Optional, like “tax refund”" maxLength={200} />
          <PrimaryButton label="Record it" onPress={() => void record()} busy={recording} />
          {recordError ? <Text style={styles.error}>{recordError}</Text> : null}
        </Card>
      ) : (
        <Card>
          <Muted>{goal.status === 'PAUSED' ? 'This goal is paused. Resume it to record money against it.' : `This goal is ${words(goal.status).toLowerCase()}.`}</Muted>
        </Card>
      )}

      {goal.contributions.length > 0 && (
        <>
          <SectionTitle>Recorded lately</SectionTitle>
          <Card>
            {goal.contributions.map((c) => (
              <Row key={c.id} label={`${shortDate(c.createdAt)}${c.note ? ` · ${c.note}` : ''}`} value={aud(c.amount)} />
            ))}
          </Card>
        </>
      )}

      {goal.status === 'ACTIVE' && <SecondaryButton label="Pause this goal" onPress={() => setStatus('PAUSED')} disabled={changing} />}
      {goal.status === 'PAUSED' && <SecondaryButton label="Resume this goal" onPress={() => setStatus('ACTIVE')} disabled={changing} />}
      {(goal.status === 'ACTIVE' || goal.status === 'PAUSED') && (
        <SecondaryButton
          label="Stop this goal"
          disabled={changing}
          onPress={() => setStatus('CANCELLED', { title: 'Stop this goal?', body: 'It stays in your list as stopped, with what you recorded against it.' })}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 12 },
  amounts: { fontSize: 22, fontWeight: '700', color: colours.ink, marginTop: 8 },
  of: { fontSize: 15, fontWeight: '400', color: colours.muted },
  error: { color: colours.bad, marginTop: 10, fontSize: 13, lineHeight: 19 },
});
