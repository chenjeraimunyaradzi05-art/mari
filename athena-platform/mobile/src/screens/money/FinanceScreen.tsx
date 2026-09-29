/**
 * Finance: savings goals, super, and the financial health score.
 *
 * Three separate reads, each with its own failure, so a super list that did
 * not load does not blank the goals, and a goal list that did not load is
 * never shown as "no goals yet". Money is never moved from here: a goal is
 * filled by recording what she has put aside herself, and ATHENA has no feed
 * from any super fund, so a balance is the one she typed in and the screen
 * says so.
 *
 * The health score is shown with the sentence the server sends about what
 * each part actually measures. Three of its four parts are presence checks
 * (has she set a goal, linked a fund), and the score must not be read as a
 * measurement of her finances that ATHENA has not made.
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { unwrapApiData } from '../../services/api';
import { GOAL_TYPES, financeApi, type HealthScore, type SavingsGoal, type SuperAccount } from '../../services/money';
import { loadFailure } from '../../utils/apiErrors';
import { aud, shortDate, toNumber, words } from '../../utils/format';
import { Card, LoadError, Loading, Muted, PrimaryButton, ProgressBar, Row, SectionTitle, WebRow, colours, pillarStyles } from '../../components/pillar/PillarUi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Part<T> = { state: 'loading' | 'ready' | 'failed'; data: T | null; error: string | null };

const loading = <T,>(): Part<T> => ({ state: 'loading', data: null, error: null });

type SubScore = 'emergencyFundScore' | 'superScore' | 'insuranceScore' | 'savingsRateScore';

const MEASURE_LABELS: Array<{ key: SubScore; measure: string; label: string }> = [
  { key: 'emergencyFundScore', measure: 'emergencyFund', label: 'Safety net' },
  { key: 'superScore', measure: 'super', label: 'Super' },
  { key: 'insuranceScore', measure: 'insurance', label: 'Insurance' },
  { key: 'savingsRateScore', measure: 'savingsRate', label: 'Saving' },
];

export function FinanceScreen() {
  const navigation = useNavigation<Nav>();
  const [goals, setGoals] = useState<Part<SavingsGoal[]>>(loading);
  const [superPart, setSuperPart] = useState<Part<{ accounts: SuperAccount[]; totalBalance: number }>>(loading);
  const [score, setScore] = useState<Part<HealthScore>>(loading);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [g, s, h] = await Promise.allSettled([financeApi.goals(), financeApi.superAccounts(), financeApi.healthScore()]);
    setGoals(
      g.status === 'fulfilled'
        ? { state: 'ready', data: (() => { const list = unwrapApiData<SavingsGoal[]>(g.value.data); return Array.isArray(list) ? list : []; })(), error: null }
        : { state: 'failed', data: null, error: loadFailure(g.reason, 'Your savings goals') }
    );
    setSuperPart(
      s.status === 'fulfilled'
        ? { state: 'ready', data: unwrapApiData<{ accounts: SuperAccount[]; totalBalance: number }>(s.value.data), error: null }
        : { state: 'failed', data: null, error: loadFailure(s.reason, 'Your super') }
    );
    setScore(h.status === 'fulfilled' ? { state: 'ready', data: unwrapApiData<HealthScore>(h.value.data), error: null } : { state: 'failed', data: null, error: loadFailure(h.reason, 'Your health score') });
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const accounts = superPart.data?.accounts ?? [];
  const measures = score.data?.recommendations?.measures ?? {};
  const advice = (score.data?.recommendations?.items ?? []).filter((i): i is string => typeof i === 'string');

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
      <SectionTitle>Savings goals</SectionTitle>
      {goals.state === 'loading' && <Loading label="Reading your goals…" />}
      {goals.state === 'failed' && goals.error && <LoadError title="Your goals could not be read" message={goals.error} onRetry={() => void load()} />}
      {goals.state === 'ready' && goals.data && (
        <>
          {goals.data.length === 0 ? (
            <Card>
              <Muted>No savings goals yet. A goal is a target and a bar that fills as you record what you have put aside: a deposit, a course, a trip, a safety net.</Muted>
            </Card>
          ) : (
            goals.data.map((goal) => {
              const current = toNumber(goal.currentAmount) ?? 0;
              const target = toNumber(goal.targetAmount) ?? 0;
              const type = GOAL_TYPES.find((t) => t.value === goal.type)?.label ?? words(goal.type);
              return (
                <TouchableOpacity key={goal.id} onPress={() => navigation.navigate('SavingsGoal', { goalId: goal.id })} accessibilityRole="button" accessibilityLabel={goal.name}>
                  <Card title={goal.name} subtitle={[type, goal.status !== 'ACTIVE' ? words(goal.status) : null, goal.targetDate ? `by ${shortDate(goal.targetDate, { month: 'short', year: 'numeric' })}` : null].filter(Boolean).join(' · ')}>
                    <Text style={styles.amounts}>
                      {aud(current)} <Text style={styles.of}>of {aud(target)}</Text>
                    </Text>
                    <ProgressBar pct={goal.progressPct} tone={goal.status === 'COMPLETED' ? 'good' : 'indigo'} />
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
          <PrimaryButton label="Start a goal" icon="add" onPress={() => navigation.navigate('SavingsGoal', undefined)} />
        </>
      )}

      <SectionTitle>Super</SectionTitle>
      {superPart.state === 'loading' && <Loading label="Reading your super…" />}
      {superPart.state === 'failed' && superPart.error && <LoadError title="Your super could not be read" message={superPart.error} onRetry={() => void load()} />}
      {superPart.state === 'ready' && (
        <Card>
          {accounts.length === 0 ? (
            <Muted>No super fund added yet.</Muted>
          ) : (
            <>
              {accounts.map((a) => (
                <Row key={a.id} label={a.fundName} value={aud(a.balance)} />
              ))}
              {accounts.length > 1 ? <Row label="Together" value={aud(superPart.data?.totalBalance)} /> : null}
              <Muted>These are the balances you entered. ATHENA has no feed from your fund, so check your fund's app for today's figure.</Muted>
            </>
          )}
          <WebRow label={accounts.length === 0 ? 'Add your fund' : 'Update a balance'} path="/dashboard/finance/super" />
        </Card>
      )}

      <SectionTitle>Financial health</SectionTitle>
      {score.state === 'loading' && <Loading label="Working out your score…" />}
      {score.state === 'failed' && score.error && <LoadError title="Your score could not be worked out" message={score.error} onRetry={() => void load()} />}
      {score.state === 'ready' && score.data && (
        <Card>
          <Text style={styles.score}>
            {score.data.overallScore}
            <Text style={styles.of}> of 100</Text>
          </Text>
          <Muted>A score from what you have set up on ATHENA, not from your bank accounts, which ATHENA cannot see.</Muted>
          {MEASURE_LABELS.map((m) => (
            <View key={m.key} style={styles.measure}>
              <Row label={m.label} value={`${score.data?.[m.key] ?? '–'} of 100`} />
              {measures[m.measure] ? <Muted>{measures[m.measure]}</Muted> : null}
            </View>
          ))}
          {advice.length > 0 && (
            <View style={styles.advice}>
              <Text style={styles.adviceTitle}>Next things to try</Text>
              {advice.map((a) => (
                <Muted key={a}>• {a}</Muted>
              ))}
            </View>
          )}
        </Card>
      )}

      <SectionTitle>More on the web</SectionTitle>
      <Card>
        <WebRow icon="shield-outline" label="Insurance" hint="Income protection and the other covers, compared plainly" path="/dashboard/finance/insurance" />
        <WebRow icon="card-outline" label="Debts" hint="Paid off in the right order" path="/dashboard/finance/debt" />
        <WebRow icon="book-outline" label="The books" hint="Bank feeds, invoices and the BAS, for a business" path="/dashboard/finance" />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  amounts: { fontSize: 18, fontWeight: '700', color: colours.ink, marginTop: 8 },
  of: { fontSize: 14, fontWeight: '400', color: colours.muted },
  score: { fontSize: 32, fontWeight: '700', color: colours.ink },
  measure: { marginTop: 6 },
  advice: { marginTop: 12, gap: 4 },
  adviceTitle: { fontWeight: '600', color: colours.ink },
});
