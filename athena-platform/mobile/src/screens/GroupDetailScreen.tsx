/**
 * One group: its posts, and a place to write one.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { groupsApi, FeedPost, unwrapApiData } from '../services/api';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { PostCard } from '../components/PostCard';

export function GroupDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'GroupDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { groupId, name } = route.params;
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await groupsApi.posts(groupId);
      const data = unwrapApiData<FeedPost[] | { posts?: FeedPost[] }>(response.data);
      setPosts(Array.isArray(data) ? data : data?.posts ?? []);
    } catch (error) {
      console.error('Failed to load group posts:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    const content = draft.trim();
    if (!content) return;
    setIsPosting(true);
    try {
      await groupsApi.post(groupId, content);
      setDraft('');
      await load();
    } catch (error: any) {
      Alert.alert('Not posted', error?.response?.data?.message || 'Join the group to post here.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={posts}
        renderItem={({ item }) => (
          <PostCard post={item} onOpenComments={(post) => navigation.navigate('PostComments', { postId: post.id })} onChange={(updated) => setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))} />
        )}
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
        ListHeaderComponent={<Text style={styles.title}>{name ?? 'Group'}</Text>}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>{isLoading ? 'Loading…' : 'Nothing posted here yet'}</Text>
          </View>
        }
      />
      <View style={styles.composer}>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Write to the group" style={styles.input} multiline maxLength={2000} />
        <TouchableOpacity style={[styles.sendButton, (!draft.trim() || isPosting) && styles.sendButtonDisabled]} onPress={submit} disabled={!draft.trim() || isPosting} accessibilityLabel="Post">
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  listContent: { padding: 15, paddingBottom: 90 },
  title: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 12 },
  centered: { alignItems: 'center', padding: 40 },
  emptyText: { marginTop: 12, color: '#888' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e5e5' },
  input: { flex: 1, maxHeight: 120, backgroundColor: '#f5f5f5', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#333' },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.4 },
});
