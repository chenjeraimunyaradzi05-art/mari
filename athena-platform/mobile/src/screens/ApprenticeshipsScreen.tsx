/**
 * Apprenticeships Screen
 * Browse and apply to apprenticeship opportunities
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
import { apprenticeshipApi, Apprenticeship } from '../services/api-extensions';

interface ApprenticeshipCardProps {
  apprenticeship: Apprenticeship;
  onPress: () => void;
}

function ApprenticeshipCard({ apprenticeship, onPress }: ApprenticeshipCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={styles.logoPlaceholder}>
          {apprenticeship.organization.logo ? (
            <Text style={styles.logoText}>
              {apprenticeship.organization.name.charAt(0)}
            </Text>
          ) : (
            <Ionicons name="business" size={24} color="#6b7280" />
          )}
        </View>
        <View style={styles.cardHeaderInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {apprenticeship.title}
          </Text>
          <Text style={styles.cardCompany}>{apprenticeship.organization.name}</Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{apprenticeship.location}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{apprenticeship.duration}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="briefcase-outline" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{apprenticeship.type}</Text>
        </View>
        {apprenticeship.salary && (
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>{apprenticeship.salary}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.industryBadge}>
          <Text style={styles.industryText}>{apprenticeship.industry}</Text>
        </View>
        <Text style={styles.postedDate}>{formatDate(apprenticeship.postedAt)}</Text>
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
      Alert.alert('Error', 'Please write a cover letter');
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
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.apprenticeshipSummary}>
              <Text style={styles.summaryTitle}>{apprenticeship.title}</Text>
              <Text style={styles.summaryCompany}>{apprenticeship.organization.name}</Text>
              <Text style={styles.summaryLocation}>{apprenticeship.location}</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Cover Letter *</Text>
              <TextInput
                style={styles.coverLetterInput}
                value={coverLetter}
                onChangeText={setCoverLetter}
                placeholder="Explain why you're a great fit for this apprenticeship..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{coverLetter.length}/2000</Text>
            </View>

            <View style={styles.uploadSection}>
              <TouchableOpacity style={styles.uploadButton}>
                <Ionicons name="document-attach-outline" size={24} color="#6366f1" />
                <Text style={styles.uploadButtonText}>Attach Resume (Optional)</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [selectedApprenticeship, setSelectedApprenticeship] = useState<Apprenticeship | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [applying, setApplying] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const INDUSTRIES = [
    'All',
    'Technology',
    'Healthcare',
    'Finance',
    'Education',
    'Manufacturing',
    'Retail',
    'Creative',
  ];

  const fetchApprenticeships = useCallback(async (pageNum: number, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);

      const response = await apprenticeshipApi.getList({
        page: pageNum,
        industry: selectedIndustry && selectedIndustry !== 'All' ? selectedIndustry : undefined,
      });

      const newItems = response.data.data?.apprenticeships || [];

      if (isRefresh || pageNum === 1) {
        setApprenticeships(newItems);
      } else {
        setApprenticeships(prev => [...prev, ...newItems]);
      }

      setHasMore(newItems.length === 10);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to fetch apprenticeships:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedIndustry]);

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
      Alert.alert('Success', 'Your application has been submitted!');
      setShowApplicationModal(false);
      setSelectedApprenticeship(null);
    } catch (error) {
      console.error('Failed to apply:', error);
      Alert.alert('Error', 'Failed to submit application. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  const openApplication = (apprenticeship: Apprenticeship) => {
    setSelectedApprenticeship(apprenticeship);
    setShowApplicationModal(true);
  };

  const filteredApprenticeships = apprenticeships.filter(a =>
    searchQuery === '' ||
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.organization.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search apprenticeships..."
          placeholderTextColor="#9ca3af"
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Industry Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {INDUSTRIES.map((industry) => (
          <TouchableOpacity
            key={industry}
            style={[
              styles.filterChip,
              (selectedIndustry === industry || (industry === 'All' && !selectedIndustry)) &&
                styles.filterChipActive,
            ]}
            onPress={() => setSelectedIndustry(industry === 'All' ? null : industry)}
          >
            <Text
              style={[
                styles.filterChipText,
                (selectedIndustry === industry || (industry === 'All' && !selectedIndustry)) &&
                  styles.filterChipTextActive,
              ]}
            >
              {industry}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Apprenticeship List */}
      {loading && apprenticeships.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={filteredApprenticeships}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ApprenticeshipCard
              apprenticeship={item}
              onPress={() => openApplication(item)}
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
              <Text style={styles.emptyText}>No apprenticeships found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
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
  },
  emptyText: {
    fontSize: 18,
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
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
  uploadSection: {
    marginBottom: 20,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 8,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
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
