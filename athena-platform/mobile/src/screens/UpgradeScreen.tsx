/**
 * Membership: the tier the member is on, what the tiers cost in their
 * region, and where to change it. Purchases are made on the web; app-store
 * billing is not wired into this app, and the screen says so rather than
 * showing a button that goes nowhere.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { billingApi, WEB_URL, unwrapApiData } from '../services/api';
import { getLocalPreferences } from '../utils/preferences';

type Subscription = { tier?: string; status?: string; currentPeriodEnd?: string | null; cancelAtPeriodEnd?: boolean };
type Pricing = { currency: string; subscriptionTiers: Record<string, number> };

const TIERS: Array<{ key: string; name: string; blurb: string }> = [
  { key: 'PREMIUM_CAREER', name: 'Career', blurb: 'AI job matching, resume tools and priority applications.' },
  { key: 'PREMIUM_PROFESSIONAL', name: 'Professional', blurb: 'Everything in Career, with mentoring credits and analytics.' },
  { key: 'PREMIUM_ENTREPRENEUR', name: 'Entrepreneur', blurb: 'Formation, finance and grant tools for a business.' },
  { key: 'PREMIUM_CREATOR', name: 'Creator', blurb: 'Studio tools, monetisation and a lower platform fee.' },
];

const PRICING_REGION: Record<string, string> = { ANZ: 'AU', US: 'US', UK: 'UK', SEA: 'SG', EU: 'UK' };
const tierName = (tier?: string) => TIERS.find((t) => t.key === tier)?.name ?? (tier ? tier.replace(/_/g, ' ').toLowerCase() : 'Free');

export function UpgradeScreen() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const prefs = (await getLocalPreferences().catch(() => null)) as { region?: string } | null;
        const region = PRICING_REGION[prefs?.region ?? 'ANZ'] ?? 'AU';
        const [subRes, priceRes] = await Promise.all([billingApi.subscription().catch(() => null), billingApi.pricing(region).catch(() => null)]);
        if (subRes) setSubscription(unwrapApiData<Subscription>(subRes.data));
        if (priceRes) setPricing(unwrapApiData<Pricing>(priceRes.data));
      } catch (error) {
        console.error('Failed to load membership:', error);
      }
    })();
  }, []);

  const price = (key: string) => {
    const amount = pricing?.subscriptionTiers?.[key];
    if (amount == null) return null;
    try {
      return `${new Intl.NumberFormat('en-AU', { style: 'currency', currency: pricing?.currency || 'AUD' }).format(amount)}/month`;
    } catch {
      return `${amount} ${pricing?.currency ?? ''}/month`;
    }
  };

  const currentTier = subscription?.tier && subscription.tier !== 'FREE' ? subscription.tier : undefined;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.current}>
        <Ionicons name="sparkles-outline" size={22} color="#4338ca" />
        <View style={styles.currentText}>
          <Text style={styles.currentTitle}>You are on {tierName(currentTier)}</Text>
          {subscription?.status ? (
            <Text style={styles.currentDetail}>
              {String(subscription.status).toLowerCase()}
              {subscription.currentPeriodEnd ? ` · ${subscription.cancelAtPeriodEnd ? 'ends' : 'renews'} ${new Date(subscription.currentPeriodEnd).toLocaleDateString('en-AU')}` : ''}
            </Text>
          ) : (
            <Text style={styles.currentDetail}>The free membership. Everything on this screen is what a paid tier adds.</Text>
          )}
        </View>
      </View>

      {TIERS.map((tier) => (
        <View key={tier.key} style={[styles.card, currentTier === tier.key && styles.cardCurrent]}>
          <View style={styles.cardHead}>
            <Text style={styles.cardName}>{tier.name}</Text>
            <Text style={styles.cardPrice}>{price(tier.key) ?? '—'}</Text>
          </View>
          <Text style={styles.cardBlurb}>{tier.blurb}</Text>
          {currentTier === tier.key && <Text style={styles.badge}>Your plan</Text>}
        </View>
      ))}

      <View style={styles.note}>
        <Text style={styles.noteText}>Memberships are bought and managed on the web, where the full plan comparison lives. App Store and Google Play billing is not part of this app yet, so there is no purchase button here.</Text>
        <TouchableOpacity style={styles.button} onPress={() => Linking.openURL(`${WEB_URL}/pricing`)}>
          <Text style={styles.buttonText}>See plans on the web</Text>
        </TouchableOpacity>
        {currentTier && (
          <TouchableOpacity style={styles.secondaryButton} onPress={() => Linking.openURL(`${WEB_URL}/settings`)}>
            <Text style={styles.secondaryText}>Manage my membership</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 15, paddingBottom: 40 },
  current: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#eef2ff', borderRadius: 12, padding: 14, marginBottom: 15 },
  currentText: { flex: 1 },
  currentTitle: { fontWeight: '600', color: '#312e81', fontSize: 16 },
  currentDetail: { color: '#4338ca', fontSize: 13, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: '#e5e5e5' },
  cardCurrent: { borderColor: '#6366f1' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardName: { fontSize: 17, fontWeight: '700', color: '#333' },
  cardPrice: { fontSize: 14, fontWeight: '600', color: '#4338ca' },
  cardBlurb: { color: '#555', marginTop: 6, lineHeight: 19 },
  badge: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#6366f1', color: '#fff', fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  note: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginTop: 6 },
  noteText: { color: '#555', lineHeight: 20 },
  button: { marginTop: 12, backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { marginTop: 8, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#c7d2fe' },
  secondaryText: { color: '#4338ca', fontWeight: '600' },
});
