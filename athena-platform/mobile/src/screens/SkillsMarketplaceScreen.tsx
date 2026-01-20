/**
 * Skills Marketplace Screen
 * Browse and order skill-based services
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
  Modal,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { skillsMarketplaceApi, MarketplaceService } from '../services/api-extensions';

interface ServiceCardProps {
  service: MarketplaceService;
  onPress: () => void;
}

function ServiceCard({ service, onPress }: ServiceCardProps) {
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Ionicons key={i} name="star" size={14} color="#fbbf24" />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Ionicons key={i} name="star-half" size={14} color="#fbbf24" />);
      } else {
        stars.push(<Ionicons key={i} name="star-outline" size={14} color="#fbbf24" />);
      }
    }
    return stars;
  };

  return (
    <TouchableOpacity style={styles.serviceCard} onPress={onPress}>
      <View style={styles.thumbnailContainer}>
        {service.thumbnailUrl ? (
          <Image source={{ uri: service.thumbnailUrl }} style={styles.thumbnail} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="briefcase-outline" size={32} color="#9ca3af" />
          </View>
        )}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{service.category}</Text>
        </View>
      </View>

      <View style={styles.serviceInfo}>
        <View style={styles.providerRow}>
          <View style={styles.providerAvatar}>
            <Text style={styles.providerAvatarText}>
              {service.provider.displayName.charAt(0)}
            </Text>
          </View>
          <Text style={styles.providerName} numberOfLines={1}>
            {service.provider.displayName}
          </Text>
          <View style={styles.providerRating}>
            <Ionicons name="star" size={12} color="#fbbf24" />
            <Text style={styles.providerRatingText}>
              {service.provider.rating.toFixed(1)}
            </Text>
          </View>
        </View>

        <Text style={styles.serviceTitle} numberOfLines={2}>
          {service.title}
        </Text>

        <View style={styles.ratingRow}>
          <View style={styles.stars}>{renderStars(service.rating)}</View>
          <Text style={styles.reviewCount}>({service.reviewCount})</Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>
            ${service.price}
            {service.pricingType === 'hourly' && <Text style={styles.priceUnit}>/hr</Text>}
          </Text>
          <View style={styles.deliveryBadge}>
            <Ionicons name="time-outline" size={12} color="#6b7280" />
            <Text style={styles.deliveryText}>{service.deliveryTime}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

interface OrderModalProps {
  visible: boolean;
  service: MarketplaceService | null;
  onClose: () => void;
  onSubmit: (requirements: string) => void;
  loading: boolean;
}

function OrderModal({ visible, service, onClose, onSubmit, loading }: OrderModalProps) {
  const [requirements, setRequirements] = useState('');

  const handleSubmit = () => {
    if (!requirements.trim()) {
      Alert.alert('Error', 'Please describe your requirements');
      return;
    }
    onSubmit(requirements.trim());
  };

  if (!service) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Place Order</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Service Summary */}
            <View style={styles.serviceSummary}>
              <Text style={styles.summaryTitle}>{service.title}</Text>
              <View style={styles.summaryProvider}>
                <Text style={styles.summaryProviderText}>
                  by {service.provider.displayName}
                </Text>
              </View>
              <View style={styles.summaryDetails}>
                <View style={styles.summaryDetail}>
                  <Ionicons name="cash-outline" size={18} color="#6366f1" />
                  <Text style={styles.summaryDetailText}>
                    ${service.price}
                    {service.pricingType === 'hourly' ? '/hr' : ' fixed'}
                  </Text>
                </View>
                <View style={styles.summaryDetail}>
                  <Ionicons name="time-outline" size={18} color="#6366f1" />
                  <Text style={styles.summaryDetailText}>{service.deliveryTime}</Text>
                </View>
              </View>
            </View>

            {/* Requirements */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Describe Your Requirements *</Text>
              <TextInput
                style={styles.requirementsInput}
                value={requirements}
                onChangeText={setRequirements}
                placeholder="Explain what you need in detail. Include any specific requirements, deadlines, or preferences..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            {/* Attachments */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Attachments (Optional)</Text>
              <TouchableOpacity style={styles.attachButton}>
                <Ionicons name="cloud-upload-outline" size={24} color="#6366f1" />
                <Text style={styles.attachButtonText}>Upload Files</Text>
              </TouchableOpacity>
            </View>

            {/* Order Summary */}
            <View style={styles.orderSummary}>
              <Text style={styles.orderSummaryTitle}>Order Summary</Text>
              <View style={styles.orderRow}>
                <Text style={styles.orderLabel}>Service Price</Text>
                <Text style={styles.orderValue}>${service.price}</Text>
              </View>
              <View style={styles.orderRow}>
                <Text style={styles.orderLabel}>Service Fee (5%)</Text>
                <Text style={styles.orderValue}>${(service.price * 0.05).toFixed(2)}</Text>
              </View>
              <View style={[styles.orderRow, styles.orderTotal]}>
                <Text style={styles.orderTotalLabel}>Total</Text>
                <Text style={styles.orderTotalValue}>
                  ${(service.price * 1.05).toFixed(2)}
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.orderButton, loading && styles.orderButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.orderButtonText}>Place Order</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function SkillsMarketplaceScreen() {
  const [services, setServices] = useState<MarketplaceService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<MarketplaceService | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const CATEGORIES = [
    'All',
    'Design',
    'Development',
    'Marketing',
    'Writing',
    'Video',
    'Coaching',
    'Consulting',
    'Data',
  ];

  const fetchServices = useCallback(async (pageNum: number, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);

      const response = await skillsMarketplaceApi.getServices({
        page: pageNum,
        category: selectedCategory && selectedCategory !== 'All' ? selectedCategory : undefined,
      });

      const newItems = response.data.data?.services || [];

      if (isRefresh || pageNum === 1) {
        setServices(newItems);
      } else {
        setServices(prev => [...prev, ...newItems]);
      }

      setHasMore(newItems.length === 10);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to fetch services:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory]);

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

  const handleOrder = async (requirements: string) => {
    if (!selectedService) return;

    try {
      setOrdering(true);
      await skillsMarketplaceApi.createOrder(selectedService.id, { requirements });
      Alert.alert('Success', 'Your order has been placed! The provider will contact you shortly.');
      setShowOrderModal(false);
      setSelectedService(null);
    } catch (error) {
      console.error('Failed to place order:', error);
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setOrdering(false);
    }
  };

  const openOrderModal = (service: MarketplaceService) => {
    setSelectedService(service);
    setShowOrderModal(true);
  };

  const filteredServices = services.filter(s =>
    searchQuery === '' ||
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.provider.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Skills Marketplace</Text>
        <TouchableOpacity>
          <Ionicons name="options-outline" size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search services..."
          placeholderTextColor="#9ca3af"
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.filterChip,
              (selectedCategory === category || (category === 'All' && !selectedCategory)) &&
                styles.filterChipActive,
            ]}
            onPress={() => setSelectedCategory(category === 'All' ? null : category)}
          >
            <Text
              style={[
                styles.filterChipText,
                (selectedCategory === category || (category === 'All' && !selectedCategory)) &&
                  styles.filterChipTextActive,
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Services Grid */}
      {loading && services.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={filteredServices}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ServiceCard service={item} onPress={() => openOrderModal(item)} />
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
            <View style={styles.emptyContainer}>
              <Ionicons name="storefront-outline" size={64} color="#9ca3af" />
              <Text style={styles.emptyText}>No services found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
            </View>
          }
        />
      )}

      {/* Order Modal */}
      <OrderModal
        visible={showOrderModal}
        service={selectedService}
        onClose={() => {
          setShowOrderModal(false);
          setSelectedService(null);
        }}
        onSubmit={handleOrder}
        loading={ordering}
      />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
    height: 100,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
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
  providerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  providerRatingText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
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
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  reviewCount: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 4,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  priceUnit: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6b7280',
  },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deliveryText: {
    fontSize: 11,
    color: '#6b7280',
  },
  footerLoader: {
    paddingVertical: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
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
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    padding: 20,
  },
  serviceSummary: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  summaryProvider: {
    marginBottom: 12,
  },
  summaryProviderText: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryDetails: {
    flexDirection: 'row',
    gap: 20,
  },
  summaryDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryDetailText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  requirementsInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 120,
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 8,
    gap: 8,
  },
  attachButtonText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  orderSummary: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
  },
  orderSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  orderValue: {
    fontSize: 14,
    color: '#374151',
  },
  orderTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
    marginTop: 4,
  },
  orderTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  orderTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6366f1',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  orderButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#6366f1',
    alignItems: 'center',
  },
  orderButtonDisabled: {
    opacity: 0.7,
  },
  orderButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
