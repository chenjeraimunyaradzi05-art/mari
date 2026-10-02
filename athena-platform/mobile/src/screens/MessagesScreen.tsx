/**
 * Messages Screen - Conversations List
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { messagesApi, unwrapApiData } from '../services/api';
import { socketService } from '../services/socket';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { LoadingError } from '../components/ErrorBoundary';

// A row of GET /messages/conversations, which answers { success, data: [...] }.
interface Conversation {
  id: string;
  lastMessage: {
    content: string;
    createdAt: string;
    senderId?: string;
    isRead?: boolean;
    deletedAt?: string | null;
  } | null;
  participant: {
    id: string;
    displayName: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatar?: string | null;
  };
  unreadCount: number;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  // Someone she does not follow has written to her. It waits in Requests until
  // she accepts it, and the badge on the Messages tab leaves it out.
  isRequest?: boolean;
  updatedAt?: string;
}

function participantName(c: Conversation): string {
  const p = c.participant;
  return p.displayName?.trim() || [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || 'Member';
}

/**
 * The first page as it now stands, followed by every older thread already
 * loaded that is not on it. A new message moves its thread to the top, so a
 * thread can move from page two onto page one between fetches; each id
 * appears once.
 */
export function mergeFirstPage(fresh: Conversation[], loaded: Conversation[]): Conversation[] {
  const onFirstPage = new Set(fresh.map((c) => c.id));
  return [...fresh, ...loaded.filter((c) => !onFirstPage.has(c.id))];
}

/** A later page appended, skipping any thread already shown. */
export function appendPage(loaded: Conversation[], page: Conversation[]): Conversation[] {
  const shown = new Set(loaded.map((c) => c.id));
  return [...loaded, ...page.filter((c) => !shown.has(c.id))];
}

const hasMorePages = (payload: unknown): boolean =>
  Boolean((payload as { pagination?: { hasMore?: unknown } } | null)?.pagination?.hasMore === true);

