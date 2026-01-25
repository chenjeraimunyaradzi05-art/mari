import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

export function HelpSupportScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Help & Support</Text>
      <Text style={styles.subtitle}>Get answers or reach the ATHENA support team.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Support Inbox</Text>
        <Text style={styles.cardText}>Email us at support@athena.app</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Community Guidelines</Text>
        <Text style={styles.cardText}>Review safety policies and reporting options.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  subtitle: { marginTop: 6, color: '#6b7280' },
  card: { marginTop: 20, backgroundColor: '#fff', padding: 16, borderRadius: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardText: { marginTop: 6, color: '#6b7280' },
});
