/**
 * Home: the feed, with a composer at the top so a member can post from the
 * phone, and cards whose like, comment and share actions all work.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { postsApi, FeedPost, unwrapApiData } from '../services/api';
import { PostCard } from '../components/PostCard';
import type { RootStackParamList } from '../navigation/AppNavigator';

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [draft, setDraft] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      const response = await postsApi.list({ limit: 20 });
      const data = unwrapApiData<{ posts?: FeedPost[] } | FeedPost[]>(response.data);
      setPosts(Array.isArray(data) ? data : data?.posts ?? []);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchPosts();
  };

  const publish = async () => {
    const content = draft.trim();
    if (!content) return;
    setIsPosting(true);
    try {
      await postsApi.create({ content });
      setDraft('');
      await fetchPosts();
    } catch (error: any) {
      Alert.alert('Not posted', error?.response?.data?.message || 'Try again in a moment.');
    } finally {
      setIsPosting(false);
    }
  };

  const composer = (
    <View style={styles.composer}>
      <TextInput value={draft} onChangeText={setDraft} placeholder="Share something with the community" style={styles.composerInput} multiline maxLength={5000} accessibilityLabel="New post" />
      <View style={styles.composerRow}>
        <Text style={styles.composerCount}>{draft.length ? `${draft.length} / 5000` : ''}</Text>
        <TouchableOpacity style={[styles.postButton, (!draft.trim() || isPosting) && styles.postButtonDisabled]} onPress={publish} disabled={!draft.trim() || isPosting}>
          <Text style={styles.postButtonText}>{isPosting ? 'Posting…' : 'Post'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Text>Loading feed...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={({ item }) => (
          <PostCard post={item} onOpenComments={(post) => navigation.navigate('PostComments', { postId: post.id })} onChange={(updated) => setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))} />
        )}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={composer}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="newspaper-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No posts yet. Yours could be the first.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  listContent: { padding: 15 },
  emptyText: { marginTop: 12, color: '#888', textAlign: 'center' },
  composer: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 15, borderWidth: 1, borderColor: '#e5e5e5' },
  composerInput: { minHeight: 60, maxHeight: 160, fontSize: 15, color: '#333', textAlignVertical: 'top' },
  composerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  composerCount: { fontSize: 12, color: '#999' },
  postButton: { backgroundColor: '#6366f1', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  postButtonDisabled: { opacity: 0.4 },
  postButtonText: { color: '#fff', fontWeight: '600' },
});
