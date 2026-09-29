/**
 * Pre-loved listings, twenty at a time, or the ones she has saved.
 *
 * GET /automotive/listings pages at twenty and says how many there are in
 * all, so the list asks for the next page as she reaches the end and stops
 * when it has them all. A later page that fails to load says so at the foot
 * of the list and offers to try again; the cars already shown stay shown.
 *
 * A seller's PPSR tick is her own declaration, and the card says it is.
 * ATHENA has no PPSR feed, so nothing here may read as a check ATHENA made.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Image, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { unwrapApiData } from '../../services/api';
import { BODY_TYPES, VERDICT_WORDS, carsApi, type ListingCard, type ListingSort } from '../../services/cars';
import { apiMessage, loadFailure } from '../../utils/apiErrors';
import { aud, whole } from '../../utils/format';
import { Chips, LoadError, Loading, colours } from '../../components/pillar/PillarUi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SORTS: ReadonlyArray<{ value: ListingSort; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Cheapest' },
  { value: 'km', label: 'Fewest km' },
  { value: 'year', label: 'Newest cars' },
];

const BODY_CHOICES = [{ value: 'ALL', label: 'Any body' }, ...BODY_TYPES] as const;
type BodyChoice = (typeof BODY_CHOICES)[number]['value'];

export function CarListingsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'CarListings'>>();
  const savedOnly = route.params?.saved === true;
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [body, setBody] = useState<BodyChoice>('ALL');
  const [sort, setSort] = useState<ListingSort>('newest');
  const [listings, setListings] = useState<ListingCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Which request is current, so a slow answer to an old search cannot land
  // on top of the answer to the new one.
  const generation = useRef(0);

  const loadFirst = useCallback(async () => {
    const mine = ++generation.current;
    setState((current) => (current === 'ready' ? current : 'loading'));
    setMoreError(null);
    try {
      if (savedOnly) {
        const response = await carsApi.savedListings();
        const rows = unwrapApiData<ListingCard[]>(response.data);
        if (mine !== generation.current) return;
        const list = Array.isArray(rows) ? rows : [];
        setListings(list);
        setTotal(list.length);
      } else {
        const response = await carsApi.listings({ q: query.trim() || undefined, bodyType: body === 'ALL' ? undefined : body, sort: sort === 'newest' ? undefined : sort, page: 1 });
        const data = unwrapApiData<{ listings: ListingCard[]; total: number }>(response.data);
        if (mine !== generation.current) return;
        setListings(Array.isArray(data?.listings) ? data.listings : []);
        setTotal(typeof data?.total === 'number' ? data.total : 0);
      }
      setPage(1);
      setLoadError(null);
      setState('ready');
    } catch (error) {
      if (mine !== generation.current) return;
      setListings([]);
      setLoadError(loadFailure(error, savedOnly ? 'Your saved listings' : 'The listings'));
      setState('failed');
    } finally {
      if (mine === generation.current) setRefreshing(false);
    }
  }, [savedOnly, query, body, sort]);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  const loadMore = async () => {
    if (savedOnly || loadingMore || state !== 'ready' || listings.length >= total) return;
    const mine = generation.current;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = page + 1;
      const response = await carsApi.listings({ q: query.trim() || undefined, bodyType: body === 'ALL' ? undefined : body, sort: sort === 'newest' ? undefined : sort, page: next });
      const data = unwrapApiData<{ listings: ListingCard[]; total: number }>(response.data);
      if (mine !== generation.current) return;
      const incoming = Array.isArray(data?.listings) ? data.listings : [];
      // A listing that moved between pages (a new one pushed the list along)
      // arrives twice; it is shown once.
      setListings((current) => {
        const seen = new Set(current.map((l) => l.id));
        return [...current, ...incoming.filter((l) => !seen.has(l.id))];
      });
      if (typeof data?.total === 'number') setTotal(data.total);
      setPage(next);
      // An empty page before the count says the end means the count moved;
      // stop asking rather than asking for ever.
      if (incoming.length === 0) setTotal((t) => Math.min(t, listings.length));
    } catch (error) {
      if (mine === generation.current) setMoreError(loadFailure(error, 'More listings'));
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleSave = async (listing: ListingCard) => {
    const wasSaved = Boolean(listing.saved);
    setListings((current) => current.map((l) => (l.id === listing.id ? { ...l, saved: !wasSaved } : l)));
    try {
      if (wasSaved) await carsApi.unsave(listing.id);
      else await carsApi.save(listing.id);
      if (savedOnly && wasSaved) setListings((current) => current.filter((l) => l.id !== listing.id));
    } catch (error) {
      setListings((current) => current.map((l) => (l.id === listing.id ? { ...l, saved: wasSaved } : l)));
      Alert.alert(wasSaved ? 'Not removed' : 'Not saved', apiMessage(error, 'Check your connection and try again.'));
    }
  };

  const renderListing = ({ item }: { item: ListingCard }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CarListingDetail', { listingId: item.id, title: item.title })} accessibilityRole="button" accessibilityLabel={item.title}>
      {item.photos[0] ? <Image source={{ uri: item.photos[0] }} style={styles.photo} resizeMode="cover" /> : null}
      <View style={styles.cardBody}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <TouchableOpacity onPress={() => void toggleSave(item)} accessibilityRole="button" accessibilityLabel={item.saved ? `Remove ${item.title} from saved` : `Save ${item.title}`} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={item.saved ? 'heart' : 'heart-outline'} size={22} color={item.saved ? colours.rose : colours.faint} />
          </TouchableOpacity>
        </View>
        <Text style={styles.price}>{aud(item.price)}</Text>
        {item.priceVerdict && VERDICT_WORDS[item.priceVerdict] ? <Text style={styles.meta}>{VERDICT_WORDS[item.priceVerdict]}</Text> : null}
        <Text style={styles.meta}>
          {[item.year, `${whole(item.odometerKm)} km`, item.fuelLabel, item.transmission ? item.transmission.toLowerCase() : null].filter(Boolean).join(' · ')}
        </Text>
        <Text style={styles.meta}>
          {[item.suburb || item.city, item.state].filter(Boolean).join(', ')} · {item.sellerKind === 'DEALER' ? item.seller.name : 'Private seller'}
        </Text>
        {item.ppsrChecked ? <Text style={styles.note}>Seller says a PPSR check was done</Text> : null}
        {/* Any completed report counts here, the seller's own included, so it
            is not called an ATHENA inspection. */}
        {item.inspected ? <Text style={styles.note}>Has a completed inspection report</Text> : null}
      </View>
    </TouchableOpacity>
  );

  const reachedEnd = listings.length >= total;

  return (
    <View style={styles.container}>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={renderListing}
        contentContainerStyle={styles.list}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadFirst();
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {savedOnly ? (
              <Text style={styles.heading}>Listings you have saved</Text>
            ) : (
              <>
                <View style={styles.searchRow}>
                  <Ionicons name="search-outline" size={18} color={colours.faint} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    onSubmitEditing={() => setQuery(search)}
                    returnKeyType="search"
                    placeholder="Make, model or suburb"
                    placeholderTextColor={colours.faint}
                    style={styles.searchInput}
                    accessibilityLabel="Search the listings"
                  />
                </View>
                <Chips options={BODY_CHOICES} value={body} onChange={setBody} />
                <Chips label="Sort" options={SORTS} value={sort} onChange={setSort} />
                {state === 'ready' ? <Text style={styles.count}>{total === 1 ? 'One car' : `${whole(total)} cars`}</Text> : null}
              </>
            )}
            {state === 'loading' && <Loading label="Loading listings…" />}
            {state === 'failed' && loadError && <LoadError title="The listings could not be loaded" message={loadError} onRetry={() => void loadFirst()} />}
          </View>
        }
        ListEmptyComponent={
          state === 'ready' ? (
            <View style={styles.empty}>
              <Ionicons name="car-outline" size={48} color="#d4d4d8" />
              <Text style={styles.emptyText}>{savedOnly ? 'Nothing saved yet. Tap the heart on a listing to keep it here.' : 'No cars match that right now.'}</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          moreError ? (
            <LoadError title="More listings could not be loaded" message={moreError} onRetry={() => void loadMore()} />
          ) : loadingMore ? (
            <Loading label="Loading more…" />
          ) : state === 'ready' && listings.length > 0 && reachedEnd && !savedOnly ? (
            <Text style={styles.end}>That is every car listed right now.</Text>
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
  heading: { fontSize: 18, fontWeight: '700', color: colours.ink },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#ececf1' },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 15, color: colours.ink },
  count: { color: colours.muted, fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
  photo: { width: '100%', height: 170, backgroundColor: '#eee' },
  cardBody: { padding: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: colours.ink },
  price: { fontSize: 17, fontWeight: '700', color: colours.primaryDeep, marginTop: 6 },
  meta: { fontSize: 13, color: colours.body, marginTop: 3 },
  note: { fontSize: 12, color: colours.muted, marginTop: 4 },
  empty: { alignItems: 'center', padding: 32, gap: 10 },
  emptyText: { color: colours.muted, textAlign: 'center' },
  end: { color: colours.faint, textAlign: 'center', padding: 16, fontSize: 12 },
});
