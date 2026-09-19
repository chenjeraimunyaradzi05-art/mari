/**
 * Help & Support. The help centre and the contact form live on the web; each
 * row here opens the matching page, so the one button a stuck member presses
 * goes somewhere.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { openOnWeb } from './OpensOnWebScreen';

// The sections client/src/app/help/page.tsx lists, so every row is a page
// that exists.
const TOPICS: Array<{ label: string; path: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { label: 'Getting started', path: '/help/getting-started', icon: 'rocket-outline' },
  { label: 'Safety centre', path: '/help/safety-center', icon: 'shield-checkmark-outline' },
  { label: 'Community guidelines', path: '/help/community-guidelines', icon: 'people-outline' },
  { label: 'Privacy centre', path: '/privacy-center', icon: 'lock-closed-outline' },
  { label: 'Give feedback', path: '/help/feedback', icon: 'chatbox-ellipses-outline' },
];

export function HelpSupportScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Help & Support</Text>
      <Text style={styles.subtitle}>Find answers or reach the ATHENA team. These open in the help centre on the web.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Popular topics</Text>
        {TOPICS.map((topic) => (
          <TouchableOpacity
            key={topic.path}
            style={styles.listItem}
            onPress={() => openOnWeb(topic.path)}
            accessibilityRole="link"
            accessibilityLabel={`${topic.label}, opens on the web`}
          >
            <Ionicons name={topic.icon} size={18} color="#6366f1" />
            <Text style={styles.listText}>{topic.label}</Text>
            <Ionicons name="open-outline" size={16} color="#c4c4c4" />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => openOnWeb('/contact')}
        accessibilityRole="link"
        accessibilityLabel="Contact support, opens on the web"
      >
        <Ionicons name="mail-outline" size={18} color="#fff" />
        <Text style={styles.primaryButtonText}>Contact support</Text>
      </TouchableOpacity>
      <Text style={styles.footnote}>The contact form opens on the web, signed in as you.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  card: {
    marginTop: 16,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  footnote: {
    marginTop: 8,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
