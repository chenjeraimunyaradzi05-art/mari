/**
 * One post in a feed: author, text, and the like, comment and share
 * actions, each of which does something.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { postsApi, FeedPost, WEB_URL } from '../services/api';

interface PostCardProps {
  post: FeedPost;
  onOpenComments?: (post: FeedPost) => void;
  onChange?: (post: FeedPost) => void;
}

const timeAgo = (iso: string): string => {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)}d`;
  return new Date(iso).toLocaleDateString('en-AU');
};

export function PostCard({ post, onOpenComments, onChange }: PostCardProps) {
  const [busy, setBusy] = useState(false);

  const toggleLike = async () => {
    if (busy) return;
    setBusy(true);
    const liked = !post.isLiked;
    const optimistic = { ...post, isLiked: liked, likeCount: Math.max(0, post.likeCount + (liked ? 1 : -1)) };
    onChange?.(optimistic);
    try {
      if (liked) await postsApi.like(post.id);
      else await postsApi.unlike(post.id);
    } catch (error) {
      onChange?.(post);
      console.error('Like failed:', error);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    try {
      await Share.share({ message: `${post.content.slice(0, 200)}\n\n${WEB_URL}/posts/${post.id}` });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.avatar}>
          {post.author?.avatar ? <Image source={{ uri: post.author.avatar }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{post.author?.displayName?.charAt(0) || '?'}</Text>}
        </View>
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{post.author?.displayName || 'A member'}</Text>
          <Text style={styles.authorHeadline}>
            {post.author?.headline ? `${post.author.headline} · ` : ''}
            {timeAgo(post.createdAt)}
          </Text>
        </View>
      </View>

      <Text style={styles.postContent}>{post.content}</Text>

      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionButton} onPress={toggleLike} accessibilityLabel={post.isLiked ? 'Unlike' : 'Like'}>
          <Ionicons name={post.isLiked ? 'heart' : 'heart-outline'} size={20} color={post.isLiked ? '#e11d48' : '#666'} />
          <Text style={styles.actionText}>{post.likeCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => onOpenComments?.(post)} accessibilityLabel="Comments">
          <Ionicons name="chatbubble-outline" size={20} color="#666" />
          <Text style={styles.actionText}>{post.commentCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={share} accessibilityLabel="Share">
          <Ionicons name="share-outline" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeader: { flexDirection: 'row', marginBottom: 12 },
  avatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarImage: { width: 45, height: 45, borderRadius: 22.5 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  authorInfo: { flex: 1, justifyContent: 'center' },
  authorName: { fontSize: 16, fontWeight: '600', color: '#333' },
  authorHeadline: { fontSize: 13, color: '#666', marginTop: 2 },
  postContent: { fontSize: 15, color: '#333', lineHeight: 22, marginBottom: 12 },
  postActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12, gap: 24 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 14, color: '#666' },
});
