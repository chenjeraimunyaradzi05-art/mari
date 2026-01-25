import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export function SavedJobsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Saved Jobs</Text>
      <Text style={styles.subtitle}>Keep track of roles you want to revisit.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>No saved jobs</Text>
        <Text style={styles.cardText}>Save jobs from the listings to review later.</Text>
      </View>
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
  },
  cardText: {
    marginTop: 6,
    fontSize: 13,
    color: '#6b7280',
  },
});