export function MessagesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  // Messages from people she has not said yes to are kept apart, so a stranger
  // cannot put a message in front of her just by sending it.
  const [tab, setTab] = useState<'messages' | 'requests'>('messages');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // A failed fetch used to leave the list empty behind the friendly "No
  // messages yet" card, so a dropped connection was indistinguishable from
  // nobody having written to her. On a phone the connection drops constantly,
  // which made that the ordinary case rather than the rare one.
  const [loadError, setLoadError] = useState<string | null>(null);
  // The server answers at most a hundred threads a page. This screen used to
  // ask once and show that as the whole inbox, so a member with more threads
  // than that could never reach her older conversations.
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  // 'reset' starts the list again from the first page, as a pull to refresh
  // does. 'merge' re-reads only the first page and keeps the older pages she
  // has already scrolled to, for a new message arriving while she reads.
  const fetchConversations = useCallback(async (mode: 'reset' | 'merge' = 'reset') => {
    try {
      const response = await messagesApi.getConversations({ page: 1 });
      const list = unwrapApiData<Conversation[]>(response.data);
      const fresh = Array.isArray(list) ? list : [];
      const more = hasMorePages(response.data);
      if (mode === 'reset') {
        setConversations(fresh);
        setPage(1);
        setHasMore(more);
      } else {
        setConversations((loaded) => mergeFirstPage(fresh, loaded));
        setHasMore((current) => current || more);
      }
      setLoadMoreError(null);
      setLoadError(null);
    } catch (error: any) {
      setLoadError(
        error?.response?.data?.message || 'Your conversations could not be loaded. Check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    const next = page + 1;
    try {
      const response = await messagesApi.getConversations({ page: next });
      const list = unwrapApiData<Conversation[]>(response.data);
      setConversations((loaded) => appendPage(loaded, Array.isArray(list) ? list : []));
      setPage(next);
      setHasMore(hasMorePages(response.data));
      setLoadMoreError(null);
    } catch (error: any) {
      // The threads already on screen are still right; what failed is the
      // next page, and it says so at the foot of the list with a retry.
      setLoadMoreError(error?.response?.data?.message || 'Older conversations could not be loaded.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, page]);

  useEffect(() => {
    fetchConversations();

    // A new message moves its thread to the top: re-read the first page and
    // keep the older pages already loaded.
    const unsubscribe = socketService.on('messages:new', () => {
      fetchConversations('merge');
    });

    return () => {
      unsubscribe();
    };
  }, [fetchConversations]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchConversations('reset');
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationCard}
      onPress={() =>
        navigation.navigate('ChatDetail', {
          conversationId: item.id,
          participantName: participantName(item),
          participantId: item.participant.id,
          isRequest: Boolean(item.isRequest),
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${participantName(item)}${item.unreadCount > 0 ? `, ${item.unreadCount} unread` : ''}`}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {participantName(item).charAt(0)}
        </Text>
      </View>
      <View style={styles.conversationInfo}>
        <View style={styles.headerRow}>
          <Text style={styles.participantName}>{participantName(item)}</Text>
          <Text style={styles.time}>{formatTime(item.lastMessage?.createdAt)}</Text>
        </View>
        <View style={styles.messageRow}>
          <Text
            style={[
              styles.lastMessage,
              item.unreadCount > 0 && styles.unreadMessage,
            ]}
            numberOfLines={1}
          >
            {item.lastMessage?.deletedAt ? 'Message deleted' : item.lastMessage?.content || 'Say hello'}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Text>Loading messages...</Text>
      </View>
    );
  }

  const requests = conversations.filter((c) => c.isRequest);
  const inbox = conversations.filter((c) => !c.isRequest);
  const shown = tab === 'requests' ? requests : inbox;

  return (
    <View style={styles.container}>
      <View style={styles.tabs} accessibilityRole="tablist">
        <TouchableOpacity
          style={[styles.tab, tab === 'messages' && styles.tabActive]}
          onPress={() => setTab('messages')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'messages' }}
          accessibilityLabel="Messages"
        >
          <Text style={[styles.tabText, tab === 'messages' && styles.tabTextActive]}>Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'requests' && styles.tabActive]}
          onPress={() => setTab('requests')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'requests' }}
          accessibilityLabel={requests.length > 0 ? `Requests, ${requests.length} waiting` : 'Requests'}
        >
          <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>
            Requests{requests.length > 0 ? ` (${requests.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={shown}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        // After a failed page, only her tap on the footer tries again, so a
        // list resting at its end does not retry on every scroll event.
        onEndReached={() => {
          if (!loadMoreError) void loadMore();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          shown.length === 0 ? null : loadMoreError ? (
            <TouchableOpacity
              style={styles.footer}
              onPress={loadMore}
              accessibilityRole="button"
              accessibilityLabel="Try loading older conversations again"
            >
              <Text style={styles.footerError}>{loadMoreError}</Text>
              <Text style={styles.footerRetry}>Tap to try again</Text>
            </TouchableOpacity>
          ) : isLoadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color="#6366f1" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loadError ? (
            <LoadingError message={loadError} onRetry={onRefresh} />
          ) : tab === 'requests' ? (
            <View style={styles.centered}>
              <Ionicons name="mail-open-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No requests</Text>
              <Text style={styles.emptySubtext}>
                When someone you do not follow writes to you, it waits here until you accept it.
              </Text>
            </View>
          ) : (
            <View style={styles.centered}>
              <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>
                When a mentor, a group or another member writes to you, the conversation will be here.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  listContent: {
    flexGrow: 1,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#6366f1' },
  tabText: { fontSize: 15, color: '#6b7280', fontWeight: '500' },
  tabTextActive: { color: '#6366f1', fontWeight: '700' },
  conversationCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  conversationInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  time: {
    fontSize: 12,
    color: '#999',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  unreadMessage: {
    fontWeight: '600',
    color: '#333',
  },
  badge: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    marginTop: 15,
    color: '#999',
    fontSize: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    marginTop: 8,
    color: '#bbb',
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerError: {
    color: '#b91c1c',
    fontSize: 14,
    textAlign: 'center',
  },
  footerRetry: {
    marginTop: 4,
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
});
