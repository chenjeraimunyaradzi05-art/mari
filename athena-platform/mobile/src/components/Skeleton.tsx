/**
 * Skeleton Component
 * Phase 5: Mobile Parity - Loading placeholder components
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// BASE SKELETON
// ============================================

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 4,
  style,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

// ============================================
// PRESET SKELETONS
// ============================================

export const SkeletonText: React.FC<{
  lines?: number;
  lineHeight?: number;
  lastLineWidth?: number | string;
}> = ({ lines = 3, lineHeight = 14, lastLineWidth = '60%' }) => {
  return (
    <View style={styles.textContainer}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={lineHeight}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          style={styles.textLine}
        />
      ))}
    </View>
  );
};

export const SkeletonAvatar: React.FC<{
  size?: number;
}> = ({ size = 48 }) => {
  return <Skeleton width={size} height={size} borderRadius={size / 2} />;
};

export const SkeletonImage: React.FC<{
  width?: number | string;
  height?: number;
  borderRadius?: number;
}> = ({ width = '100%', height = 200, borderRadius = 8 }) => {
  return <Skeleton width={width} height={height} borderRadius={borderRadius} />;
};

export const SkeletonButton: React.FC<{
  width?: number | string;
  height?: number;
}> = ({ width = 120, height = 40 }) => {
  return <Skeleton width={width} height={height} borderRadius={20} />;
};

// ============================================
// CARD SKELETONS
// ============================================

export const VideoCardSkeleton: React.FC = () => {
  return (
    <View style={styles.videoCard}>
      <Skeleton width="100%" height={SCREEN_WIDTH * 1.4} borderRadius={0} />
      <View style={styles.videoOverlay}>
        <View style={styles.videoUserInfo}>
          <SkeletonAvatar size={40} />
          <View style={styles.videoUserText}>
            <Skeleton width={120} height={14} />
            <Skeleton width={80} height={12} style={{ marginTop: 4 }} />
          </View>
        </View>
        <Skeleton width={200} height={14} style={{ marginTop: 8 }} />
        <Skeleton width={150} height={12} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
};

export const JobCardSkeleton: React.FC = () => {
  return (
    <View style={styles.jobCard}>
      <View style={styles.jobHeader}>
        <SkeletonAvatar size={56} />
        <View style={styles.jobHeaderText}>
          <Skeleton width={180} height={16} />
          <Skeleton width={120} height={14} style={{ marginTop: 4 }} />
          <Skeleton width={100} height={12} style={{ marginTop: 4 }} />
        </View>
      </View>
      <View style={styles.jobTags}>
        <Skeleton width={80} height={24} borderRadius={12} />
        <Skeleton width={60} height={24} borderRadius={12} style={{ marginLeft: 8 }} />
        <Skeleton width={90} height={24} borderRadius={12} style={{ marginLeft: 8 }} />
      </View>
      <Skeleton width={140} height={16} style={{ marginTop: 12 }} />
      <View style={styles.jobActions}>
        <SkeletonButton width={100} height={36} />
        <SkeletonButton width={100} height={36} />
      </View>
    </View>
  );
};

export const ConversationSkeleton: React.FC = () => {
  return (
    <View style={styles.conversation}>
      <SkeletonAvatar size={56} />
      <View style={styles.conversationContent}>
        <Skeleton width={150} height={16} />
        <Skeleton width={200} height={14} style={{ marginTop: 4 }} />
      </View>
      <View style={styles.conversationMeta}>
        <Skeleton width={40} height={12} />
        <Skeleton width={20} height={20} borderRadius={10} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
};

export const MessageSkeleton: React.FC<{ isOwn?: boolean }> = ({ isOwn = false }) => {
  return (
    <View style={[styles.message, isOwn && styles.messageOwn]}>
      {!isOwn && <SkeletonAvatar size={32} />}
      <View style={[styles.messageBubble, isOwn && styles.messageBubbleOwn]}>
        <Skeleton width={180} height={14} />
        <Skeleton width={120} height={14} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
};

export const NotificationSkeleton: React.FC = () => {
  return (
    <View style={styles.notification}>
      <Skeleton width={40} height={40} borderRadius={8} />
      <View style={styles.notificationContent}>
        <Skeleton width={200} height={14} />
        <Skeleton width={160} height={12} style={{ marginTop: 4 }} />
        <Skeleton width={80} height={10} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
};

export const ProfileSkeleton: React.FC = () => {
  return (
    <View style={styles.profile}>
      <SkeletonAvatar size={100} />
      <Skeleton width={160} height={20} style={{ marginTop: 16 }} />
      <Skeleton width={120} height={14} style={{ marginTop: 8 }} />
      <Skeleton width={220} height={12} style={{ marginTop: 12 }} />
      <Skeleton width={180} height={12} style={{ marginTop: 4 }} />
      <View style={styles.profileStats}>
        <View style={styles.profileStat}>
          <Skeleton width={50} height={20} />
          <Skeleton width={60} height={12} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.profileStat}>
          <Skeleton width={50} height={20} />
          <Skeleton width={60} height={12} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.profileStat}>
          <Skeleton width={50} height={20} />
          <Skeleton width={60} height={12} style={{ marginTop: 4 }} />
        </View>
      </View>
      <SkeletonButton width={200} height={44} />
    </View>
  );
};

export const ApplicationSkeleton: React.FC = () => {
  return (
    <View style={styles.application}>
      <View style={styles.applicationHeader}>
        <SkeletonAvatar size={48} />
        <View style={styles.applicationHeaderText}>
          <Skeleton width={180} height={16} />
          <Skeleton width={140} height={14} style={{ marginTop: 4 }} />
        </View>
        <Skeleton width={80} height={24} borderRadius={12} />
      </View>
      <View style={styles.applicationTimeline}>
        <Skeleton width={12} height={12} borderRadius={6} />
        <Skeleton width={2} height={40} style={{ marginLeft: 5 }} />
        <Skeleton width={12} height={12} borderRadius={6} style={{ marginLeft: -7 }} />
      </View>
      <Skeleton width={140} height={12} style={{ marginTop: 12 }} />
    </View>
  );
};

// ============================================
// LIST SKELETONS
// ============================================

export const JobListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <JobCardSkeleton key={index} />
      ))}
    </View>
  );
};

export const ConversationListSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <ConversationSkeleton key={index} />
      ))}
    </View>
  );
};

export const NotificationListSkeleton: React.FC<{ count?: number }> = ({ count = 10 }) => {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <NotificationSkeleton key={index} />
      ))}
    </View>
  );
};

export const MessageListSkeleton: React.FC<{ count?: number }> = ({ count = 10 }) => {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <MessageSkeleton key={index} isOwn={index % 3 === 0} />
      ))}
    </View>
  );
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E1E1E1',
  },
  textContainer: {
    width: '100%',
  },
  textLine: {
    marginBottom: 8,
  },
  videoCard: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.6,
    backgroundColor: '#1a1a1a',
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 60,
  },
  videoUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoUserText: {
    marginLeft: 12,
  },
  jobCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  jobHeader: {
    flexDirection: 'row',
  },
  jobHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  jobTags: {
    flexDirection: 'row',
    marginTop: 12,
  },
  jobActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  conversation: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  conversationContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  conversationMeta: {
    alignItems: 'flex-end',
  },
  message: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'flex-end',
  },
  messageOwn: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 16,
    marginLeft: 8,
    maxWidth: '70%',
  },
  messageBubbleOwn: {
    backgroundColor: '#e8f4fd',
    marginLeft: 0,
    marginRight: 8,
  },
  notification: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  notificationContent: {
    flex: 1,
    marginLeft: 12,
  },
  profile: {
    alignItems: 'center',
    padding: 24,
  },
  profileStats: {
    flexDirection: 'row',
    marginVertical: 24,
  },
  profileStat: {
    alignItems: 'center',
    marginHorizontal: 24,
  },
  application: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  applicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  applicationHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  applicationTimeline: {
    marginTop: 16,
    alignItems: 'center',
    flexDirection: 'row',
  },
});

export default Skeleton;
