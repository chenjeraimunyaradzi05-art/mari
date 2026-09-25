/**
 * Skills Marketplace Screen
 * Browse the services members offer, then open one for its packages,
 * reviews and a favourite toggle.
 *
 * GET /skills-marketplace/services answers { success, data: [...], pagination }
 * and orders by rating, then newest; the chips come from
 * GET /skills-marketplace/categories with a live count each. Ordering is
 * completed on the web, where the card hold is authorised, so the detail
 * screen says so and links there rather than pretending a tap here places
 * an order.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  skillsMarketplaceApi,
  MarketplaceService,
  ServiceCategoryCount,
  categoryLabel,
  formatAud,
  providerName,
  startingPrice,
} from '../services/api-extensions';
import { unwrapApiData } from '../services/api';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { LoadingError } from '../components/ErrorBoundary';

const PAGE_SIZE = 20;

interface ServiceCardProps {
  service: MarketplaceService;
  onPress: () => void;
}

function ServiceCard({ service, onPress }: ServiceCardProps) {
  const price = startingPrice(service);
  const rated = typeof service.rating === 'number' && service.reviewCount > 0;

  return (
    <TouchableOpacity style={styles.serviceCard} onPress={onPress} accessibilityRole="button" accessibilityLabel={service.title}>
      <View style={styles.thumbnailContainer}>
        <View style={styles.thumbnailPlaceholder}>
          <Ionicons name="briefcase-outline" size={32} color="#9ca3af" />
        </View>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{categoryLabel(service.category)}</Text>
        </View>
        {service.isFavorite ? (
          <View style={styles.favouriteBadge}>
            <Ionicons name="heart" size={14} color="#e11d48" />
          </View>
        ) : null}
      </View>

      <View style={styles.serviceInfo}>
        <View style={styles.providerRow}>
          <View style={styles.providerAvatar}>
            <Text style={styles.providerAvatarText}>{providerName(service).charAt(0)}</Text>
          </View>
          <Text style={styles.providerName} numberOfLines={1}>
            {providerName(service)}
          </Text>
        </View>

        <Text style={styles.serviceTitle} numberOfLines={2}>
          {service.title}
        </Text>

        <View style={styles.ratingRow}>
          {rated ? (
            <>
              <Ionicons name="star" size={13} color="#fbbf24" />
              <Text style={styles.ratingText}>{service.rating!.toFixed(1)}</Text>
              <Text style={styles.reviewCount}>({service.reviewCount})</Text>
            </>
          ) : (
            <Text style={styles.reviewCount}>No reviews yet</Text>
          )}
        </View>

        {price ? (
          <Text style={styles.price}>
            {formatAud(price.amount)}
            <Text style={styles.priceUnit}> / {price.unit}</Text>
          </Text>
        ) : (
          <Text style={styles.priceUnit}>Price on request</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function SkillsMarketplaceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [services, setServices] = useState<MarketplaceService[]>([]);
  const [categories, setCategories] = useState<ServiceCategoryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  // "No services match — try another category" was shown for a failed request
  // as well as an empty result, so a dropped connection read as an empty
  // marketplace and pointed her at a filter that was never the problem.
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    skillsMarketplaceApi
      .getCategories()
      .then((res) => {
        const list = unwrapApiData<ServiceCategoryCount[]>(res.data);
        setCategories(Array.isArray(list) ? list : []);
      })
      .catch((error) => console.error('Failed to fetch categories:', error));
  }, []);

  const fetchServices = useCallback(async (pageNum: number, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);

      const response = await skillsMarketplaceApi.getServices({
        page: pageNum,
        limit: PAGE_SIZE,
        category: selectedCategory ?? undefined,
        search: submittedSearch || undefined,
      });

      const list = unwrapApiData<MarketplaceService[]>(response.data);
      const newItems = Array.isArray(list) ? list : [];
      const pages: number | undefined = response.data?.pagination?.pages;

      setServices((prev) => (isRefresh || pageNum === 1 ? newItems : [...prev, ...newItems]));
      setHasMore(typeof pages === 'number' ? pageNum < pages : newItems.length === PAGE_SIZE);
      setPage(pageNum);
      setLoadError(null);
    } catch (error: any) {
      // A later page that fails leaves the services already listed alone; only
      // a first page that fails has nothing behind it to explain itself.
      setHasMore(false);
      if (isRefresh || pageNum === 1) {
        setLoadError(error?.response?.data?.message || 'Services could not be loaded. Check your connection and try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, submittedSearch]);

  useEffect(() => {
    fetchServices(1);
  }, [fetchServices]);

  const handleRefresh = () => {
    fetchServices(1, true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchServices(page + 1);
    }
  };

  const chips: Array<{ key: string | null; label: string }> = [
    { key: null, label: 'All' },
    ...categories.map((c) => ({ key: c.category, label: c.count > 0 ? `${categoryLabel(c.category)} (${c.count})` : categoryLabel(c.category) })),
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back" style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Skills Marketplace</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('MyOrders')}
          accessibilityRole="button"
          accessibilityLabel="My orders"
          style={styles.headerButton}
        >
          <Ionicons name="receipt-outline" size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => setSubmittedSearch(searchQuery.trim())}
          returnKeyType="search"
          placeholder="Search services..."
          placeholderTextColor="#9ca3af"
          accessibilityLabel="Search services"
        />
        {searchQuery !== '' && (
          <TouchableOpacity
            onPress={() => {
              setSearchQuery('');
              setSubmittedSearch('');
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter */}
      {chips.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {chips.map((chip) => {
            const active = selectedCategory === chip.key;
            return (
              <TouchableOpacity
                key={chip.key ?? 'all'}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelectedCategory(chip.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{chip.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <Text style={styles.orderNote}>Highest rated first, then newest. Orders and payment are completed on the web.</Text>

      {/* Services Grid */}
      {loading && services.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ServiceCard service={item} onPress={() => navigation.navigate('ServiceDetail', { serviceId: item.id, title: item.title })} />
          )}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading && services.length > 0 ? (
              <ActivityIndicator style={styles.footerLoader} color="#6366f1" />
            ) : null
          }
          ListEmptyComponent={
            loadError ? (
              <LoadingError message={loadError} onRetry={handleRefresh} />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="storefront-outline" size={64} color="#9ca3af" />
                <Text style={styles.emptyText}>No services match</Text>
                <Text style={styles.emptySubtext}>Try another category or clear your search.</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 52,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  // Filters
  filterContainer: {
    maxHeight: 50,
    marginTop: 12,
  },
  filterContent: {
    paddingHorizontal: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  filterChipText: {
    fontSize: 14,
    color: '#6b7280',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  orderNote: {
    marginHorizontal: 16,
    marginTop: 10,
    fontSize: 12,
    color: '#9ca3af',
  },
  // List
  listContent: {
    padding: 12,
    paddingBottom: 100,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  // Service Card
  serviceCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  thumbnailContainer: {
    position: 'relative',
    height: 90,
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  favouriteBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 3,
  },
  serviceInfo: {
    padding: 12,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  providerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  providerAvatarText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  providerName: {
    flex: 1,
    fontSize: 12,
    color: '#6b7280',
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
    lineHeight: 18,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  reviewCount: {
    fontSize: 12,
    color: '#9ca3af',
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  priceUnit: {
    fontSize: 11,
    fontWeight: '400',
    color: '#6b7280',
  },
  footerLoader: {
    paddingVertical: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
});
