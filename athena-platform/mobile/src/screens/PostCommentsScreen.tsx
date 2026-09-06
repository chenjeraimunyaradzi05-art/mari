/**
 * The comments on a post, and a place to add one.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';
import { postsApi, FeedPost, PostComment, unwrapApiData } from '../services/api';
import type { RootStackParamList } from '../navigation/AppNavigator';

function CommentRow({ comment, depth = 0 }: { comment: PostComment; depth?: number }) {
  return (
    <View style={[styles.comment, depth > 0 && styles.reply]}>
      <View style={styles.commentAvatar}>
        {comment.author?.avatar ? <Image source={{ uri: comment.author.avatar }} style={styles.commentAvatarImage} /> : <Text style={styles.commentAvatarText}>{comment.author?.displayName?.charAt(0) || '?'}</Text>}
      </View>
      <View style={styles.commentBody}>
        <Text style={styles.commentAuthor}>{comment.author?.displayName || 'A member'}</Text>
        <Text style={styles.commentText}>{comment.content}</Text>
        {comment.replies?.map((reply) => (
          <CommentRow key={reply.id} comment={reply} depth={depth + 1} />
        ))}
      </View>
    </View>
  );
}

export function PostCommentsScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'PostComments'>>();
  const { postId } = route.params;
  const [post, setPost] = useState<(FeedPost & { comments?: PostComment[] }) | null>(null);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await postsApi.get(postId);
      setPost(unwrapApiData<FeedPost & { comments?: PostComment[] }>(response.data));
    } catch (error) {
      console.error('Failed to load post:', error);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    const content = draft.trim();
    if (!content) return;
    setIsSending(true);
    try {
      await postsApi.comment(postId, content);
      setDraft('');
      await load();
    } catch (error: any) {
      Alert.alert('Not sent', error?.response?.data?.message || 'Try again in a moment.');
    } finally {
      setIsSending(false);
    }
  };

  const comments = post?.comments ?? [];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CommentRow comment={item} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          post ? (
            <View style={styles.postBox}>
              <Text style={styles.postAuthor}>{post.author?.displayName || 'A member'}</Text>
              <Text style={styles.postContent}>{post.content}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="chatbubble-ellipses-outline" size={56} color="#ccc" />
            <Text style={styles.emptyText}>{isLoading ? 'Loading…' : 'No comments yet'}</Text>
          </View>
        }
      />
      <View style={styles.composer}>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Add a comment" style={styles.input} multiline maxLength={2000} />
        <TouchableOpacity style={[styles.sendButton, (!draft.trim() || isSending) && styles.sendButtonDisabled]} onPress={send} disabled={!draft.trim() || isSending} accessibilityLabel="Send comment">
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  listContent: { padding: 15, paddingBottom: 90 },
  centered: { alignItems: 'center', padding: 40 },
  emptyText: { marginTop: 12, color: '#888' },
  postBox: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15 },
  postAuthor: { fontWeight: '600', color: '#333', marginBottom: 6 },
  postContent: { fontSize: 15, color: '#333', lineHeight: 22 },
  comment: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  reply: { marginTop: 10, marginBottom: 0 },
  commentAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#a5b4fc', alignItems: 'center', justifyContent: 'center' },
  commentAvatarImage: { width: 34, height: 34, borderRadius: 17 },
  commentAvatarText: { color: '#fff', fontWeight: '600' },
  commentBody: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 10 },
  commentAuthor: { fontWeight: '600', color: '#333', fontSize: 13 },
  commentText: { color: '#333', marginTop: 2, lineHeight: 20 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e5e5' },
  input: { flex: 1, maxHeight: 120, backgroundColor: '#f5f5f5', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#333' },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.4 },
});
