/**
 * One course on the phone: what it is, its outline, enrolment, and, once
 * enrolled, the classroom itself. Each lesson opens in place with its text,
 * video or resource and is ticked off as it is done; the last one earns the
 * certificate, with the code anyone can check on the web.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';
import { coursesApi, WEB_URL, unwrapApiData } from '../services/api';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Lesson = {
  id: string;
  title: string;
  type: string;
  content?: string | null;
  videoUrl?: string | null;
  resourceUrl?: string | null;
  durationMinutes?: number | null;
  isPreview: boolean;
  locked?: boolean;
};
type Module = { id: string; title: string; description?: string | null; lessons: Lesson[] };
type Progress = { total: number; completed: number; percent: number; completedLessonIds?: string[]; certificate?: { code: string } | null };
type CourseDetail = {
  id: string;
  slug?: string;
  title: string;
  description: string;
  providerName?: string | null;
  organization?: { name?: string | null } | null;
  type?: string | null;
  durationMonths?: number | null;
  cost?: number | null;
  isActive?: boolean;
  enrollment?: { id: string; progress?: number | null } | null;
  progress?: Progress | null;
  modules?: Module[];
};

const money = (n: number) => `$${new Intl.NumberFormat('en-AU').format(n)}`;
const facts = (c: CourseDetail) =>
  [
    c.providerName || c.organization?.name || null,
    c.type ? c.type.replace(/_/g, ' ') : null,
    c.durationMonths ? `${c.durationMonths} months` : null,
    c.cost == null ? null : c.cost === 0 ? 'Fee-free' : money(c.cost),
  ]
    .filter(Boolean)
    .join(' · ');
const lessonIcon = (type: string): keyof typeof Ionicons.glyphMap => (type === 'VIDEO' ? 'play-circle-outline' : type === 'RESOURCE' ? 'document-attach-outline' : 'reader-outline');

export function CourseScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Course'>>();
  const { courseId } = route.params;
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [certificate, setCertificate] = useState<{ code: string } | null>(null);
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const detail = unwrapApiData<CourseDetail>((await coursesApi.get(courseId)).data);
      let modules = detail.modules ?? [];
      let progress = detail.progress ?? null;
      if (detail.enrollment) {
        // Enrolled: the classroom carries every lesson's content, not just the previews.
        const room = await coursesApi.classroom(detail.id).catch(() => null);
        if (room) {
          const data = unwrapApiData<{ modules?: Module[]; progress?: Progress }>(room.data);
          modules = data.modules ?? modules;
          progress = data.progress ?? progress;
        }
      }
      setCourse({ ...detail, modules, progress });
      setCompleted(new Set(progress?.completedLessonIds ?? []));
      setCertificate(progress?.certificate ?? null);
    } catch (error) {
      console.error('Failed to load course:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const enrol = async () => {
    if (!course) return;
    setBusy('enrol');
    try {
      await coursesApi.enrol(course.id);
      await load();
    } catch (error: any) {
      Alert.alert('Not enrolled', error?.response?.data?.message || 'Try again in a moment.');
    } finally {
      setBusy(null);
    }
  };

  const complete = async (lesson: Lesson) => {
    if (!course) return;
    setBusy(lesson.id);
    try {
      const data = unwrapApiData<Progress>((await coursesApi.completeLesson(course.id, lesson.id)).data);
      setCompleted(new Set(data.completedLessonIds ?? [...completed, lesson.id]));
      setCourse((c) => (c ? { ...c, progress: { ...(c.progress ?? { total: 0, completed: 0 }), ...data } } : c));
      if (data.certificate && !certificate) {
        setCertificate(data.certificate);
        Alert.alert('Certificate earned', `Every lesson is done. Your code is ${data.certificate.code}; anyone can check it at ${WEB_URL}/certificates/${data.certificate.code}.`);
      }
    } catch (error: any) {
      Alert.alert('Not saved', error?.response?.data?.message || 'Try again in a moment.');
    } finally {
      setBusy(null);
    }
  };

  if (isLoading || !course) {
    return (
      <View style={styles.centered}>
        {isLoading ? <ActivityIndicator color="#6366f1" /> : <Text style={styles.emptyText}>This course is not available.</Text>}
      </View>
    );
  }

  const enrolled = Boolean(course.enrollment);
  const modules = course.modules ?? [];
  const lessonCount = modules.reduce((n, m) => n + m.lessons.length, 0);
  const percent = Math.max(0, Math.min(100, course.progress?.percent ?? Number(course.enrollment?.progress) ?? 0));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            setIsRefreshing(true);
            load();
          }}
        />
      }
    >
      <Text style={styles.title}>{course.title}</Text>
      {facts(course) ? <Text style={styles.meta}>{facts(course)}</Text> : null}
      <Text style={styles.description}>{course.description}</Text>

      <View style={styles.card}>
        {enrolled ? (
          <>
            <View style={styles.progressRow}>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${percent}%` }]} />
              </View>
              <Text style={styles.progressText}>{percent}%</Text>
            </View>
            <Text style={styles.hint}>
              {course.progress ? `${course.progress.completed} of ${course.progress.total} lessons done.` : 'You are enrolled.'} {lessonCount === 0 ? 'The provider has not added lessons yet.' : ''}
            </Text>
            {certificate ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={() => Linking.openURL(`${WEB_URL}/certificates/${certificate.code}`)}>
                <Ionicons name="ribbon-outline" size={16} color="#4338ca" />
                <Text style={styles.secondaryText}>Certificate {certificate.code}</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.hint}>{course.isActive === false ? 'This course is not taking enrolments at the moment.' : 'Enrol to open every lesson and track your progress. A certificate is issued when all of them are done.'}</Text>
            <TouchableOpacity style={[styles.button, (busy === 'enrol' || course.isActive === false) && styles.disabled]} onPress={enrol} disabled={busy === 'enrol' || course.isActive === false}>
              <Text style={styles.buttonText}>{busy === 'enrol' ? 'Enrolling…' : 'Enrol'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {modules.length > 0 ? (
        <Text style={styles.sectionTitle}>
          {modules.length} {modules.length === 1 ? 'module' : 'modules'} · {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'}
        </Text>
      ) : null}
      {modules.map((m, i) => (
        <View key={m.id} style={styles.module}>
          <Text style={styles.moduleTitle}>
            {i + 1}. {m.title}
          </Text>
          {m.description ? <Text style={styles.moduleDescription}>{m.description}</Text> : null}
          {m.lessons.map((lesson) => {
            const open = openLessonId === lesson.id;
            const done = completed.has(lesson.id);
            const locked = Boolean(lesson.locked);
            return (
              <View key={lesson.id} style={styles.lesson}>
                <TouchableOpacity
                  style={styles.lessonRow}
                  onPress={() => {
                    if (locked) {
                      Alert.alert('Locked', 'Enrol to open this lesson. Previews are open to everyone.');
                      return;
                    }
                    setOpenLessonId(open ? null : lesson.id);
                  }}
                >
                  <Ionicons name={done ? 'checkmark-circle' : locked ? 'lock-closed-outline' : lessonIcon(lesson.type)} size={20} color={done ? '#059669' : locked ? '#9ca3af' : '#6366f1'} />
                  <Text style={[styles.lessonTitle, locked && styles.lessonLocked]}>{lesson.title}</Text>
                  {lesson.isPreview && !enrolled ? <Text style={styles.preview}>preview</Text> : null}
                  {lesson.durationMinutes ? <Text style={styles.duration}>{lesson.durationMinutes} min</Text> : null}
                </TouchableOpacity>
                {open ? (
                  <View style={styles.lessonBody}>
                    {lesson.content ? <Text style={styles.lessonContent}>{lesson.content}</Text> : null}
                    {lesson.videoUrl ? (
                      <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL(lesson.videoUrl!)}>
                        <Ionicons name="play" size={14} color="#4338ca" />
                        <Text style={styles.linkText}>Watch the video</Text>
                      </TouchableOpacity>
                    ) : null}
                    {lesson.resourceUrl ? (
                      <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL(lesson.resourceUrl!)}>
                        <Ionicons name="open-outline" size={14} color="#4338ca" />
                        <Text style={styles.linkText}>Open the resource</Text>
                      </TouchableOpacity>
                    ) : null}
                    {!lesson.content && !lesson.videoUrl && !lesson.resourceUrl ? <Text style={styles.hint}>This lesson has no content yet.</Text> : null}
                    {enrolled && !done ? (
                      <TouchableOpacity style={[styles.button, busy === lesson.id && styles.disabled]} onPress={() => complete(lesson)} disabled={busy === lesson.id}>
                        <Text style={styles.buttonText}>{busy === lesson.id ? 'Saving…' : 'Mark as done'}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {done ? <Text style={styles.done}>Done</Text> : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 15, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: '#f5f5f5' },
  emptyText: { color: '#888' },
  title: { fontSize: 22, fontWeight: '700', color: '#333' },
  meta: { fontSize: 13, color: '#888', marginTop: 4 },
  description: { fontSize: 14, color: '#555', marginTop: 10, lineHeight: 21 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginTop: 15 },
  hint: { fontSize: 13, color: '#666', lineHeight: 19 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  track: { flex: 1, height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: '#6366f1' },
  progressText: { color: '#666', fontSize: 12, width: 40, textAlign: 'right' },
  button: { marginTop: 12, backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { marginTop: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: '#eef2ff', borderRadius: 10, paddingVertical: 10 },
  secondaryText: { color: '#4338ca', fontWeight: '600', fontSize: 13 },
  disabled: { opacity: 0.5 },
  sectionTitle: { fontWeight: '600', color: '#333', marginTop: 20, marginBottom: 8 },
  module: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12 },
  moduleTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
  moduleDescription: { fontSize: 13, color: '#666', marginTop: 2, marginBottom: 4 },
  lesson: { borderTopWidth: 1, borderTopColor: '#f0f0f0', marginTop: 8, paddingTop: 8 },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lessonTitle: { flex: 1, fontSize: 14, color: '#333' },
  lessonLocked: { color: '#9ca3af' },
  preview: { fontSize: 11, color: '#047857', backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  duration: { fontSize: 12, color: '#999' },
  lessonBody: { marginTop: 8, paddingLeft: 30 },
  lessonContent: { fontSize: 14, color: '#444', lineHeight: 21 },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  linkText: { color: '#4338ca', fontWeight: '600', fontSize: 13 },
  done: { marginTop: 8, color: '#059669', fontWeight: '600', fontSize: 13 },
});
