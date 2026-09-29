/**
 * One car from the catalogue: the price and when it was checked, the ANCAP
 * rating and whether it has lapsed, the safety features, five years of
 * running costs, a repayment and an insurance estimate, and what women who own
 * one say.
 *
 * The estimates are ATHENA's own arithmetic, and each one says what it
 * assumed: the deposit, the rate and the term for the repayment, the driver
 * and the state for the insurance. None of them is a quote, and ATHENA holds
 * no credit licence, so nothing here offers to arrange one.
 *
 * A car the server says is not in the catalogue is "not in the catalogue". A
 * request that did not get through is said to have not got through.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { unwrapApiData } from '../../services/api';
import { carsApi, type CarDetail } from '../../services/cars';
import { isNotFound, loadFailure } from '../../utils/apiErrors';
import { aud } from '../../utils/format';
import { AsAt, Card, LoadError, Loading, Muted, Notes, Row, SectionTitle, Stat, WebRow, colours, pillarStyles } from '../../components/pillar/PillarUi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function CarDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'CarDetail'>>();
  const navigation = useNavigation<Nav>();
  const slug = route.params?.slug;
  const [car, setCar] = useState<CarDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'gone' | 'failed'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) {
      setState('gone');
      return;
    }
    setState('loading');
    try {
      const response = await carsApi.car(slug);
      setCar(unwrapApiData<CarDetail>(response.data));
      setState('ready');
    } catch (error) {
      setCar(null);
      if (isNotFound(error)) {
        setState('gone');
      } else {
        setLoadError(loadFailure(error, 'This car'));
        setState('failed');
      }
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === 'loading') {
    return (
      <View style={pillarStyles.screen}>
        <Loading label="Loading the car…" />
      </View>
    );
  }

  if (state === 'gone') {
    return (
      <View style={[pillarStyles.screen, pillarStyles.content]}>
        <Card title="That car is not in the catalogue">
          <Muted>It may have been retired from the list. The catalogue has the cars that are in it now.</Muted>
        </Card>
      </View>
    );
  }

  if (state === 'failed' || !car) {
    return (
      <View style={[pillarStyles.screen, pillarStyles.content]}>
        <LoadError title="This car could not be loaded" message={loadError ?? 'Check your connection and try again.'} onRetry={() => void load()} />
      </View>
    );
  }

  const fitted = car.safety.filter((f) => f.fitted);
  const missing = car.safety.filter((f) => !f.fitted);
  const reviews = car.reviews.filter((r) => !r.isHidden).slice(0, 3);

  return (
    <ScrollView style={pillarStyles.screen} contentContainerStyle={pillarStyles.content}>
      <Card>
        <Text style={styles.name}>
          {car.make} {car.model}
        </Text>
        <Text style={styles.variant}>{[car.variant, car.year, car.bodyLabel, `${car.seats} seats`, car.fuelLabel].filter(Boolean).join(' · ')}</Text>
        <Stat big label="From, before on-road costs" value={aud(car.priceFrom)} />
        <AsAt text={car.asAt ? `Price as at ${car.asAt}.` : 'No as-at is recorded for this price; check it with a dealer.'} />
        {car.sourceUrl ? (
          <TouchableOpacity onPress={() => void Linking.openURL(car.sourceUrl ?? '')} accessibilityRole="link">
            <Text style={styles.link}>Where the price was checked</Text>
          </TouchableOpacity>
        ) : null}
        {car.highlights.length > 0 ? <Notes notes={car.highlights} /> : null}
      </Card>

      <SectionTitle>Safety</SectionTitle>
      <Card>
        <Text style={[styles.ancap, car.ancap.status !== 'current' && styles.ancapWarn]}>ANCAP: {car.ancap.label}</Text>
        {car.ancap.status === 'expired' ? <Muted>An ANCAP rating lapses after six years; a lapsed rating says nothing about the car as it is sold today.</Muted> : null}
        {fitted.map((f) => (
          <View key={f.key} style={styles.feature}>
            <Ionicons name="checkmark-circle" size={16} color={colours.good} />
            <Text style={styles.featureText}>{f.name}</Text>
          </View>
        ))}
        {missing.length > 0 ? <Muted>{`Check with the dealer: ${missing.map((f) => f.name.toLowerCase()).join(', ')}.`}</Muted> : null}
      </Card>

      <SectionTitle>What it costs to own</SectionTitle>
      <Card>
        <View style={styles.stats}>
          <Stat label="Five years, all in" value={aud(car.ownership.totals.total)} sub={`about ${aud(car.ownership.totals.perWeek)} a week`} />
          <Stat label="Repayment, estimated" value={`${aud(car.finance.repayment)} a month`} sub={`${aud(car.finance.deposit)} deposit, ${car.finance.ratePct}% over ${Math.round(car.finance.termMonths / 12)} years`} />
        </View>
        <View style={styles.stats}>
          <Stat label="Comprehensive insurance, estimated" value={`${aud(car.insurance.low)} to ${aud(car.insurance.high)} a year`} sub={`a 35-year-old driver in ${car.insurance.state}`} />
        </View>
        <Notes notes={car.ownership.assumptions} />
        <Muted>Estimates from ATHENA's own arithmetic, not quotes. ATHENA does not arrange finance or insurance.</Muted>
        {car.warranty ? <Row label="Warranty" value={car.warranty} /> : null}
        {car.servicingCostYear ? <Row label="Servicing, a typical year" value={aud(car.servicingCostYear)} /> : null}
        {car.energy ? <Row label="Consumption" value={car.energy} /> : null}
        {car.emissions ? <Row label="Tailpipe emissions" value={car.emissions} /> : null}
      </Card>

      <SectionTitle>Women who own one</SectionTitle>
      <Card>
        {car.womenSay ? (
          <Text style={styles.body}>
            {car.womenSay.rating} of 5 from {car.womenSay.count} review{car.womenSay.count === 1 ? '' : 's'}, reliability {car.womenSay.reliability}.
            {car.womenSay.owners > 0 ? ` ${car.womenSay.owners} from women with this car in their ATHENA garage.` : ''}
          </Text>
        ) : (
          <Muted>No reviews yet.</Muted>
        )}
        {reviews.map((r) => (
          <View key={r.id} style={styles.review}>
            <Text style={styles.reviewTitle}>
              {'★'.repeat(Math.max(0, Math.min(5, Math.round(r.rating))))} {r.title ?? ''}
            </Text>
            <Text style={styles.body} numberOfLines={5}>
              {r.body}
            </Text>
            <Muted>
              {r.by}
              {r.isOwner ? ', owns one' : ''}
            </Muted>
          </View>
        ))}
        <WebRow label="Read every review, or write one" path={`/cars/new/${car.slug}`} />
      </Card>

      {car.similar.length > 0 && (
        <>
          <SectionTitle>Similar, at a similar price</SectionTitle>
          <Card>
            {car.similar.map((s) => (
              <TouchableOpacity key={s.id} style={styles.similar} onPress={() => navigation.push('CarDetail', { slug: s.slug, title: `${s.make} ${s.model}` })} accessibilityRole="button">
                <Text style={styles.similarName}>
                  {s.make} {s.model}
                </Text>
                <Muted>From {aud(s.priceFrom)}</Muted>
              </TouchableOpacity>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 22, fontWeight: '700', color: colours.ink },
  variant: { fontSize: 13, color: colours.muted, marginTop: 2, marginBottom: 10 },
  link: { color: colours.primaryDeep, marginTop: 6, textDecorationLine: 'underline', fontSize: 13 },
  ancap: { fontSize: 15, fontWeight: '600', color: colours.ink, marginBottom: 6 },
  ancapWarn: { color: colours.warn },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  featureText: { color: colours.body, fontSize: 14 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 },
  body: { color: colours.body, fontSize: 14, lineHeight: 21 },
  review: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colours.line },
  reviewTitle: { fontWeight: '600', color: colours.ink, marginBottom: 4 },
  similar: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colours.line },
  similarName: { fontSize: 15, color: colours.ink, fontWeight: '600' },
});
