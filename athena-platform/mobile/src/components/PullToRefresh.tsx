/**
 * Pull to Refresh Component
 * Phase 5: Mobile Parity - Native pull to refresh with custom animations
 */

import React, { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  FlatList,
  FlatListProps,
  ScrollViewProps,
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ============================================
// TYPES
// ============================================

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  refreshing?: boolean;
  tintColor?: string;
  title?: string;
  titleColor?: string;
  progressBackgroundColor?: string;
}

// ============================================
// REFRESH CONTROL WRAPPER
// ============================================

export const useRefresh = (onRefresh: () => Promise<void>) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return { refreshing, handleRefresh };
};

// ============================================
// SCROLL VIEW WITH PULL TO REFRESH
// ============================================

interface RefreshableScrollViewProps extends ScrollViewProps, PullToRefreshProps {
  children: React.ReactNode;
}

export const RefreshableScrollView: React.FC<RefreshableScrollViewProps> = ({
  onRefresh,
  refreshing: externalRefreshing,
  tintColor = '#3B82F6',
  title,
  titleColor = '#666',
  progressBackgroundColor = '#fff',
  children,
  ...scrollViewProps
}) => {
  const { refreshing, handleRefresh } = useRefresh(onRefresh);
  const isRefreshing = externalRefreshing ?? refreshing;

  return (
    <ScrollView
      {...scrollViewProps}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={tintColor}
          title={title}
          titleColor={titleColor}
          progressBackgroundColor={progressBackgroundColor}
        />
      }
    >
      {children}
    </ScrollView>
  );
};

// ============================================
// FLAT LIST WITH PULL TO REFRESH
// ============================================

interface RefreshableFlatListProps<T> extends Omit<FlatListProps<T>, 'refreshControl'>, PullToRefreshProps {}

export function RefreshableFlatList<T>({
  onRefresh,
  refreshing: externalRefreshing,
  tintColor = '#3B82F6',
  title,
  titleColor = '#666',
  progressBackgroundColor = '#fff',
  ...flatListProps
}: RefreshableFlatListProps<T>) {
  const { refreshing, handleRefresh } = useRefresh(onRefresh);
  const isRefreshing = externalRefreshing ?? refreshing;

  return (
    <FlatList
      {...flatListProps}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={tintColor}
          title={title}
          titleColor={titleColor}
          progressBackgroundColor={progressBackgroundColor}
        />
      }
    />
  );
}

// ============================================
// CUSTOM REFRESH HEADER
// ============================================

interface CustomRefreshHeaderProps {
  refreshing: boolean;
  pullProgress: number; // 0-1
}

export const CustomRefreshHeader: React.FC<CustomRefreshHeaderProps> = ({
  refreshing,
  pullProgress,
}) => {
  const rotation = new Animated.Value(pullProgress * 360);

  return (
    <View style={styles.refreshHeader}>
      {refreshing ? (
        <ActivityIndicator size="small" color="#3B82F6" />
      ) : (
        <Animated.View
          style={{
            transform: [{ rotate: `${pullProgress * 360}deg` }],
          }}
        >
          <Ionicons name="arrow-down" size={24} color="#3B82F6" />
        </Animated.View>
      )}
      <Text style={styles.refreshText}>
        {refreshing
          ? 'Refreshing...'
          : pullProgress >= 1
          ? 'Release to refresh'
          : 'Pull to refresh'}
      </Text>
    </View>
  );
};

// ============================================
// INFINITE SCROLL HANDLER
// ============================================

interface InfiniteScrollProps {
  onLoadMore: () => Promise<void>;
  hasMore: boolean;
  threshold?: number;
}

export const useInfiniteScroll = ({
  onLoadMore,
  hasMore,
  threshold = 0.5,
}: InfiniteScrollProps) => {
  const [loadingMore, setLoadingMore] = useState(false);

  const handleEndReached = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      await onLoadMore();
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, onLoadMore]);

  return {
    loadingMore,
    onEndReached: handleEndReached,
    onEndReachedThreshold: threshold,
    ListFooterComponent: loadingMore ? <LoadMoreIndicator /> : null,
  };
};

// ============================================
// LOAD MORE INDICATOR
// ============================================

export const LoadMoreIndicator: React.FC = () => {
  return (
    <View style={styles.loadMore}>
      <ActivityIndicator size="small" color="#3B82F6" />
      <Text style={styles.loadMoreText}>Loading more...</Text>
    </View>
  );
};

// ============================================
// END OF LIST INDICATOR
// ============================================

interface EndOfListProps {
  message?: string;
}

export const EndOfList: React.FC<EndOfListProps> = ({
  message = "You've reached the end",
}) => {
  return (
    <View style={styles.endOfList}>
      <View style={styles.endOfListLine} />
      <Text style={styles.endOfListText}>{message}</Text>
      <View style={styles.endOfListLine} />
    </View>
  );
};

// ============================================
// LOADING OVERLAY
// ============================================

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message = 'Loading...',
}) => {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.overlayContent}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.overlayText}>{message}</Text>
      </View>
    </View>
  );
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  refreshHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  refreshText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  loadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  endOfList: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  endOfListLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  endOfListText: {
    marginHorizontal: 16,
    fontSize: 12,
    color: '#9CA3AF',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  overlayContent: {
    alignItems: 'center',
  },
  overlayText: {
    marginTop: 16,
    fontSize: 16,
    color: '#374151',
  },
});

export default RefreshableScrollView;
