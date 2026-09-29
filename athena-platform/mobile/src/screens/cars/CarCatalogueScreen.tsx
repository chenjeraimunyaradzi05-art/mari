/**
 * The new-car catalogue: search, a body type, hybrids and electrics, and a
 * sort, over GET /automotive/catalogue.
 *
 * Every price here is a list price from a dated check, and the date travels
 * with it. When every car on the page was checked at the same time the page
 * says so once; when they differ, each card carries its own. A catalogue
 * price shown without its date reads as today's, and some of these were
 * written down a model year ago.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { unwrapApiData } from '../../services/api';
import { BODY_TYPES, carsApi, type CatalogueCar, type CatalogueSort } from '../../services/cars';
import { loadFailure } from '../../utils/apiErrors';
import { aud } from '../../utils/format';
import { AsAt, Chips, LoadError, Loading, colours } from '../../components/pillar/PillarUi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SORTS: ReadonlyArray<{ value: CatalogueSort; label: string }> = [
  { value: 'name', label: 'A to Z' },
  { value: 'price', label: 'Cheapest' },
  { value: 'safety', label: 'Safest' },
  { value: 'running', label: 'Cheapest to run' },
];

const BODY_CHOICES = [{ value: 'ALL', label: 'Any body' }, ...BODY_TYPES] as const;
type BodyChoice = (typeof BODY_CHOICES)[number]['value'];

export function CarCatalogueScreen() {
  const navigation = useNavigation<Nav>();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [body, setBody] = useState<BodyChoice>('ALL');
  const [electrified, setElectrified] = useState(false);
  const [sort, setSort] = useState<CatalogueSort>('name');
  const [cars, setCars] = useState<CatalogueCar[]>([]);
  const [asAt, setAsAt] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setState((current) => (current === 'ready' ? current : 'loading'));
    try {
      const response = await carsApi.catalogue({
        q: query.trim() || undefined,
        bodyType: body === 'ALL' ? undefined : body,
        electrified: electrified || undefined,
        sort,
      });
      const data = unwrapApiData<{ cars: CatalogueCar[]; asAt: string | null }>(response.data);
      setCars(Array.isArray(data?.cars) ? data.cars : []);
      setAsAt(data?.asAt ?? null);
      setLoadError(null);
      setState('ready');
    } catch (error) {
      setCars([]);
      setLoadError(loadFailure(error, 'The catalogue'));
      setState('failed');
    } finally {
      setRefreshing(false);
    }
  }, [query, body, electrified, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const renderCar = ({ item }: { item: CatalogueCar }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('CarDetail', { slug: item.slug, title: `${item.make} ${item.model}` })}
      accessibilityRole="button"
      accessibilityLabel={`${item.make} ${item.model}`}
    >
      <Text style={styles.name}>
        {item.make} {item.model}
      </Text>
      <Text style={styles.variant}>
        {[item.variant, item.year, item.bodyLabel, item.fuelLabel].filter(Boolean).join(' · ')}
      </Text>
      <Text style={styles.price}>From {aud(item.priceFrom)} before on-road costs</Text>
      <Text style={[styles.meta, item.ancap.status !== 'current' && styles.metaWarn]}>ANCAP: {item.ancap.label}</Text>
      {item.energy ? <Text style={styles.meta}>{item.energy}</Text> : null}
      {typeof item.runningCostYear === 'number' ? <Text style={styles.meta}>Fuel or charging and servicing: about {aud(item.runningCostYear)} a year at 15,000 km</Text> : null}
      {item.ratingCount > 0 ? (
        <Text style={styles.meta}>
          Women who own one: {item.ratingAvg} of 5 from {item.ratingCount}
        </Text>
      ) : null}
      {!asAt ? <AsAt text={item.asAt ? `Price as at ${item.asAt}` : 'No as-at recorded for this price; check with a dealer.'} /> : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={cars}
        keyExtractor={(item) => item.id}
        renderItem={renderCar}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={18} color={colours.faint} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={() => setQuery(search)}
                returnKeyType="search"
                placeholder="Make or model"
                placeholderTextColor={colours.faint}
                style={styles.searchInput}
                accessibilityLabel="Search the catalogue"
              />
            </View>
            <Chips options={BODY_CHOICES} value={body} onChange={setBody} />
            <Chips options={[{ value: 'any', label: 'Any fuel' }, { value: 'electrified', label: 'Hybrid or electric' }] as const} value={electrified ? 'electrified' : 'any'} onChange={(v) => setElectrified(v === 'electrified')} />
            <Chips label="Sort" options={SORTS} value={sort} onChange={setSort} />
            {state === 'ready' && asAt ? <AsAt text={`Prices as at ${asAt}. List prices before on-road costs; a dealer's drive-away price will differ.`} /> : null}
            {state === 'loading' && <Loading label="Loading the catalogue…" />}
            {state === 'failed' && loadError && <LoadError title="The catalogue could not be loaded" message={loadError} onRetry={() => void load()} />}
          </View>
        }
        ListEmptyComponent={
          state === 'ready' ? (
            <View style={styles.empty}>
              <Ionicons name="car-outline" size={48} color="#d4d4d8" />
              <Text style={styles.emptyText}>No cars in the catalogue match that. Try a wider search.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colours.page },
  list: { padding: 16, paddingBottom: 40 },
  header: { gap: 8, marginBottom: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#ececf1' },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 15, color: colours.ink },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 },
  name: { fontSize: 17, fontWeight: '700', color: colours.ink },
  variant: { fontSize: 13, color: colours.muted, marginTop: 2 },
  price: { fontSize: 15, fontWeight: '600', color: colours.primaryDeep, marginTop: 8 },
  meta: { fontSize: 13, color: colours.body, marginTop: 4 },
  metaWarn: { color: colours.warn },
  empty: { alignItems: 'center', padding: 32, gap: 10 },
  emptyText: { color: colours.muted, textAlign: 'center' },
});
