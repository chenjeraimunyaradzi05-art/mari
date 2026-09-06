/**
 * Learn: the courses a member is enrolled in, with progress, and the
 * catalogue to enrol from.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { coursesApi, Course, unwrapApiData } from '../services/api';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Enrolled = Course & { enrollment?: { id: string; progress?: number | null } };

const detail = (course: Course) =>
  [course.organization?.name, course.type ? course.type.replace(/_/g, ' ') : null, course.durationMonths ? `${course.durationMonths} months` : null, Array.isArray(course.studyMode) && course.studyMode.length ? course.studyMode.join(', ') : null]
    .filter(Boolean)
    .join(' · ');

export function LearnScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [mine, setMine] = useState<Enrolled[]>([]);
  const [catalogue, setCatalogue] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [mineRes, listRes] = await Promise.all([coursesApi.mine().catch(() => null), coursesApi.list({ search: search.trim() || undefined, limit: 30 })]);
      if (mineRes) {
        const enrolled = unwrapApiData<Enrolled[]>(mineRes.data);
        setMine(Array.isArray(enrolled) ? enrolled : []);
      }
      const courses = unwrapApiData<Course[] | { courses?: Course[] }>(listRes.data);
      setCatalogue(Array.isArray(courses) ? courses : courses?.courses ?? []);
    } catch (error) {
      console.error('Failed to load courses:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const enrol = async (course: Course) => {
    setBusyId(course.id);
    try {
      await coursesApi.enrol(course.id);
      await load();
    } catch (error: any) {
      Alert.alert('Not enrolled', error?.response?.data?.message || 'Try again in a moment.');
    } finally {
      setBusyId(null);
    }
  };

  const enrolledIds = new Set(mine.map((c) => c.id));

  const renderCourse = ({ item }: { item: Course }) => {
    const enrolled = enrolledIds.has(item.id);
    const open = () => navigation.navigate('Course', { courseId: item.id, title: item.title });
    return (
      <TouchableOpacity style={styles.card} onPress={open} activeOpacity={0.8}>
        <Text style={styles.title}>{item.title}</Text>
        {detail(item) ? <Text style={styles.meta}>{detail(item)}</Text> : null}
        {item.description ? (
          <Text style={styles.description} numberOfLines={3}>
            {item.description}
          </Text>
        ) : null}
        {enrolled ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={open}>
            <Text style={styles.secondaryText}>Enrolled · open the classroom</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.button, busyId === item.id && styles.disabled]} onPress={() => enrol(item)} disabled={busyId === item.id}>
            <Text style={styles.buttonText}>{busyId === item.id ? 'Enrolling…' : 'Enrol'}</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color="#888" />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search courses" style={styles.searchInput} returnKeyType="search" onSubmitEditing={load} />
      </View>
      <FlatList
        data={catalogue}
        renderItem={renderCourse}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              load();
            }}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          mine.length > 0 ? (
            <View style={styles.mine}>
              <Text style={styles.sectionTitle}>Your courses</Text>
              {mine.map((c) => {
                const progress = Math.max(0, Math.min(100, Number(c.enrollment?.progress) || 0));
                return (
                  <TouchableOpacity key={c.id} style={styles.mineRow} onPress={() => navigation.navigate('Course', { courseId: c.id, title: c.title })}>
                    <View style={styles.mineText}>
                      <Text style={styles.mineTitle}>{c.title}</Text>
                      <View style={styles.track}>
                        <View style={[styles.fill, { width: `${progress}%` }]} />
                      </View>
                    </View>
                    <Text style={styles.progress}>{progress}%</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="book-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>{isLoading ? 'Loading courses…' : 'No courses match'}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 15, marginBottom: 0, borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e5e5e5' },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 15, color: '#333' },
  listContent: { padding: 15 },
  centered: { alignItems: 'center', padding: 40 },
  emptyText: { marginTop: 12, color: '#888' },
  mine: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12 },
  sectionTitle: { fontWeight: '600', color: '#333', marginBottom: 8 },
  mineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  mineText: { flex: 1 },
  mineTitle: { color: '#333', fontSize: 14, marginBottom: 4 },
  track: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: '#6366f1' },
  progress: { color: '#666', fontSize: 12, width: 40, textAlign: 'right' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#333' },
  meta: { fontSize: 12, color: '#888', marginTop: 4 },
  description: { fontSize: 13, color: '#555', marginTop: 8, lineHeight: 19 },
  button: { marginTop: 12, backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { marginTop: 12, backgroundColor: '#eef2ff', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  secondaryText: { color: '#4338ca', fontWeight: '600', fontSize: 13 },
  disabled: { opacity: 0.5 },
});
