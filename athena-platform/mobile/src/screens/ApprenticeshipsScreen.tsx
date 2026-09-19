/**
 * Apprenticeships Screen
 * Browse, bookmark and apply to open apprenticeships
 *
 * GET /apprenticeships answers { success, data: [...], pagination }; the
 * chips are the training packages the server reports from
 * GET /apprenticeships/categories, with a count each, rather than a list
 * typed into this file. Search goes to the server too.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  apprenticeshipApi,
  apprenticeshipLevelLabel,
  Apprenticeship,
  ApprenticeshipFramework,
} from '../services/api-extensions';
import { unwrapApiData } from '../services/api';

const PAGE_SIZE = 20;

function organisation(a: Apprenticeship) {
  return a.hostEmployer ?? a.rto;
}

function place(a: Apprenticeship): string {
  if (a.isRemote) return 'Remote';
  return [a.city, a.state].filter(Boolean).join(', ') || a.country || 'Location to be confirmed';
}

function wage(a: Apprenticeship): string | null {
  const fmt = (n: number) => `$${n.toLocaleString('en-AU')}`;
  if (typeof a.wageMin === 'number' && typeof a.wageMax === 'number') return `${fmt(a.wageMin)} – ${fmt(a.wageMax)}`;
  if (typeof a.wageMin === 'number') return `From ${fmt(a.wageMin)}`;
  if (typeof a.wageMax === 'number') return `Up to ${fmt(a.wageMax)}`;
  return null;
}

interface ApprenticeshipCardProps {
  apprenticeship: Apprenticeship;
  onPress: () => void;
  onToggleBookmark: () => void;
}

function ApprenticeshipCard({ apprenticeship, onPress, onToggleBookmark }: ApprenticeshipCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-AU');
  };

  const org = organisation(apprenticeship);
  const pay = wage(apprenticeship);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={apprenticeship.title}>
      <View style={styles.cardHeader}>
        <View style={styles.logoPlaceholder}>
          {org ? (
            <Text style={styles.logoText}>{org.name.charAt(0)}</Text>
          ) : (
            <Ionicons name="business" size={24} color="#6b7280" />
          )}
        </View>
        <View style={styles.cardHeaderInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {apprenticeship.title}
          </Text>
          <Text style={styles.cardCompany}>{org?.name ?? 'Provider to be confirmed'}</Text>
        </View>
        <TouchableOpacity
          onPress={onToggleBookmark}
          accessibilityRole="button"
          accessibilityLabel={apprenticeship.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={apprenticeship.isBookmarked ? 'bookmark' : 'bookmark-outline'} size={22} color="#6366f1" />
        </TouchableOpacity>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{place(apprenticeship)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{apprenticeship.durationMonths} months</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="ribbon-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{apprenticeshipLevelLabel(apprenticeship.level)}</Text>
        </View>
        {pay && (
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>{pay}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.industryBadge}>
          <Text style={styles.industryText}>{apprenticeship.framework}</Text>
        </View>
        <Text style={styles.postedDate}>{formatDate(apprenticeship.publishedAt ?? apprenticeship.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

interface ApplicationModalProps {
  visible: boolean;
  apprenticeship: Apprenticeship | null;
  onClose: () => void;
  onSubmit: (coverLetter: string) => void;
  loading: boolean;
}

function ApplicationModal({ visible, apprenticeship, onClose, onSubmit, loading }: ApplicationModalProps) {
  const [coverLetter, setCoverLetter] = useState('');

  const handleSubmit = () => {
    if (!coverLetter.trim()) {
      Alert.alert('Almost there', 'Tell them a little about why this apprenticeship is for you.');
      return;
    }
    onSubmit(coverLetter.trim());
  };

  if (!apprenticeship) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Apply to Apprenticeship</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.apprenticeshipSummary}>
              <Text style={styles.summaryTitle}>{apprenticeship.title}</Text>
              <Text style={styles.summaryCompany}>{organisation(apprenticeship)?.name ?? apprenticeship.framework}</Text>
              <Text style={styles.summaryLocation}>{place(apprenticeship)}</Text>
              {apprenticeship.description ? (
                <Text style={styles.summaryDescription} numberOfLines={6}>{apprenticeship.description}</Text>
              ) : null}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label} nativeID="coverLetterLabel">Cover Letter *</Text>
              <TextInput
                style={styles.coverLetterInput}
                value={coverLetter}
                onChangeText={setCoverLetter}
                placeholder="Explain why you're a great fit for this apprenticeship..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={8}
                textAlignVertical="top"
                maxLength={2000}
                accessibilityLabelledBy="coverLetterLabel"
              />
              <Text style={styles.charCount}>{coverLetter.length}/2000</Text>
            </View>

            <Text style={styles.resumeNote}>A resume can be attached to your application on the web; it is not needed to apply.</Text>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} accessibilityRole="button">
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Application</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function ApprenticeshipsScreen() {
  const [apprenticeships, setApprenticeships] = useState<Apprenticeship[]>([]);
  const [frameworks, setFrameworks] = useState<ApprenticeshipFramework[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [selectedApprenticeship, setSelectedApprenticeship] = useState<Apprenticeship | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [applying, setApplying] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    apprenticeshipApi
      .getCategories()
      .then((res) => {
        const data = unwrapApiData<{ frameworks?: ApprenticeshipFramework[] }>(res.data);
        setFrameworks(Array.isArray(data?.frameworks) ? data.frameworks : []);
      })
      .catch((error) => console.error('Failed to fetch apprenticeship categories:', error));
  }, []);

  const fetchApprenticeships = useCallback(async (pageNum: number, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);

      const response = await apprenticeshipApi.getList({
        page: pageNum,
        limit: PAGE_SIZE,
        framework: selectedFramework ?? undefined,
        search: submittedSearch || undefined,
      });

      const list = unwrapApiData<Apprenticeship[]>(response.data);
      const newItems = Array.isArray(list) ? list : [];
      const pages: number | undefined = response.data?.pagination?.pages;

      setApprenticeships((prev) => (isRefresh || pageNum === 1 ? newItems : [...prev, ...newItems]));
      setHasMore(typeof pages === 'number' ? pageNum < pages : newItems.length === PAGE_SIZE);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to fetch apprenticeships:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFramework, submittedSearch]);

  useEffect(() => {
    fetchApprenticeships(1);
  }, [fetchApprenticeships]);

  const handleRefresh = () => {
    fetchApprenticeships(1, true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchApprenticeships(page + 1);
    }
  };

  const handleApply = async (coverLetter: string) => {
    if (!selectedApprenticeship) return;

    try {
      setApplying(true);
      await apprenticeshipApi.apply(selectedApprenticeship.id, { coverLetter });
      Alert.alert('Application sent', 'The provider has your application. You can follow it under My Applications on the web.');
      setShowApplicationModal(false);
      setSelectedApprenticeship(null);
    } catch (error: any) {
      console.error('Failed to apply:', error);
      Alert.alert('Not sent', error?.response?.data?.message || 'We could not submit your application. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  const toggleBookmark = async (item: Apprenticeship) => {
    const next = !item.isBookmarked;
    setApprenticeships((prev) => prev.map((a) => (a.id === item.id ? { ...a, isBookmarked: next } : a)));
    try {
      if (next) await apprenticeshipApi.bookmark(item.id);
      else await apprenticeshipApi.unbookmark(item.id);
    } catch (error) {
      setApprenticeships((prev) => prev.map((a) => (a.id === item.id ? { ...a, isBookmarked: !next } : a)));
      console.error('Failed to update bookmark:', error);
    }
  };

  const openApplication = (apprenticeship: Apprenticeship) => {
    setSelectedApprenticeship(apprenticeship);
    setShowApplicationModal(true);
  };

  const chips: Array<{ key: string | null; label: string }> = [
    { key: null, label: 'All' },
    ...frameworks.map((f) => ({ key: f.name, label: f.count > 0 ? `${f.name} (${f.count})` : f.name })),
  ];

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => setSubmittedSearch(searchQuery.trim())}
          returnKeyType="search"
          placeholder="Search apprenticeships..."
          placeholderTextColor="#9ca3af"
          accessibilityLabel="Search apprenticeships"
        />
        {searchQuery !== '' && (
          <TouchableOpacity
            onPress={() => {
              setSearchQuery('');
              setSubmittedSearch('');
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Framework Filter */}
      {chips.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {chips.map((chip) => {
            const active = selectedFramework === chip.key;
            return (
              <TouchableOpacity
                key={chip.key ?? 'all'}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelectedFramework(chip.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{chip.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Apprenticeship List */}
      {loading && apprenticeships.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={apprenticeships}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ApprenticeshipCard
              apprenticeship={item}
              onPress={() => openApplication(item)}
              onToggleBookmark={() => toggleBookmark(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading && apprenticeships.length > 0 ? (
              <ActivityIndicator style={styles.footerLoader} color="#6366f1" />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="school-outline" size={64} color="#9ca3af" />
              <Text style={styles.emptyText}>No open apprenticeships match</Text>
              <Text style={styles.emptySubtext}>Try another training package or clear your search.</Text>
            </View>
          }
        />
      )}

      {/* Application Modal */}
      <ApplicationModal
        visible={showApplicationModal}
        apprenticeship={selectedApprenticeship}
        onClose={() => {
          setShowApplicationModal(false);
          setSelectedApprenticeship(null);
        }}
        onSubmit={handleApply}
        loading={applying}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  // Filters
  filterContainer: {
    maxHeight: 50,
    marginTop: 12,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  filterChipText: {
    fontSize: 14,
    color: '#6b7280',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  // List
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6366f1',
  },
  cardHeaderInfo: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  cardCompany: {
    fontSize: 14,
    color: '#6366f1',
  },
  cardDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#6b7280',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  industryBadge: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    flexShrink: 1,
  },
  industryText: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '500',
  },
  postedDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  footerLoader: {
    paddingVertical: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    padding: 20,
  },
  apprenticeshipSummary: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  summaryCompany: {
    fontSize: 14,
    color: '#6366f1',
    marginBottom: 2,
  },
  summaryLocation: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryDescription: {
    marginTop: 10,
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 19,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  coverLetterInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 150,
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 4,
  },
  resumeNote: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 20,
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  submitButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#6366f1',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
