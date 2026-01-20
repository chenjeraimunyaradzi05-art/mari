/**
 * Job Detail Screen
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useRoute } from '@react-navigation/native';
import { jobsApi } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';

interface JobDetail {
  id: string;
  title: string;
  description: string;
  city?: string;
  state?: string;
  isRemote: boolean;
  salaryMin?: number;
  salaryMax?: number;
  salaryType?: string;
  type: string;
  experienceMin?: number;
  experienceMax?: number;
  organization: {
    name: string;
    description?: string;
    industry?: string;
    size?: string;
  };
}

export function JobDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'JobDetail'>>();
  const { jobId } = route.params;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  const fetchJob = async () => {
    try {
      const response = await jobsApi.get(jobId);
      setJob(response.data.job);
    } catch (error) {
      console.error('Failed to fetch job:', error);
      Alert.alert('Error', 'Failed to load job details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (isSaved) {
        await jobsApi.unsave(jobId);
      } else {
        await jobsApi.save(jobId);
      }
      setIsSaved(!isSaved);
    } catch (error) {
      Alert.alert('Error', 'Failed to save job');
    }
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await jobsApi.apply(jobId, {});
      Alert.alert('Success', 'Your application has been submitted!');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to apply');
    } finally {
      setIsApplying(false);
    }
  };

  const formatSalary = () => {
    if (!job?.salaryMin && !job?.salaryMax) return null;
    const type = job.salaryType === 'hourly' ? '/hr' : '/yr';
    const format = (n: number) =>
      job.salaryType === 'hourly' ? `$${n}` : `$${(n / 1000).toFixed(0)}k`;

    if (job.salaryMin && job.salaryMax) {
      return `${format(job.salaryMin)} - ${format(job.salaryMax)}${type}`;
    }
    return `${format(job.salaryMin || job.salaryMax!)}${type}`;
  };

  const formatLocation = () => {
    if (job?.isRemote) return 'Remote';
    if (job?.city && job?.state) return `${job.city}, ${job.state}`;
    return job?.city || job?.state || 'Location TBD';
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.centered}>
        <Text>Job not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View style={styles.companyLogo}>
            <Text style={styles.logoText}>{job.organization.name.charAt(0)}</Text>
          </View>
          <Text style={styles.jobTitle}>{job.title}</Text>
          <Text style={styles.companyName}>{job.organization.name}</Text>
        </View>

        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={18} color="#666" />
            <Text style={styles.metaText}>{formatLocation()}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="briefcase-outline" size={18} color="#666" />
            <Text style={styles.metaText}>{job.type.replace('_', ' ')}</Text>
          </View>
          {formatSalary() && (
            <View style={styles.metaRow}>
              <Ionicons name="cash-outline" size={18} color="#666" />
              <Text style={styles.salaryText}>{formatSalary()}</Text>
            </View>
          )}
          {(job.experienceMin !== undefined || job.experienceMax !== undefined) && (
            <View style={styles.metaRow}>
              <Ionicons name="school-outline" size={18} color="#666" />
              <Text style={styles.metaText}>
                {job.experienceMin || 0}+ years experience
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About the Role</Text>
          <Text style={styles.description}>{job.description}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About {job.organization.name}</Text>
          <Text style={styles.description}>
            {job.organization.description || 'No company description available.'}
          </Text>
          {job.organization.industry && (
            <Text style={styles.companyMeta}>
              Industry: {job.organization.industry}
            </Text>
          )}
          {job.organization.size && (
            <Text style={styles.companyMeta}>Size: {job.organization.size}</Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={isSaved ? '#6366f1' : '#666'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.applyButton, isApplying && styles.buttonDisabled]}
          onPress={handleApply}
          disabled={isApplying}
        >
          <Text style={styles.applyButtonText}>
            {isApplying ? 'Applying...' : 'Apply Now'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  companyLogo: {
    width: 70,
    height: 70,
    borderRadius: 15,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  logoText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600',
  },
  jobTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  companyName: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  metaSection: {
    padding: 20,
    backgroundColor: '#f9fafb',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  metaText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#333',
    textTransform: 'capitalize',
  },
  salaryText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#059669',
    fontWeight: '600',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: '#444',
  },
  companyMeta: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  saveButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
