/**
 * Video Feed Screen
 * TikTok-style vertical scrolling video feed for mobile
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
import { videoApi, VideoPost } from '../services/api-extensions';
import { RootStackParamList } from '../navigation/AppNavigator';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_HEIGHT = SCREEN_HEIGHT - 80; // Account for tab bar

interface VideoItemProps {
  video: VideoPost;
  isActive: boolean;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  onShare: (video: VideoPost) => void;
}

function VideoItem({ video, isActive, onLike, onComment, onShare }: VideoItemProps) {
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

  return (
    <View style={styles.videoContainer}>
      <TouchableOpacity activeOpacity={1} onPress={togglePlayPause} style={styles.videoWrapper}>
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
              {video.author.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.authorName}>@{video.author.displayName}</Text>
          <TouchableOpacity style={styles.followButton}>
            <Text style={styles.followButtonText}>Follow</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title} numberOfLines={2}>{video.title}</Text>
        <Text style={styles.description} numberOfLines={2}>{video.description}</Text>
        {video.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {video.tags.slice(0, 3).map((tag, index) => (
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
        >
          <Ionicons name="chatbubble-outline" size={30} color="#fff" />
          <Text style={styles.actionCount}>{formatCount(video.commentCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => onShare(video)}
        >
          <Ionicons name="share-social-outline" size={30} color="#fff" />
          <Text style={styles.actionCount}>{formatCount(video.shareCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="bookmark-outline" size={30} color="#fff" />
          <Text style={styles.actionCount}>Save</Text>
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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  });

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  });

  const fetchVideos = useCallback(async (pageNum: number, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else if (pageNum === 1) setLoading(true);

      const response = await videoApi.getFeed({ page: pageNum, limit: 10 });
      const newVideos = response.data.data?.videos || [];
      
      if (isRefresh || pageNum === 1) {
        setVideos(newVideos);
      } else {
        setVideos(prev => [...prev, ...newVideos]);
      }
      
      setHasMore(response.data.data?.hasMore ?? newVideos.length === 10);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos(1);
  }, [fetchVideos]);

  const handleRefresh = () => {
    fetchVideos(1, true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchVideos(page + 1);
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

  const handleComment = (videoId: string) => {
    const video = videos.find((item) => item.id === videoId);
    navigation.navigate('VideoComments', { videoId, title: video?.title });
  };

  const handleShare = async (video: VideoPost) => {
    try {
      await Share.share({
        message: `Check out this video on ATHENA: ${video.title}`,
        url: video.videoUrl,
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
      onComment={handleComment}
      onShare={handleShare}
    />
  );

  if (loading && videos.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading videos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
        getItemLayout={(_, index) => ({ length: VIDEO_HEIGHT, offset: VIDEO_HEIGHT * index, index })}
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
          <View style={styles.emptyContainer}>
            <Ionicons name="videocam-off-outline" size={64} color="#9ca3af" />
            <Text style={styles.emptyText}>No videos yet</Text>
            <Text style={styles.emptySubtext}>Be the first to share!</Text>
          </View>
        }
      />

      {/* Category Tabs */}
      <View style={styles.categoryTabs}>
        <TouchableOpacity style={styles.categoryTab}>
          <Text style={[styles.categoryText, styles.categoryActive]}>For You</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.categoryTab}>
          <Text style={styles.categoryText}>Following</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.categoryTab}>
          <Text style={styles.categoryText}>Career</Text>
        </TouchableOpacity>
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
  followButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
  },
  emptySubtext: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
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
