/**
 * Groups: the communities a member can browse, join and leave. Opening one
 * shows its posts and lets a member write there.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { groupsApi, Group, unwrapApiData } from '../services/api';
import type { RootStackParamList } from '../navigation/AppNavigator';

export function GroupsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await groupsApi.list(search.trim() ? { q: search.trim() } : undefined);
      const data = unwrapApiData<Group[] | { groups?: Group[] }>(response.data);
      setGroups(Array.isArray(data) ? data : data?.groups ?? []);
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleMembership = async (group: Group) => {
    setBusyId(group.id);
    try {
      if (group.isMember) {
        await groupsApi.leave(group.id);
        setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, isMember: false, memberCount: Math.max(0, g.memberCount - 1) } : g)));
      } else {
        const response = await groupsApi.join(group.id);
        const result = unwrapApiData<{ status?: string; pending?: boolean }>(response.data);
        if (result?.pending || result?.status === 'PENDING') {
          Alert.alert('Request sent', 'This group approves members; you will be let in once an admin says yes.');
        } else {
          setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, isMember: true, memberCount: g.memberCount + 1 } : g)));
        }
      }
    } catch (error: any) {
      Alert.alert('That did not work', error?.response?.data?.message || 'Try again in a moment.');
    } finally {
      setBusyId(null);
    }
  };

  const renderGroup = ({ item }: { item: Group }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('GroupDetail', { groupId: item.id, name: item.name })}>
      <View style={styles.cardBody}>
        <Text style={styles.name}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
          {item.privacy && item.privacy !== 'PUBLIC' ? ` · ${item.privacy.toLowerCase()}` : ''}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.joinButton, item.isMember && styles.joinButtonMember]}
        onPress={() => toggleMembership(item)}
        disabled={busyId === item.id}
        accessibilityLabel={item.isMember ? `Leave ${item.name}` : `Join ${item.name}`}
      >
        <Text style={[styles.joinText, item.isMember && styles.joinTextMember]}>{item.isMember ? 'Joined' : 'Join'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color="#888" />
        <TextInput value={search} onChangeText={setSearch} placeholder="Find a group" style={styles.searchInput} returnKeyType="search" onSubmitEditing={load} />
      </View>
      <FlatList
        data={groups}
        renderItem={renderGroup}
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
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>{isLoading ? 'Loading groups…' : 'No groups match'}</Text>
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
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardBody: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#333' },
  description: { fontSize: 13, color: '#666', marginTop: 4 },
  meta: { fontSize: 12, color: '#888', marginTop: 6 },
  joinButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#6366f1' },
  joinButtonMember: { backgroundColor: '#eef2ff' },
  joinText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  joinTextMember: { color: '#4338ca' },
});
