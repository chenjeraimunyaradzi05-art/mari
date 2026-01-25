import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function HelpSupportScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Help & Support</Text>
      <Text style={styles.subtitle}>Find answers or reach out to the ATHENA team.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Popular topics</Text>
        {['Account access', 'Billing & subscriptions', 'Job applications', 'Community guidelines'].map((item) => (
          <View key={item} style={styles.listItem}>
            <Ionicons name="help-circle-outline" size={18} color="#6366f1" />
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.primaryButton}>
        <Ionicons name="mail-outline" size={18} color="#fff" />
        <Text style={styles.primaryButtonText}>Contact support</Text>
      </TouchableOpacity>
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
    paddingVertical: 6,
  },
  listText: {
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
});
