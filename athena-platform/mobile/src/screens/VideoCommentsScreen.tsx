/**
 * Video Comments Screen
 * Displays and submits comments for a video
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { videoApi } from '../services/api-extensions';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoComments'>;

interface VideoComment {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    displayName: string;
    avatar: string | null;
  };
  replies?: VideoComment[];
}

export function VideoCommentsScreen({ route, navigation }: Props) {
  const { videoId, title } = route.params;
  const { user } = useAuth();
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const headerTitle = useMemo(() => {
    if (title && title.trim().length > 0) return 'Comments';
    return 'Comments';
  }, [title]);

  useEffect(() => {
    navigation.setOptions({ title: headerTitle });
  }, [navigation, headerTitle]);

  const loadComments = useCallback(async () => {
    try {
      const response = await videoApi.getComments(videoId);
      const list = response.data?.data || response.data?.comments || [];
      setComments(list);
    } catch (error) {
      setComments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [videoId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadComments();
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const response = await videoApi.addComment(videoId, newComment.trim());
      const created = response.data?.data;
      if (created) {
        setComments((prev) => [created, ...prev]);
      } else {
        await loadComments();
      }
      setNewComment('');
    } catch (error) {
      // Ignore; API layer logs errors
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimestamp = (value: string) => {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return '';
    }
  };

  const renderComment = (comment: VideoComment, depth = 0) => {
    const initials = comment.author?.displayName?.charAt(0)?.toUpperCase() || '?';
    return (
      <View key={comment.id} style={[styles.commentRow, depth > 0 && styles.replyRow]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.commentBody}>
          <View style={styles.commentHeader}>
            <Text style={styles.authorName}>@{comment.author.displayName}</Text>
            <Text style={styles.timestamp}>{formatTimestamp(comment.createdAt)}</Text>
          </View>
          <Text style={styles.commentText}>{comment.content}</Text>
          {comment.replies && comment.replies.length > 0 && (
            <View style={styles.replies}>
              {comment.replies.map((reply) => renderComment(reply, depth + 1))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading comments...</Text>
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderComment(item)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={60} color="#9ca3af" />
              <Text style={styles.emptyTitle}>No comments yet</Text>
              <Text style={styles.emptySubtitle}>Be the first to share your thoughts</Text>
            </View>
          }
        />
      )}

      <View style={styles.inputRow}>
        <View style={styles.inputAvatar}>
          <Text style={styles.avatarText}>{user?.displayName?.charAt(0) || 'U'}</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Write a comment"
          value={newComment}
          onChangeText={setNewComment}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, isSubmitting && styles.sendButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
  },
  listContent: {
    padding: 16,
    paddingBottom: 88,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  replyRow: {
    marginTop: 12,
    marginLeft: 32,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '600',
  },
  commentBody: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorName: {
    fontWeight: '600',
    color: '#111827',
  },
  timestamp: {
    fontSize: 12,
    color: '#9ca3af',
  },
  commentText: {
    marginTop: 4,
    color: '#374151',
  },
  replies: {
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 64,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  emptySubtitle: {
    marginTop: 6,
    color: '#6b7280',
  },
  inputRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  inputAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#111827',
  },
  sendButton: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
});
