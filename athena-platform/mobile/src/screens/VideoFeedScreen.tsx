/**
 * Video Feed Screen
 * TikTok-style vertical scrolling video feed for mobile
 *
 * Reads GET /video/feed, which answers { success, data: [...], nextCursor }
 * and is cursor-paginated; the tabs at the top pick the feed (newest, the
 * people you follow, trending). Like and save use the viewer state the server
 * attaches to every reel, so the icons show the truth on first load.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ViewToken,
  Share,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { videoApi, VideoPost, type VideoFeedKind } from '../services/api-extensions';
import { unwrapApiData, webUrl } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';
import { LoadingError } from '../components/ErrorBoundary';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_HEIGHT = SCREEN_HEIGHT - 80; // Account for tab bar
const PAGE_SIZE = 10;

type FeedTab = { key: 'newest' | VideoFeedKind; label: string };
const FEED_TABS: FeedTab[] = [
  { key: 'newest', label: 'For You' },
  { key: 'following', label: 'Following' },
  { key: 'trending', label: 'Trending' },
];

const authorName = (video: VideoPost) => video.author?.displayName?.trim() || 'ATHENA member';

interface VideoItemProps {
  video: VideoPost;
  isActive: boolean;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
  onComment: (id: string) => void;
  onShare: (video: VideoPost) => void;
}

function VideoItem({ video, isActive, onLike, onSave, onComment, onShare }: VideoItemProps) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);

  useEffect(() => {
    if (isActive) {
      videoRef.current?.playAsync();
      setIsPlaying(true);
    } else {
      videoRef.current?.pauseAsync();
      setIsPlaying(false);
    }
  }, [isActive]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsBuffering(status.isBuffering);
      setIsPlaying(status.isPlaying);
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      videoRef.current?.pauseAsync();
    } else {
      videoRef.current?.playAsync();
    }
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const hashtags = Array.isArray(video.hashtags) ? video.hashtags : [];

  return (
    <View style={styles.videoContainer}>
      <TouchableOpacity activeOpacity={1} onPress={togglePlayPause} style={styles.videoWrapper} accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
        <Video
          ref={videoRef}
          source={{ uri: video.videoUrl }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay={isActive}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        />

        {isBuffering && (
          <View style={styles.bufferingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {!isPlaying && !isBuffering && (
          <View style={styles.playOverlay}>
            <Ionicons name="play" size={60} color="rgba(255,255,255,0.8)" />
          </View>
        )}
      </TouchableOpacity>

      {/* Gradient overlay for text readability */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={styles.gradient}
      />

      {/* Video Info */}
      <View style={styles.videoInfo}>
        <View style={styles.authorRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {authorName(video).charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.authorName}>@{authorName(video)}</Text>
        </View>
        {video.title ? <Text style={styles.title} numberOfLines={2}>{video.title}</Text> : null}
        {video.description ? <Text style={styles.description} numberOfLines={2}>{video.description}</Text> : null}
        {hashtags.length > 0 && (
          <View style={styles.tagsRow}>
            {hashtags.slice(0, 3).map((tag, index) => (
              <Text key={index} style={styles.tag}>#{tag}</Text>
            ))}
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onLike(video.id)}
          accessibilityRole="button"
          accessibilityLabel={video.isLiked ? 'Unlike' : 'Like'}
        >
          <Ionicons
            name={video.isLiked ? 'heart' : 'heart-outline'}
            size={32}
            color={video.isLiked ? '#ff4757' : '#fff'}
          />
          <Text style={styles.actionCount}>{formatCount(video.likeCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onComment(video.id)}
          accessibilityRole="button"
          accessibilityLabel="Comments"
        >
          <Ionicons name="chatbubble-outline" size={30} color="#fff" />
          <Text style={styles.actionCount}>{formatCount(video.commentCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onShare(video)}
          accessibilityRole="button"
          accessibilityLabel="Share"
        >
          <Ionicons name="share-social-outline" size={30} color="#fff" />
          <Text style={styles.actionCount}>{formatCount(video.shareCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onSave(video.id)}
          accessibilityRole="button"
          accessibilityLabel={video.isSaved ? 'Remove from saved' : 'Save'}
        >
          <Ionicons name={video.isSaved ? 'bookmark' : 'bookmark-outline'} size={30} color={video.isSaved ? '#a5b4fc' : '#fff'} />
          <Text style={styles.actionCount}>{video.isSaved ? 'Saved' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function VideoFeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feed, setFeed] = useState<FeedTab['key']>('newest');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  // A feed that failed to load drew the same "No videos yet — be the first to
  // share!" card as a feed with nothing in it, so a dropped connection read as
  // an empty platform and there was nothing to tap to try again.
  const [loadError, setLoadError] = useState<string | null>(null);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  });

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  });

  const fetchVideos = useCallback(async (after: string | null, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else if (!after) setLoading(true);

      const response = await videoApi.getFeed({
        limit: PAGE_SIZE,
        cursor: after ?? undefined,
        feed: feed === 'newest' ? undefined : feed,
      });
      const page = unwrapApiData<VideoPost[]>(response.data);
      const newVideos = Array.isArray(page) ? page : [];
      const next: string | null = response.data?.nextCursor ?? null;

      setVideos((prev) => (after ? [...prev, ...newVideos] : newVideos));
      setCursor(next);
      setHasMore(!!next);
      setLoadError(null);
    } catch (error: any) {
      // A page that failed to append is not the same as a first page that
      // failed: the reels already on screen still play, so the failure is only
      // worth a message when there is nothing behind it.
      setHasMore(false);
      if (!after) {
        setLoadError(error?.response?.data?.message || 'Videos could not be loaded. Check your connection and try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [feed]);

  useEffect(() => {
    setActiveIndex(0);
    fetchVideos(null);
  }, [fetchVideos]);

  const handleRefresh = () => {
    fetchVideos(null, true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore && cursor) {
      fetchVideos(cursor);
    }
  };

  const handleLike = async (videoId: string) => {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    try {
      if (video.isLiked) {
        await videoApi.unlikeVideo(videoId);
      } else {
        await videoApi.likeVideo(videoId);
      }

      setVideos(prev => prev.map(v =>
        v.id === videoId
          ? {
              ...v,
              isLiked: !v.isLiked,
              likeCount: v.isLiked ? v.likeCount - 1 : v.likeCount + 1
            }
          : v
      ));
    } catch (error) {
      console.error('Failed to like video:', error);
    }
  };

  const handleSave = async (videoId: string) => {
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;
    try {
      if (video.isSaved) {
        await videoApi.unsaveVideo(videoId);
      } else {
        await videoApi.saveVideo(videoId);
      }
      setVideos((prev) => prev.map((v) => (v.id === videoId ? { ...v, isSaved: !v.isSaved } : v)));
    } catch (error) {
      console.error('Failed to save video:', error);
    }
  };

  const handleComment = (videoId: string) => {
    const video = videos.find((item) => item.id === videoId);
    navigation.navigate('VideoComments', { videoId, title: video?.title ?? undefined });
  };

  const handleShare = async (video: VideoPost) => {
    try {
      await Share.share({
        message: `Check out this video on ATHENA: ${video.title ?? authorName(video)}`,
        url: webUrl(`/videos/${video.id}`),
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  const renderItem = ({ item, index }: { item: VideoPost; index: number }) => (
    <VideoItem
      video={item}
      isActive={index === activeIndex}
      onLike={handleLike}
      onSave={handleSave}
      onComment={handleComment}
      onShare={handleShare}
    />
  );

  const emptyCopy =
    feed === 'following'
      ? { title: 'Nothing from people you follow yet', sub: 'Follow a few creators on the web and their reels will show here.' }
      : { title: 'No videos yet', sub: 'Be the first to share!' };

  return (
    <View style={styles.container}>
      {loading && videos.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading videos...</Text>
        </View>
      ) : (
        <FlatList
          data={videos}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={VIDEO_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewabilityConfig.current}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          initialNumToRender={3}
          windowSize={5}
          maxToRenderPerBatch={3}
          removeClippedSubviews
          getItemLayout={(_, index) => ({
            length: VIDEO_HEIGHT,
            offset: VIDEO_HEIGHT * index,
            index,
          })}
          ListFooterComponent={
            loading && videos.length > 0 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#6366f1" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            loadError ? (
              <View style={styles.emptyContainer}>
                <LoadingError message={loadError} onRetry={handleRefresh} />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="videocam-off-outline" size={64} color="#9ca3af" />
                <Text style={styles.emptyText}>{emptyCopy.title}</Text>
                <Text style={styles.emptySubtext}>{emptyCopy.sub}</Text>
              </View>
            )
          }
        />
      )}

      {/* Feed tabs */}
      <View style={styles.categoryTabs}>
        {FEED_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.categoryTab}
            onPress={() => setFeed(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: feed === tab.key }}
          >
            <Text style={[styles.categoryText, feed === tab.key && styles.categoryActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  videoContainer: {
    height: VIDEO_HEIGHT,
    width: SCREEN_WIDTH,
    backgroundColor: '#000',
  },
  videoWrapper: {
    flex: 1,
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 200,
  },
  videoInfo: {
    position: 'absolute',
    bottom: 80,
    left: 12,
    right: 80,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  authorName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    color: '#a5b4fc',
    fontSize: 14,
    marginRight: 8,
  },
  actionButtons: {
    position: 'absolute',
    right: 12,
    bottom: 100,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  actionCount: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
  footerLoader: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    height: VIDEO_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  categoryTabs: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  categoryText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '500',
  },
  categoryActive: {
    color: '#fff',
    fontWeight: '700',
  },
});
