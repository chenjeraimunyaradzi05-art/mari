/**
 * Cars: what needs doing for the cars she has, and the way into buying one.
 *
 * From GET /automotive/overview: the reminders (rego, service, insurance,
 * warranty) across her garage, the cars themselves, and any purchase under
 * way with the server's own sentence about what happens next. The catalogue
 * and the pre-loved listings are native screens; the garage editor, the
 * mechanics directory, the finance and insurance calculators and paying for a
 * car are on the web, and each of those rows says so.
 *
 * An overview that could not be read is shown as unreadable, never as an
 * empty garage: "no cars yet" would tell her the reminders she set are gone.
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { unwrapApiData } from '../../services/api';
import { carsApi, type CarsOverview, type Reminder } from '../../services/cars';
import { loadFailure } from '../../utils/apiErrors';
import { aud, shortDate, whole } from '../../utils/format';
import { Card, LoadError, Loading, Muted, NavRow, SectionTitle, WebRow, colours, pillarStyles } from '../../components/pillar/PillarUi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const URGENCY_WORDS: Record<Reminder['urgency'], string> = { overdue: 'Overdue', soon: 'Soon', upcoming: 'Coming up' };

export function CarsScreen() {
  const navigation = useNavigation<Nav>();
  const [overview, setOverview] = useState<CarsOverview | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setState((current) => (current === 'ready' ? current : 'loading'));
    try {
      const response = await carsApi.overview();
      setOverview(unwrapApiData<CarsOverview>(response.data));
      setLoadError(null);
      setState('ready');
    } catch (error) {
      setOverview(null);
      setLoadError(loadFailure(error, 'Your garage'));
      setState('failed');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const saved = overview?.counts.saved ?? 0;

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
      <Card>
        <NavRow icon="car-sport-outline" label="New-car catalogue" hint="Prices, ANCAP ratings, running costs, and what women who own one say" onPress={() => navigation.navigate('CarCatalogue')} />
        <NavRow icon="pricetags-outline" label="Pre-loved listings" hint="Cars from other members and dealers, with a price guide" onPress={() => navigation.navigate('CarListings')} />
        {state === 'ready' && saved > 0 ? (
          <NavRow icon="heart-outline" label={`Saved listings (${saved})`} onPress={() => navigation.navigate('CarListings', { saved: true })} />
        ) : null}
      </Card>

      {state === 'loading' && <Loading label="Reading your garage…" />}
      {state === 'failed' && loadError && <LoadError title="Your garage could not be read" message={loadError} onRetry={() => void load()} />}

      {state === 'ready' && overview && (
        <>
          {overview.reminders.length > 0 && (
            <>
              <SectionTitle>Coming up</SectionTitle>
              <Card>
                {overview.reminders.map((r) => (
                  <View key={r.key} style={styles.reminder}>
                    <Text style={[styles.urgency, r.urgency === 'overdue' && styles.overdue, r.urgency === 'soon' && styles.soon]}>{URGENCY_WORDS[r.urgency]}</Text>
                    <Text style={styles.reminderTitle}>{r.title}</Text>
                    <Muted>{r.body}</Muted>
                  </View>
                ))}
              </Card>
            </>
          )}

          <SectionTitle>Your garage</SectionTitle>
          {overview.vehicles.length === 0 ? (
            <Card>
              <Muted>No cars in your garage yet. Add one on the web and ATHENA keeps track of rego, servicing and insurance renewals for it.</Muted>
            </Card>
          ) : (
            overview.vehicles.map((v) => (
              <Card key={v.id} title={v.name} subtitle={[v.rego ? `${v.rego}${v.regoState ? ` ${v.regoState}` : ''}` : null, v.odometerNow !== null ? `about ${whole(v.odometerNow)} km` : null].filter(Boolean).join(' · ') || undefined}>
                {v.regoDueAt ? <Muted>Rego due {shortDate(v.regoDueAt)}</Muted> : null}
                {v.nextServiceDueAt ? <Muted>Service due {shortDate(v.nextServiceDueAt)}</Muted> : null}
                {v.insuranceRenewsAt ? <Muted>Insurance renews {shortDate(v.insuranceRenewsAt)}</Muted> : null}
                <Text style={styles.value}>
                  Worth about {aud(v.valuation.mid)} ({aud(v.valuation.low)} to {aud(v.valuation.high)})
                </Text>
                <Muted>{v.valuation.assumed ? 'An estimate from the year, kilometres and a typical new price; tell us what you paid on the web for a closer one.' : 'An estimate from the year, kilometres and new price; a dealer will quote differently.'}</Muted>
              </Card>
            ))
          )}

          {overview.purchases.length > 0 && (
            <>
              <SectionTitle>Buying and selling</SectionTitle>
              {overview.purchases.map((p) => (
                <Card key={p.id} title={p.listing.title} subtitle={`${p.role === 'seller' ? 'Selling' : 'Buying'} · ${aud(p.agreedAmount ?? p.offerAmount)}`}>
                  <Text style={styles.body}>{p.nextStep}</Text>
                  <WebRow label="Open this purchase" hint="Paying, the handover and releasing the money are done on the web" path={`/dashboard/cars/purchases/${p.id}`} />
                </Card>
              ))}
            </>
          )}
        </>
      )}

      <SectionTitle>More on the web</SectionTitle>
      <Card>
        <WebRow icon="construct-outline" label="Your garage" hint="Add a car, its service history and reminders" path="/dashboard/cars/garage" />
        <WebRow icon="build-outline" label="Find a mechanic" hint="Workshops that show their prices, some women-owned" path="/cars/mechanics" />
        <WebRow icon="calculator-outline" label="Car finance and insurance" hint="Repayments, what you can afford, and cover compared" path="/cars/finance" />
        <WebRow icon="cash-outline" label="Sell a car" path="/dashboard/cars/sell" />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  reminder: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colours.line },
  urgency: { fontSize: 11, fontWeight: '700', color: colours.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  overdue: { color: colours.bad },
  soon: { color: colours.warn },
  reminderTitle: { fontSize: 15, fontWeight: '600', color: colours.ink, marginTop: 2 },
  value: { marginTop: 10, color: colours.ink, fontWeight: '600' },
  body: { color: colours.body, fontSize: 14, lineHeight: 21 },
});
