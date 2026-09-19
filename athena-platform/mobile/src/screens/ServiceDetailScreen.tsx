/**
 * A marketplace service: what it is, who offers it, its packages, its
 * reviews, and a heart to keep it. Ordering opens the web listing because
 * the order's card hold is authorised there (Stripe escrow); the screen says
 * so plainly instead of telling a member "the provider will contact you".
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useRoute } from '@react-navigation/native';
import {
  skillsMarketplaceApi,
  MarketplaceService,
  ServiceReview,
  categoryLabel,
  formatAud,
  providerName,
  readPackages,
} from '../services/api-extensions';
import { unwrapApiData } from '../services/api';
import { LoadingError } from '../components/ErrorBoundary';
import { openOnWeb } from './OpensOnWebScreen';
import type { RootStackParamList } from '../navigation/AppNavigator';

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <View style={styles.stars} accessibilityLabel={`${rating.toFixed(1)} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Ionicons key={i} name={i < full ? 'star' : 'star-outline'} size={14} color="#fbbf24" />
      ))}
    </View>
  );
}

export function ServiceDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ServiceDetail'>>();
  const { serviceId } = route.params;

  const [service, setService] = useState<MarketplaceService | null>(null);
  const [reviews, setReviews] = useState<ServiceReview[]>([]);
  const [reviewTotal, setReviewTotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [serviceRes, reviewsRes] = await Promise.all([
        skillsMarketplaceApi.getService(serviceId),
        skillsMarketplaceApi.getReviews(serviceId, { limit: 10 }).catch(() => null),
      ]);
      setService(unwrapApiData<MarketplaceService>(serviceRes.data) ?? null);
      if (reviewsRes) {
        const list = unwrapApiData<ServiceReview[]>(reviewsRes.data);
        setReviews(Array.isArray(list) ? list : []);
        const total: number | undefined = reviewsRes.data?.pagination?.total;
        setReviewTotal(typeof total === 'number' ? total : null);
      }
      setFailed(false);
    } catch (error) {
      console.error('Failed to load service:', error);
      setFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFavourite = async () => {
    if (!service) return;
    const next = !service.isFavorite;
    setService({ ...service, isFavorite: next });
    try {
      if (next) await skillsMarketplaceApi.favourite(service.id);
      else await skillsMarketplaceApi.unfavourite(service.id);
    } catch (error) {
      setService({ ...service, isFavorite: !next });
      Alert.alert('Not saved', 'We could not update your favourites just now.');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (failed || !service) {
    return (
      <View style={styles.centered}>
        <LoadingError message="We couldn't load this service." onRetry={load} />
      </View>
    );
  }

  const packages = readPackages(service.packages);
  const rated = typeof service.rating === 'number' && service.reviewCount > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text style={styles.category}>{categoryLabel(service.category)}</Text>
            <Text style={styles.title}>{service.title}</Text>
          </View>
          <TouchableOpacity
            onPress={toggleFavourite}
            style={styles.heart}
            accessibilityRole="button"
            accessibilityLabel={service.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
          >
            <Ionicons name={service.isFavorite ? 'heart' : 'heart-outline'} size={26} color="#e11d48" />
          </TouchableOpacity>
        </View>

        <View style={styles.providerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{providerName(service).charAt(0)}</Text>
          </View>
          <View style={styles.providerText}>
            <Text style={styles.providerName}>{providerName(service)}</Text>
            {service.provider?.headline ? <Text style={styles.providerHeadline} numberOfLines={1}>{service.provider.headline}</Text> : null}
          </View>
        </View>

        <View style={styles.ratingRow}>
          {rated ? (
            <>
              <Stars rating={service.rating!} />
              <Text style={styles.ratingText}>{service.rating!.toFixed(1)} · {service.reviewCount} {service.reviewCount === 1 ? 'review' : 'reviews'}</Text>
            </>
          ) : (
            <Text style={styles.ratingMuted}>No reviews yet</Text>
          )}
          {typeof service.completedCount === 'number' && service.completedCount > 0 ? (
            <Text style={styles.ratingMuted}> · {service.completedCount} completed</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>About this service</Text>
        <Text style={styles.body}>{service.description}</Text>
        {service.tags && service.tags.length > 0 ? (
          <View style={styles.tags}>
            {service.tags.map((tag) => (
              <Text key={tag} style={styles.tag}>{tag}</Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Ways to work together</Text>
        {packages.map((pkg, index) => (
          <View key={`${pkg.name}-${index}`} style={[styles.package, index > 0 && styles.packageDivider]}>
            <View style={styles.packageHead}>
              <Text style={styles.packageName}>{pkg.name}</Text>
              <Text style={styles.packagePrice}>{formatAud(pkg.price)}</Text>
            </View>
            {pkg.description ? <Text style={styles.packageBody}>{pkg.description}</Text> : null}
            <Text style={styles.packageMeta}>
              {pkg.deliveryDays > 0 ? `${pkg.deliveryDays} ${pkg.deliveryDays === 1 ? 'day' : 'days'}` : 'Delivery agreed together'}
              {typeof pkg.revisions === 'number' ? ` · ${pkg.revisions} ${pkg.revisions === 1 ? 'revision' : 'revisions'}` : ''}
            </Text>
            {pkg.features && pkg.features.length > 0 ? (
              <View style={styles.features}>
                {pkg.features.map((f) => (
                  <View key={f} style={styles.feature}>
                    <Ionicons name="checkmark-circle-outline" size={14} color="#4338ca" />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
        {service.hourlyRate > 0 ? (
          <View style={[styles.package, packages.length > 0 && styles.packageDivider]}>
            <View style={styles.packageHead}>
              <Text style={styles.packageName}>By the hour</Text>
              <Text style={styles.packagePrice}>{formatAud(service.hourlyRate)} / hr</Text>
            </View>
            {service.minimumHours && service.minimumHours > 1 ? (
              <Text style={styles.packageMeta}>{service.minimumHours} hour minimum</Text>
            ) : null}
          </View>
        ) : null}
        {packages.length === 0 && !(service.hourlyRate > 0) ? (
          <Text style={styles.body}>This provider has not listed a price yet. Ask on the web.</Text>
        ) : null}
      </View>

      <View style={styles.orderCard}>
        <Text style={styles.orderTitle}>Ordering happens on the web</Text>
        <Text style={styles.orderBody}>
          When you order, your card is held in escrow and only charged once you approve the delivery. That card step is done on the web, so this button opens the listing there, signed in as you.
        </Text>
        <TouchableOpacity
          style={styles.orderButton}
          onPress={() => openOnWeb(`/skills-marketplace/${service.id}`)}
          accessibilityRole="link"
          accessibilityLabel="Order on the web"
        >
          <Ionicons name="open-outline" size={18} color="#fff" />
          <Text style={styles.orderButtonText}>Order on the web</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Reviews{typeof reviewTotal === 'number' && reviewTotal > 0 ? ` (${reviewTotal})` : ''}
        </Text>
        {reviews.length === 0 ? (
          <Text style={styles.body}>No reviews yet. The first buyer to finish an order can leave one.</Text>
        ) : (
          reviews.map((review, index) => (
            <View key={review.id} style={[styles.review, index > 0 && styles.packageDivider]}>
              <View style={styles.reviewHead}>
                <Text style={styles.reviewAuthor}>{review.client?.displayName?.trim() || 'ATHENA member'}</Text>
                <Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
              <Stars rating={review.rating} />
              {review.content ? <Text style={styles.reviewBody}>{review.content}</Text> : null}
              {review.response ? (
                <View style={styles.reviewResponse}>
                  <Text style={styles.reviewResponseLabel}>Reply from {providerName(service)}</Text>
                  <Text style={styles.reviewBody}>{review.response}</Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 15, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  titleText: { flex: 1, marginRight: 8 },
  category: { fontSize: 12, color: '#4338ca', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 4 },
  heart: { padding: 4 },
  providerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { color: '#fff', fontWeight: '600' },
  providerText: { flex: 1 },
  providerName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  providerHeadline: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, flexWrap: 'wrap' },
  stars: { flexDirection: 'row', gap: 1, marginRight: 6 },
  ratingText: { fontSize: 13, color: '#374151' },
  ratingMuted: { fontSize: 13, color: '#9ca3af' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 10 },
  body: { fontSize: 14, color: '#4b5563', lineHeight: 21 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tag: { fontSize: 12, color: '#4338ca', backgroundColor: '#eef2ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  package: { paddingVertical: 10 },
  packageDivider: { borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  packageHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  packageName: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  packagePrice: { fontSize: 15, fontWeight: '700', color: '#4338ca' },
  packageBody: { fontSize: 13, color: '#4b5563', marginTop: 4, lineHeight: 19 },
  packageMeta: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  features: { marginTop: 8, gap: 4 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { fontSize: 13, color: '#374151' },
  orderCard: { backgroundColor: '#eef2ff', borderRadius: 12, padding: 16, marginBottom: 12 },
  orderTitle: { fontSize: 15, fontWeight: '600', color: '#312e81' },
  orderBody: { fontSize: 13, color: '#4338ca', lineHeight: 19, marginTop: 6 },
  orderButton: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 12 },
  orderButtonText: { color: '#fff', fontWeight: '600' },
  review: { paddingVertical: 10 },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  reviewAuthor: { fontSize: 14, fontWeight: '600', color: '#111827' },
  reviewDate: { fontSize: 12, color: '#9ca3af' },
  reviewBody: { fontSize: 13, color: '#4b5563', lineHeight: 19, marginTop: 6 },
  reviewResponse: { marginTop: 8, backgroundColor: '#f9fafb', borderRadius: 8, padding: 10 },
  reviewResponseLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
});
