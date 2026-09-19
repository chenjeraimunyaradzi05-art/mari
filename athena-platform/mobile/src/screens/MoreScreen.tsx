/**
 * More: the hub for everything ATHENA does beyond the feed, videos, jobs and
 * community tabs. One short row per place, grouped so a member can find the
 * pillar she came for without reading a wall of options.
 *
 * Every row goes somewhere: a native screen where one exists, and where one
 * is still being built, a screen that says so and opens the web page. A row
 * with `web` instead of `screen` opens the web page directly and says so in
 * its caption.
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { openOnWeb } from './OpensOnWebScreen';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** One short line under the label. */
  hint?: string;
} & ({ screen: (nav: Nav) => void; web?: undefined } | { web: string; screen?: undefined });

interface Section {
  title: string;
  rows: Row[];
}

const SECTIONS: Section[] = [
  {
    title: 'Look after yourself',
    rows: [
      { icon: 'heart-outline', label: 'Wellness', hint: 'Check in, hydration, cycle, and someone to talk to', screen: (nav) => nav.navigate('Wellness') },
    ],
  },
  {
    title: 'Cars',
    rows: [
      { icon: 'car-outline', label: 'Cars', hint: 'Catalogue, pre-loved listings and your garage', screen: (nav) => nav.navigate('Cars') },
    ],
  },
  {
    title: 'Money and plans',
    rows: [
      { icon: 'home-outline', label: 'Housing', hint: 'Rent or buy, borrowing power, deposit', screen: (nav) => nav.navigate('Strategy', { area: 'HOUSING' }) },
      { icon: 'storefront-outline', label: 'Business', hint: 'Structures, runway, valuation', screen: (nav) => nav.navigate('Strategy', { area: 'BUSINESS' }) },
      { icon: 'receipt-outline', label: 'Tax', hint: 'Estimate, deductions, super', screen: (nav) => nav.navigate('Strategy', { area: 'TAX' }) },
      { icon: 'trending-up-outline', label: 'Investing', hint: 'Risk profile, projections, net worth', screen: (nav) => nav.navigate('Strategy', { area: 'INVESTMENT' }) },
      { icon: 'wallet-outline', label: 'Finance', hint: 'Savings goals, super, health score, insurance', screen: (nav) => nav.navigate('Finance') },
      { icon: 'business-outline', label: 'Formation', hint: 'Your ABN or company registration', screen: (nav) => nav.navigate('Formation') },
    ],
  },
  {
    title: 'Work',
    rows: [
      { icon: 'construct-outline', label: 'Skills marketplace', hint: 'Hire a member, or offer what you do', screen: (nav) => nav.navigate('SkillsMarketplace') },
      { icon: 'school-outline', label: 'Apprenticeships', hint: 'Earn while you train', screen: (nav) => nav.navigate('Apprenticeships') },
    ],
  },
  {
    title: 'People',
    rows: [
      { icon: 'chatbubble-ellipses-outline', label: 'Messages', screen: (nav) => nav.navigate('Messages') },
      { icon: 'people-outline', label: 'Groups', screen: (nav) => nav.navigate('Groups') },
      { icon: 'sparkles-outline', label: 'Mentors', screen: (nav) => nav.navigate('Mentors') },
      { icon: 'book-outline', label: 'Learn', screen: (nav) => nav.navigate('Learn') },
    ],
  },
  {
    title: 'You',
    rows: [
      { icon: 'shield-checkmark-outline', label: 'Safety', screen: (nav) => nav.navigate('Safety') },
      { icon: 'star-outline', label: 'Membership', screen: (nav) => nav.navigate('Upgrade') },
      { icon: 'help-circle-outline', label: 'Help & Support', screen: (nav) => nav.navigate('HelpSupport') },
    ],
  },
];

export function MoreScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>Everything else ATHENA does, in one place.</Text>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.card}>
            {section.rows.map((row, index) => (
              <TouchableOpacity
                key={row.label}
                style={[styles.row, index < section.rows.length - 1 && styles.rowDivider]}
                onPress={() => (row.screen ? row.screen(navigation) : openOnWeb(row.web))}
                accessibilityRole="button"
                accessibilityLabel={row.web ? `${row.label}, opens on the web` : row.label}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={row.icon} size={20} color="#4338ca" />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.label}>{row.label}</Text>
                  {row.hint ? <Text style={styles.hint}>{row.hint}</Text> : null}
                  {row.web ? <Text style={styles.webNote}>Opens on the web</Text> : null}
                </View>
                <Ionicons name={row.web ? 'open-outline' : 'chevron-forward'} size={18} color="#c4c4c4" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 15, paddingBottom: 40 },
  intro: { color: '#666', fontSize: 14, marginBottom: 6, marginLeft: 4 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowText: { flex: 1 },
  label: { fontSize: 16, color: '#222' },
  hint: { fontSize: 12, color: '#888', marginTop: 2 },
  webNote: { fontSize: 11, color: '#4338ca', marginTop: 2 },
});
