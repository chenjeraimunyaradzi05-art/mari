/**
 * My Applications: the roles the member has applied to, newest first, each
 * with the status the employer has set. Read from GET /jobs/me/applications;
 * the empty card only shows when the list really is empty.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { APPLICATION_STATUS_DISPLAY } from '../constants/shared';
import { userApi, unwrapApiData, type JobApplication } from '../services/api';
import { ApplicationSkeleton } from '../components/Skeleton';
import { LoadingError } from '../components/ErrorBoundary';
import type { RootStackParamList } from '../navigation/AppNavigator';

// ACCEPTED used to be patched in here because the shared labels lacked it;
// they now carry exactly the statuses the server has.
const STATUS_LABELS: Record<string, string> = APPLICATION_STATUS_DISPLAY;

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

// One tone per outcome, so the chip reads at a glance.
function statusTone(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'OFFERED':
    case 'ACCEPTED':
      return { bg: '#dcfce7', fg: '#166534' };
    case 'SHORTLISTED':
    case 'INTERVIEW':
      return { bg: '#e0e7ff', fg: '#3730a3' };
    case 'REJECTED':
    case 'WITHDRAWN':
      return { bg: '#f3f4f6', fg: '#6b7280' };
    default:
      return { bg: '#fef3c7', fg: '#92400e' };
  }
}

function where(job: JobApplication['job']): string {
  if (job.isRemote) return 'Remote';
  return [job.city, job.state].filter(Boolean).join(', ');
}

export function ApplicationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await userApi.getApplications();
      const list = unwrapApiData<JobApplication[]>(response.data);
      setApplications(Array.isArray(list) ? list : []);
      setFailed(false);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
      setFailed(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const renderItem = ({ item }: { item: JobApplication }) => {
    const tone = statusTone(item.status);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('JobDetail', { jobId: item.job.id })}
        accessibilityRole="button"
        accessibilityLabel={`${item.job.title}, ${statusLabel(item.status)}`}
      >
        <View style={styles.cardHead}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>{item.job.organization?.name?.charAt(0) || '?'}</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={styles.jobTitle} numberOfLines={2}>{item.job.title}</Text>
            <Text style={styles.company} numberOfLines={1}>
              {item.job.organization?.name ?? 'Employer'}
              {where(item.job) ? ` · ${where(item.job)}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.cardFoot}>
          <View style={[styles.chip, { backgroundColor: tone.bg }]}>
            <Text style={[styles.chipText, { color: tone.fg }]}>{statusLabel(item.status)}</Text>
          </View>
          <Text style={styles.date}>Applied {new Date(item.appliedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <ApplicationSkeleton />
          <ApplicationSkeleton />
          <ApplicationSkeleton />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={applications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); load(); }} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>My Applications</Text>
            <Text style={styles.subtitle}>Track the roles you've applied to and where each one is up to.</Text>
            {failed ? <LoadingError message="We couldn't load your applications." onRetry={load} /> : null}
          </View>
        }
        ListEmptyComponent={
          failed ? null : (
            <View style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={40} color="#c7d2fe" />
              <Text style={styles.cardTitle}>No applications yet</Text>
              <Text style={styles.cardBody}>When you apply to a role from the Jobs tab, it will show up here with its status.</Text>
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
  subtitle: { marginTop: 6, fontSize: 14, color: '#6b7280', lineHeight: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  logoText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  cardText: { flex: 1 },
  jobTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  company: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: '600' },
  date: { fontSize: 12, color: '#9ca3af' },
  emptyCard: { backgroundColor: '#fff', padding: 20, borderRadius: 12, alignItems: 'center' },
  cardTitle: { marginTop: 10, fontSize: 16, fontWeight: '600', color: '#111827' },
  cardBody: { marginTop: 6, fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 19 },
});
