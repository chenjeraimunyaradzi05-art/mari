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
  TextInput,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useRoute } from '@react-navigation/native';
import { jobsApi, userApi, unwrapApiData, WEB_URL } from '../services/api';

/** The server's own ceiling on a cover letter (job.routes.ts). */
const COVER_LETTER_MAX = 20000;
import { RootStackParamList } from '../navigation/AppNavigator';
import { LoadingError } from '../components/ErrorBoundary';

interface JobDetail {
  id: string;
  title: string;
  description: string;
  city?: string | null;
  state?: string | null;
  isRemote: boolean;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryType?: string | null;
  type: string;
  experienceMin?: number | null;
  experienceMax?: number | null;
  /** Attached for a signed-in viewer. */
  hasApplied?: boolean;
  organization: {
    name: string;
    description?: string | null;
    industry?: string | null;
    size?: string | null;
  };
}

export function JobDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'JobDetail'>>();
  const { jobId } = route.params;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  // A failed fetch popped one alert and then left "Job not found" on screen —
  // a claim that the job has been withdrawn, made because the phone lost
  // signal, with nothing to tap to find out otherwise.
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  const fetchJob = async () => {
    try {
      // GET /jobs/:id answers { success, data: job }. The detail does not say
      // whether the job is bookmarked, so the saved list is read alongside it
      // rather than starting the bookmark as "not saved" for everyone.
      const [jobRes, savedRes] = await Promise.all([
        jobsApi.get(jobId),
        userApi.getSavedJobs().catch(() => null),
      ]);
      const detail = unwrapApiData<JobDetail>(jobRes.data);
      setJob(detail ?? null);
      setHasApplied(!!detail?.hasApplied);
      if (savedRes) {
        const saved = unwrapApiData<Array<{ id: string }>>(savedRes.data);
        setIsSaved(Array.isArray(saved) && saved.some((s) => s.id === jobId));
      }
      setLoadError(null);
    } catch (error: any) {
      setLoadError(
        error?.response?.status === 404
          ? 'This job is no longer listed.'
          : error?.response?.data?.message || 'This job could not be loaded. Check your connection and try again.'
      );
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

  // Applying used to be one tap that sent an empty application: no chance to
  // check it was the right job, no cover letter, nothing an employer could
  // read beyond her name. The tap now opens the application, where she can
  // write a cover letter or leave it, and sends only when she says so.
  const openApplication = () => {
    setIsComposing(true);
  };

  const cancelApplication = () => {
    setIsComposing(false);
  };

  const submitApplication = async () => {
    const letter = coverLetter.trim();
    setIsApplying(true);
    try {
      await jobsApi.apply(jobId, letter ? { coverLetter: letter } : {});
      setHasApplied(true);
      setIsComposing(false);
      setCoverLetter('');
      Alert.alert('Application sent', `Your application to ${job?.organization.name ?? 'the employer'} has been sent.`);
    } catch (error: any) {
      // The panel stays open with what she wrote, so a dropped connection
      // does not cost her the letter.
      Alert.alert('Not sent', error?.response?.data?.message || 'Your application could not be sent. Check your connection and try again.');
    } finally {
      setIsApplying(false);
    }
  };

  // A résumé is attached by uploading the file, which the app cannot do yet;
  // the web page for this job can, and applying there carries it.
  const applyOnWeb = () => {
    Linking.openURL(`${WEB_URL}/jobs/${jobId}`).catch(() => {
      Alert.alert('Could not open the web page', `Open ${WEB_URL}/jobs/${jobId} in your browser to attach a résumé.`);
    });
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
        <LoadingError
          message={loadError ?? 'This job is no longer listed.'}
          onRetry={() => {
            setIsLoading(true);
            fetchJob();
          }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

      {isComposing && !hasApplied ? (
        <View style={styles.applyPanel}>
          <Text style={styles.applyPanelTitle}>{`Apply to ${job.organization.name}`}</Text>
          <Text style={styles.applyPanelHint}>{`${job.title}. A cover letter is optional.`}</Text>
          <TextInput
            style={styles.coverLetterInput}
            value={coverLetter}
            onChangeText={setCoverLetter}
            placeholder="Cover letter (optional)"
            multiline
            maxLength={COVER_LETTER_MAX}
            textAlignVertical="top"
            accessibilityLabel="Cover letter, optional"
            editable={!isApplying}
          />
          <TouchableOpacity onPress={applyOnWeb} accessibilityRole="link" accessibilityLabel="Attach a résumé on the web">
            <Text style={styles.resumeLink}>Want to attach a résumé? Apply on the web instead.</Text>
          </TouchableOpacity>
          <View style={styles.applyPanelActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={cancelApplication}
              disabled={isApplying}
              accessibilityRole="button"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyButton, isApplying && styles.buttonDisabled]}
              onPress={submitApplication}
              disabled={isApplying}
              accessibilityRole="button"
            >
              <Text style={styles.applyButtonText}>{isApplying ? 'Sending...' : 'Send application'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Remove from saved jobs' : 'Save job'}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={isSaved ? '#6366f1' : '#666'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.applyButton, hasApplied && styles.buttonDisabled]}
            onPress={openApplication}
            disabled={hasApplied}
            accessibilityRole="button"
          >
            <Text style={styles.applyButtonText}>{hasApplied ? 'Applied' : 'Apply Now'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
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
  applyPanel: {
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  applyPanelTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  applyPanelHint: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    marginBottom: 10,
  },
  coverLetterInput: {
    minHeight: 110,
    maxHeight: 220,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#333',
  },
  resumeLink: {
    color: '#6366f1',
    fontSize: 14,
    marginTop: 10,
  },
  applyPanelActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  cancelButton: {
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
});
