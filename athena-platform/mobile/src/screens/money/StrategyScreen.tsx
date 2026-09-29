/**
 * One of the four money plans (housing, business, tax, investing): the plan
 * she has saved, if any, and the calculators for that area.
 *
 * The calculators run here on the phone. The plan itself is kept on the web,
 * where one page holds every figure for the area; this screen shows what was
 * saved and says where to change it. A plan list that could not be read is
 * shown as unreadable, never as "nothing saved", and the calculators stay
 * usable whatever happened to it, because they do not depend on it.
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { unwrapApiData } from '../../services/api';
import { strategyApi, type SavedPlan, type StrategyArea } from '../../services/money';
import { loadFailure } from '../../utils/apiErrors';
import { longDate } from '../../utils/format';
import { calculatorsFor, planFigures } from './calculators';
import { Card, LoadError, Loading, Muted, NavRow, Row, SectionTitle, WebRow, colours, pillarStyles } from '../../components/pillar/PillarUi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** The web's wording for the same estimates. */
export const MONEY_DISCLAIMER =
  'Estimates from published rates, for planning. This is general information, not personal financial advice; a licensed adviser or registered tax agent can give that.';

export const AREA_COPY: Record<StrategyArea, { title: string; blurb: string; webPath: string; webLabel: string }> = {
  HOUSING: { title: 'Housing', blurb: 'Rent you can carry, the deposit and the loan, and whether to rent or buy.', webPath: '/dashboard/housing/plan', webLabel: 'Your housing plan' },
  BUSINESS: { title: 'Business', blurb: 'The structure that suits you, how long the cash lasts, what the business is worth.', webPath: '/dashboard/business/strategy', webLabel: 'Your business plan' },
  TAX: { title: 'Tax', blurb: 'What this year will cost, the deductions worth the receipts, super, and what a sole trader puts aside.', webPath: '/dashboard/finance/tax/plan', webLabel: 'Your tax plan' },
  INVESTMENT: { title: 'Investing', blurb: 'Your safety net first, then your mix, and where it goes over the years.', webPath: '/dashboard/finance/invest', webLabel: 'Your investing plan' },
};

export function StrategyScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Strategy'>>();
  const area: StrategyArea = route.params?.area ?? 'HOUSING';
  const copy = AREA_COPY[area];
  const [plan, setPlan] = useState<SavedPlan | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState((current) => (current === 'ready' ? current : 'loading'));
    try {
      const response = await strategyApi.plans();
      const plans = unwrapApiData<SavedPlan[]>(response.data);
      setPlan((Array.isArray(plans) ? plans : []).find((p) => p.area === area) ?? null);
      setLoadError(null);
      setState('ready');
    } catch (error) {
      setPlan(null);
      setLoadError(loadFailure(error, 'Your saved plan'));
      setState('failed');
    }
  }, [area]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const figures = planFigures(area, plan?.result);

  return (
    <ScrollView style={pillarStyles.screen} contentContainerStyle={pillarStyles.content}>
      <Card>
        <Text style={styles.title}>{copy.title}</Text>
        <Muted>{copy.blurb}</Muted>
      </Card>

      <SectionTitle>Work it out</SectionTitle>
      <Card>
        {calculatorsFor(area).map((calc) => (
          <NavRow key={calc.key} icon="calculator-outline" label={calc.title} hint={calc.blurb} onPress={() => navigation.navigate('Calculator', { calculator: calc.key, title: calc.title })} />
        ))}
      </Card>

      <SectionTitle>Your saved plan</SectionTitle>
      {state === 'loading' && <Loading label="Reading your saved plan…" />}
      {state === 'failed' && loadError && <LoadError title="Your saved plan could not be read" message={loadError} onRetry={() => void load()} />}
      {state === 'ready' && (
        <Card title={plan ? plan.title || copy.webLabel : undefined}>
          {plan ? (
            <>
              <Muted>Saved {longDate(plan.updatedAt)}.</Muted>
              {figures.map((f) => (
                <Row key={f.label} label={f.label} value={f.value} />
              ))}
            </>
          ) : (
            <Muted>Nothing saved for {copy.title.toLowerCase()} yet. A plan keeps every figure from the web page together, so it is saved there.</Muted>
          )}
          <WebRow label={plan ? 'Open it on the web' : 'Make a plan on the web'} path={copy.webPath} />
        </Card>
      )}

      <Text style={styles.disclaimer}>{MONEY_DISCLAIMER}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: colours.ink, marginBottom: 4 },
  disclaimer: { fontSize: 11, color: colours.faint, lineHeight: 16 },
});
