/**
 * Jobs Screen - Job Listings
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { jobsApi } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';

interface Job {
  id: string;
  title: string;
  slug: string;
  city?: string;
  state?: string;
  isRemote: boolean;
  salaryMin?: number;
  salaryMax?: number;
  type: string;
  organization: {
    name: string;
    logo?: string;
  };
}

export function JobsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchJobs = useCallback(async () => {
    try {
      const response = await jobsApi.list({ limit: 20, search: searchQuery || undefined });
      setJobs(response.data.jobs || []);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchJobs();
  };

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return null;
    const format = (n: number) => `$${(n / 1000).toFixed(0)}k`;
    if (min && max) return `${format(min)} - ${format(max)}`;
    if (min) return `From ${format(min)}`;
    return `Up to ${format(max!)}`;
  };

  const formatLocation = (job: Job) => {
    if (job.isRemote) return 'Remote';
    if (job.city && job.state) return `${job.city}, ${job.state}`;
    return job.city || job.state || 'Location TBD';
  };

  const renderJob = ({ item }: { item: Job }) => (
    <TouchableOpacity
      style={styles.jobCard}
      onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
    >
      <View style={styles.jobHeader}>
        <View style={styles.companyLogo}>
          <Text style={styles.logoText}>
            {item.organization.name.charAt(0)}
          </Text>
        </View>
        <View style={styles.jobInfo}>
          <Text style={styles.jobTitle}>{item.title}</Text>
          <Text style={styles.companyName}>{item.organization.name}</Text>
        </View>
      </View>

      <View style={styles.jobMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="location-outline" size={14} color="#666" />
          <Text style={styles.metaText}>{formatLocation(item)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="briefcase-outline" size={14} color="#666" />
          <Text style={styles.metaText}>{item.type.replace('_', ' ')}</Text>
        </View>
      </View>

      {formatSalary(item.salaryMin, item.salaryMax) && (
        <Text style={styles.salary}>
          {formatSalary(item.salaryMin, item.salaryMax)}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search jobs..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={fetchJobs}
          returnKeyType="search"
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <Text>Loading jobs...</Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          renderItem={renderJob}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="briefcase-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No jobs found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 15,
    marginBottom: 0,
    borderRadius: 10,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  listContent: {
    padding: 15,
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  jobHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  companyLogo: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  jobInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  companyName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  jobMeta: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    marginLeft: 4,
    fontSize: 13,
    color: '#666',
    textTransform: 'capitalize',
  },
  salary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  emptyText: {
    marginTop: 15,
    color: '#999',
    fontSize: 16,
  },
});
