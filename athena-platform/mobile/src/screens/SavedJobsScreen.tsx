/**
 * Saved Jobs: the roles the member bookmarked, newest first, from
 * GET /jobs/me/saved. A tap opens the job; the bookmark on each card removes
 * it (DELETE /jobs/:id/save). The empty card only shows when the list really
 * is empty.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { jobsApi, userApi, unwrapApiData, type JobSummary } from '../services/api';
import { JobListSkeleton } from '../components/Skeleton';
import { LoadingError } from '../components/ErrorBoundary';
import type { RootStackParamList } from '../navigation/AppNavigator';

function formatSalary(min?: number | null, max?: number | null): string | null {
  const k = (n: number) => `$${(n / 1000).toFixed(0)}k`;
  if (min && max) return `${k(min)} - ${k(max)}`;
  if (min) return `From ${k(min)}`;
  if (max) return `Up to ${k(max)}`;
  return null;
}

function where(job: JobSummary): string {
  if (job.isRemote) return 'Remote';
  return [job.city, job.state].filter(Boolean).join(', ') || 'Location to be confirmed';
}

export function SavedJobsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await userApi.getSavedJobs();
      const list = unwrapApiData<JobSummary[]>(response.data);
      setJobs(Array.isArray(list) ? list : []);
      setFailed(false);
    } catch (error) {
      console.error('Failed to fetch saved jobs:', error);
      setFailed(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unsave = async (job: JobSummary) => {
    const previous = jobs;
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
    try {
      await jobsApi.unsave(job.id);
    } catch (error) {
      setJobs(previous);
      Alert.alert('Not removed', 'We could not remove that job just now. Please try again.');
    }
  };

  const renderItem = ({ item }: { item: JobSummary }) => {
    const salary = formatSalary(item.salaryMin, item.salaryMax);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <View style={styles.cardHead}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>{item.organization?.name?.charAt(0) || '?'}</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={styles.jobTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.company} numberOfLines={1}>{item.organization?.name ?? 'Employer'}</Text>
          </View>
          <TouchableOpacity
            style={styles.bookmark}
            onPress={() => unsave(item)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.title} from saved jobs`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="bookmark" size={22} color="#6366f1" />
          </TouchableOpacity>
        </View>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={14} color="#666" />
            <Text style={styles.metaText}>{where(item)}</Text>
          </View>
          {item.type ? (
            <View style={styles.metaItem}>
              <Ionicons name="briefcase-outline" size={14} color="#666" />
              <Text style={styles.metaText}>{item.type.replace(/_/g, ' ').toLowerCase()}</Text>
            </View>
          ) : null}
        </View>
        {salary ? <Text style={styles.salary}>{salary}</Text> : null}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <JobListSkeleton count={3} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); load(); }} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Saved Jobs</Text>
            <Text style={styles.subtitle}>Roles you want to come back to.</Text>
            {failed ? <LoadingError message="We couldn't load your saved jobs." onRetry={load} /> : null}
          </View>
        }
        ListEmptyComponent={
          failed ? null : (
            <View style={styles.emptyCard}>
              <Ionicons name="bookmark-outline" size={40} color="#c7d2fe" />
              <Text style={styles.cardTitle}>No saved jobs</Text>
              <Text style={styles.cardBody}>Tap the bookmark on a job to keep it here for later.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  subtitle: { marginTop: 6, fontSize: 14, color: '#6b7280' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  logoText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  cardText: { flex: 1 },
  jobTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  company: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  bookmark: { padding: 4 },
  meta: { flexDirection: 'row', gap: 15, marginTop: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  metaText: { marginLeft: 4, fontSize: 13, color: '#666', textTransform: 'capitalize' },
  salary: { marginTop: 8, fontSize: 14, fontWeight: '600', color: '#059669' },
  emptyCard: { backgroundColor: '#fff', padding: 20, borderRadius: 12, alignItems: 'center' },
  cardTitle: { marginTop: 10, fontSize: 16, fontWeight: '600', color: '#111827' },
  cardBody: { marginTop: 6, fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 19 },
});
