/**
 * My plans: the housing, business, tax and investing plans she has saved,
 * with the headline figures each one holds.
 *
 * Plans are saved on the web, where a whole area's figures live on one page;
 * this is where she reads them on the phone. A list that could not be read
 * says so with a retry; "no plans yet" is only said when the server answered
 * with none.
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { unwrapApiData } from '../../services/api';
import { strategyApi, type SavedPlan, type StrategyArea } from '../../services/money';
import { loadFailure } from '../../utils/apiErrors';
import { longDate } from '../../utils/format';
import { planFigures } from './calculators';
import { AREA_COPY } from './StrategyScreen';
import { Card, LoadError, Loading, Muted, NavRow, Row, colours, pillarStyles } from '../../components/pillar/PillarUi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const AREAS: StrategyArea[] = ['HOUSING', 'BUSINESS', 'TAX', 'INVESTMENT'];

export function MyPlansScreen() {
  const navigation = useNavigation<Nav>();
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState((current) => (current === 'ready' ? current : 'loading'));
    try {
      const response = await strategyApi.plans();
      const list = unwrapApiData<SavedPlan[]>(response.data);
      setPlans(Array.isArray(list) ? list : []);
      setLoadError(null);
      setState('ready');
    } catch (error) {
      setPlans([]);
      setLoadError(loadFailure(error, 'Your plans'));
      setState('failed');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <ScrollView style={pillarStyles.screen} contentContainerStyle={pillarStyles.content}>
      {state === 'loading' && <Loading label="Reading your plans…" />}
      {state === 'failed' && loadError && <LoadError title="Your plans could not be read" message={loadError} onRetry={() => void load()} />}
      {state === 'ready' && plans.length === 0 && (
        <Card title="No plans saved yet">
          <Muted>A plan keeps the figures from one of the money pages together so you can come back to them. Plans are saved on the web; the calculators below work here on the phone.</Muted>
        </Card>
      )}
      {state === 'ready' &&
        plans.map((plan) => (
          <Card key={plan.id} title={plan.title || AREA_COPY[plan.area]?.webLabel || 'A plan'} subtitle={`${AREA_COPY[plan.area]?.title ?? plan.area} · saved ${longDate(plan.updatedAt)}`}>
            {planFigures(plan.area, plan.result).map((f) => (
              <Row key={f.label} label={f.label} value={f.value} />
            ))}
            <Text style={styles.link} onPress={() => navigation.navigate('Strategy', { area: plan.area })} accessibilityRole="link">
              Open {AREA_COPY[plan.area]?.title.toLowerCase() ?? 'this area'}
            </Text>
          </Card>
        ))}

      <Card title="The money plans">
        {AREAS.map((area) => (
          <NavRow key={area} icon="trending-up-outline" label={AREA_COPY[area].title} hint={AREA_COPY[area].blurb} onPress={() => navigation.navigate('Strategy', { area })} />
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  link: { color: colours.primaryDeep, fontWeight: '600', marginTop: 10 },
});
