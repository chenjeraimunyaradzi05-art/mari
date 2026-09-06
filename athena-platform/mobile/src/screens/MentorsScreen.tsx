/**
 * Mentors: browse, and request a session at one of the coming slots.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, TextInput, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mentorsApi, Mentor, unwrapApiData } from '../services/api';

type Session = { id: string; scheduledAt: string; status?: string; durationMinutes?: number; mentor?: { user?: { displayName?: string | null } } | null };

/** The next five weekdays, morning and afternoon, as local times. */
function comingSlots(): Array<{ label: string; iso: string }> {
  const slots: Array<{ label: string; iso: string }> = [];
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  while (slots.length < 10) {
    day.setDate(day.getDate() + 1);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    for (const hour of [10, 14]) {
      const at = new Date(day);
      at.setHours(hour, 0, 0, 0);
      slots.push({ label: at.toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }), iso: at.toISOString() });
    }
  }
  return slots;
}

const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(0)}/hr` : 'Rate on request';
};

export function MentorsScreen() {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [booking, setBooking] = useState<Mentor | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const slots = comingSlots();

  const load = useCallback(async () => {
    try {
      const [mentorRes, sessionRes] = await Promise.all([mentorsApi.list({ search: search.trim() || undefined, limit: 30 }), mentorsApi.sessions().catch(() => null)]);
      const data = unwrapApiData<{ mentors?: Mentor[] } | Mentor[]>(mentorRes.data);
      setMentors(Array.isArray(data) ? data : data?.mentors ?? []);
      if (sessionRes) {
        const list = unwrapApiData<Session[] | { sessions?: Session[] }>(sessionRes.data);
        setSessions(Array.isArray(list) ? list : list?.sessions ?? []);
      }
    } catch (error) {
      console.error('Failed to load mentors:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const book = async (slot: { label: string; iso: string }) => {
    if (!booking) return;
    setIsBooking(true);
    try {
      await mentorsApi.book(booking.id, { scheduledAt: slot.iso, durationMinutes: 60 });
      Alert.alert('Session requested', `${booking.user?.displayName || 'The mentor'} has your request for ${slot.label}. Confirmation and payment happen on the web once they accept.`);
      setBooking(null);
      await load();
    } catch (error: any) {
      Alert.alert('Not booked', error?.response?.data?.message || 'Try another time.');
    } finally {
      setIsBooking(false);
    }
  };

  const renderMentor = ({ item }: { item: Mentor }) => {
    const specs = Array.isArray(item.specializations) ? item.specializations : [];
    const name = item.user?.displayName || 'A mentor';
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.avatar}>{item.user?.avatar ? <Image source={{ uri: item.user.avatar }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{name.charAt(0)}</Text>}</View>
          <View style={styles.body}>
            <Text style={styles.name}>{name}</Text>
            {item.user?.headline ? <Text style={styles.headline}>{item.user.headline}</Text> : null}
            <Text style={styles.meta}>
              {money(item.hourlyRate)}
              {item.yearsExperience ? ` · ${item.yearsExperience} yrs` : ''}
              {item.rating ? ` · ★ ${Number(item.rating).toFixed(1)}` : ''}
              {item.isAvailable === false ? ' · not taking sessions' : ''}
            </Text>
          </View>
        </View>
        {specs.length > 0 && (
          <View style={styles.chips}>
            {specs.slice(0, 5).map((s) => (
              <Text key={s} style={styles.chip}>
                {s}
              </Text>
            ))}
          </View>
        )}
        {item.user?.bio || item.bio ? (
          <Text style={styles.bio} numberOfLines={3}>
            {item.user?.bio || item.bio}
          </Text>
        ) : null}
        {booking?.id === item.id ? (
          <View style={styles.slots}>
            <Text style={styles.slotsTitle}>Pick a time (1 hour)</Text>
            <View style={styles.chips}>
              {slots.map((slot) => (
                <TouchableOpacity key={slot.iso} style={styles.slot} onPress={() => book(slot)} disabled={isBooking}>
                  <Text style={styles.slotText}>{slot.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setBooking(null)}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.bookButton, item.isAvailable === false && styles.disabled]} onPress={() => setBooking(item)} disabled={item.isAvailable === false}>
            <Text style={styles.bookText}>Request a session</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color="#888" />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search by name or expertise" style={styles.searchInput} returnKeyType="search" onSubmitEditing={load} />
      </View>
      <FlatList
        data={mentors}
        renderItem={renderMentor}
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
          sessions.length > 0 ? (
            <View style={styles.sessions}>
              <Text style={styles.sectionTitle}>Your sessions</Text>
              {sessions.slice(0, 5).map((s) => (
                <Text key={s.id} style={styles.sessionRow}>
                  {new Date(s.scheduledAt).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  {s.mentor?.user?.displayName ? ` with ${s.mentor.user.displayName}` : ''}
                  {s.status ? ` · ${String(s.status).toLowerCase()}` : ''}
                </Text>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="school-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>{isLoading ? 'Loading mentors…' : 'No mentors match'}</Text>
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
  sessions: { backgroundColor: '#eef2ff', borderRadius: 12, padding: 12, marginBottom: 12 },
  sectionTitle: { fontWeight: '600', color: '#4338ca', marginBottom: 6 },
  sessionRow: { color: '#3730a3', fontSize: 13, marginBottom: 2 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  body: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#333' },
  headline: { fontSize: 13, color: '#666', marginTop: 2 },
  meta: { fontSize: 12, color: '#888', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { backgroundColor: '#f1f5f9', color: '#475569', fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  bio: { fontSize: 13, color: '#555', marginTop: 10, lineHeight: 19 },
  bookButton: { marginTop: 12, backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  bookText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.4 },
  slots: { marginTop: 12 },
  slotsTitle: { fontWeight: '600', color: '#333', marginBottom: 4 },
  slot: { borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  slotText: { color: '#4338ca', fontSize: 12 },
  cancel: { color: '#888', marginTop: 10, fontSize: 13 },
});
