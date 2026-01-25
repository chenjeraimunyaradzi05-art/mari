import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

export function SavedJobsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Saved Jobs</Text>
      <Text style={styles.subtitle}>Review roles you bookmarked for later.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>No saved jobs</Text>
        <Text style={styles.cardText}>
          Tap the bookmark on a job to save it here.
        </Text>
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
