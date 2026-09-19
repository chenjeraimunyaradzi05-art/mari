/**
 * My orders: the packages the member has bought on the skills marketplace,
 * read-only, from GET /skills-marketplace/orders/me. Paying, approving a
 * delivery, asking for a revision and cancelling all happen on the web, and
 * each card opens its order there.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { skillsMarketplaceApi, ServiceOrder, formatAud, orderStatusLabel, providerName } from '../services/api-extensions';
import { unwrapApiData } from '../services/api';
import { LoadingError } from '../components/ErrorBoundary';
import { openOnWeb } from './OpensOnWebScreen';

function statusTone(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'COMPLETED':
      return { bg: '#dcfce7', fg: '#166534' };
    case 'DELIVERED':
    case 'ACCEPTED':
      return { bg: '#e0e7ff', fg: '#3730a3' };
    case 'CANCELLED':
      return { bg: '#f3f4f6', fg: '#6b7280' };
    case 'REVISION_REQUESTED':
      return { bg: '#fef3c7', fg: '#92400e' };
    default:
      return { bg: '#fef3c7', fg: '#92400e' };
  }
}

// What the order needs from her next, so a glance at the list is enough.
function nextStep(order: ServiceOrder): string | null {
  if (order.status === 'PENDING' && order.escrow && order.escrow.status !== 'HELD' && order.escrow.status !== 'CAPTURED' && order.escrow.status !== 'RELEASED') {
    return 'Payment to finish on the web';
  }
  if (order.status === 'DELIVERED') return 'Delivered: approve or ask for changes on the web';
  return null;
}

export function MyOrdersScreen() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await skillsMarketplaceApi.getMyOrders({ limit: 50 });
      const list = unwrapApiData<ServiceOrder[]>(response.data);
      setOrders(Array.isArray(list) ? list : []);
      setFailed(false);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setFailed(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const renderItem = ({ item }: { item: ServiceOrder }) => {
    const tone = statusTone(item.status);
    const step = nextStep(item);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => openOnWeb(`/skills-marketplace/orders/${item.id}`)}
        accessibilityRole="link"
        accessibilityLabel={`${item.service?.title ?? 'Order'}, ${orderStatusLabel(item.status)}, opens on the web`}
      >
        <View style={styles.cardHead}>
          <View style={styles.cardText}>
            <Text style={styles.title} numberOfLines={2}>{item.service?.title ?? 'Service'}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {providerName(item.service ?? {})}
              {item.packageName ? ` · ${item.packageName}` : ''}
            </Text>
          </View>
          <Text style={styles.amount}>{formatAud(item.totalAmount)}</Text>
        </View>
        <View style={styles.cardFoot}>
          <View style={[styles.chip, { backgroundColor: tone.bg }]}>
            <Text style={[styles.chipText, { color: tone.fg }]}>{orderStatusLabel(item.status)}</Text>
          </View>
          <Text style={styles.date}>
            {item.dueAt && item.status !== 'COMPLETED' && item.status !== 'CANCELLED'
              ? `Due ${new Date(item.dueAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
              : `Ordered ${new Date(item.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}
          </Text>
        </View>
        {step ? (
          <View style={styles.step}>
            <Ionicons name="open-outline" size={14} color="#4338ca" />
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); load(); }} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.subtitle}>Payments, deliveries and revisions are handled on the web. Tap an order to open it there.</Text>
            {failed ? <LoadingError message="We couldn't load your orders." onRetry={load} /> : null}
          </View>
        }
        ListEmptyComponent={
          failed ? null : (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={40} color="#c7d2fe" />
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptyBody}>When you order a package from a member, it will be listed here.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  content: { padding: 15, paddingBottom: 40 },
  header: { marginBottom: 12 },
  subtitle: { fontSize: 13, color: '#6b7280', lineHeight: 19 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start' },
  cardText: { flex: 1, marginRight: 10 },
  title: { fontSize: 15, fontWeight: '600', color: '#111827' },
  meta: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700', color: '#4338ca' },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: '600' },
  date: { fontSize: 12, color: '#9ca3af' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  stepText: { fontSize: 12, color: '#4338ca', fontWeight: '500' },
  emptyCard: { backgroundColor: '#fff', padding: 20, borderRadius: 12, alignItems: 'center' },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: '600', color: '#111827' },
  emptyBody: { marginTop: 6, fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 19 },
});
