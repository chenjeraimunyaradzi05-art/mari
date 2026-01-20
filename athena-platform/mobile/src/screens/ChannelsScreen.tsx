/**
 * Community Channels Screen
 * Slack-style community chat for mobile
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { channelApi, Channel, ChannelMessage } from '../services/api-extensions';
import { useAuth } from '../context/AuthContext';

interface ChannelItemProps {
  channel: Channel;
  isSelected: boolean;
  onPress: () => void;
}

function ChannelItem({ channel, isSelected, onPress }: ChannelItemProps) {
  return (
    <TouchableOpacity
      style={[styles.channelItem, isSelected && styles.channelItemSelected]}
      onPress={onPress}
    >
      <View style={styles.channelIcon}>
        {channel.type === 'private' ? (
          <Ionicons name="lock-closed" size={18} color="#9ca3af" />
        ) : (
          <Text style={styles.channelHash}>#</Text>
        )}
      </View>
      <View style={styles.channelInfo}>
        <Text style={[styles.channelName, isSelected && styles.channelNameSelected]}>
          {channel.name}
        </Text>
        {channel.lastMessage && (
          <Text style={styles.lastMessage} numberOfLines={1}>
            {channel.lastMessage.authorName}: {channel.lastMessage.content}
          </Text>
        )}
      </View>
      {channel.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadCount}>
            {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

interface MessageItemProps {
  message: ChannelMessage;
  showAuthor: boolean;
}

function MessageItem({ message, showAuthor }: MessageItemProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.messageItem, message.isOwn && styles.messageItemOwn]}>
      {showAuthor && !message.isOwn && (
        <View style={styles.messageAvatar}>
          <Text style={styles.avatarText}>
            {message.author.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={[
        styles.messageBubble,
        message.isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther,
        !showAuthor && !message.isOwn && styles.messageBubbleNoAvatar
      ]}>
        {showAuthor && !message.isOwn && (
          <Text style={styles.messageAuthor}>{message.author.displayName}</Text>
        )}
        <Text style={[styles.messageText, message.isOwn && styles.messageTextOwn]}>
          {message.content}
        </Text>
        <Text style={[styles.messageTime, message.isOwn && styles.messageTimeOwn]}>
          {formatTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

interface CreateChannelModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; description: string; type: 'public' | 'private' }) => void;
  loading: boolean;
}

function CreateChannelModal({ visible, onClose, onCreate, loading }: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'public' | 'private'>('public');

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a channel name');
      return;
    }
    onCreate({ name: name.trim(), description: description.trim(), type });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Channel</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Channel Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. career-advice"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="What's this channel about?"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeOption, type === 'public' && styles.typeOptionSelected]}
                onPress={() => setType('public')}
              >
                <Ionicons name="globe-outline" size={20} color={type === 'public' ? '#fff' : '#374151'} />
                <Text style={[styles.typeText, type === 'public' && styles.typeTextSelected]}>
                  Public
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeOption, type === 'private' && styles.typeOptionSelected]}
                onPress={() => setType('private')}
              >
                <Ionicons name="lock-closed-outline" size={20} color={type === 'private' ? '#fff' : '#374151'} />
                <Text style={[styles.typeText, type === 'private' && styles.typeTextSelected]}>
                  Private
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>Create Channel</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function ChannelsScreen() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showChannelList, setShowChannelList] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // Fetch channels
  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true);
      const response = await channelApi.getChannels();
      setChannels(response.data.data?.channels || []);
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch messages for selected channel
  const fetchMessages = useCallback(async (channelId: string) => {
    try {
      setMessagesLoading(true);
      const response = await channelApi.getMessages(channelId);
      setMessages(response.data.data?.messages || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  useEffect(() => {
    if (selectedChannel) {
      fetchMessages(selectedChannel.id);
    }
  }, [selectedChannel, fetchMessages]);

  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannel(channel);
    setShowChannelList(false);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChannel || sending) return;

    const content = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      const response = await channelApi.sendMessage(selectedChannel.id, content);
      if (response.data.data) {
        setMessages(prev => [...prev, response.data.data]);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessageText(content); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const handleCreateChannel = async (data: { name: string; description: string; type: 'public' | 'private' }) => {
    try {
      setCreating(true);
      const response = await channelApi.createChannel(data);
      if (response.data.data) {
        setChannels(prev => [response.data.data, ...prev]);
        setShowCreateModal(false);
        setSelectedChannel(response.data.data);
        setShowChannelList(false);
      }
    } catch (error) {
      console.error('Failed to create channel:', error);
      Alert.alert('Error', 'Failed to create channel. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const shouldShowAuthor = (message: ChannelMessage, index: number) => {
    if (index === 0) return true;
    const prevMessage = messages[index - 1];
    return prevMessage.authorId !== message.authorId;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  // Mobile layout: Show either channel list or chat
  if (showChannelList || !selectedChannel) {
    return (
      <View style={styles.container}>
        <View style={styles.channelListHeader}>
          <Text style={styles.headerTitle}>Channels</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={24} color="#6366f1" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={channels}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChannelItem
              channel={item}
              isSelected={selectedChannel?.id === item.id}
              onPress={() => handleSelectChannel(item)}
            />
          )}
          contentContainerStyle={styles.channelList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#9ca3af" />
              <Text style={styles.emptyText}>No channels yet</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Text style={styles.emptyButtonText}>Create your first channel</Text>
              </TouchableOpacity>
            </View>
          }
        />

        <CreateChannelModal
          visible={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateChannel}
          loading={creating}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Chat Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={() => setShowChannelList(true)}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderTitle}>#{selectedChannel.name}</Text>
          <Text style={styles.chatHeaderSubtitle}>
            {selectedChannel.memberCount} members
          </Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="ellipsis-vertical" size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {messagesLoading ? (
        <View style={styles.messagesLoading}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <MessageItem
              message={item}
              showAuthor={shouldShowAuthor(item, index)}
            />
          )}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.noMessages}>
              <Text style={styles.noMessagesText}>
                No messages yet. Start the conversation!
              </Text>
            </View>
          }
        />
      )}

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachButton}>
          <Ionicons name="attach" size={24} color="#6b7280" />
        </TouchableOpacity>
        <TextInput
          style={styles.messageInput}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message..."
          placeholderTextColor="#9ca3af"
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!messageText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  // Channel List
  channelListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  addButton: {
    padding: 8,
  },
  channelList: {
    paddingVertical: 8,
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  channelItemSelected: {
    backgroundColor: '#eef2ff',
  },
  channelIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    marginRight: 12,
  },
  channelHash: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  channelNameSelected: {
    color: '#6366f1',
  },
  lastMessage: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  unreadBadge: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Chat Header
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  chatHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  chatHeaderSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  // Messages
  messagesLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  messageItemOwn: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  messageBubbleOwn: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: '#f3f4f6',
    borderBottomLeftRadius: 4,
  },
  messageBubbleNoAvatar: {
    marginLeft: 44,
  },
  messageAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 16,
    color: '#111827',
  },
  messageTextOwn: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  noMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noMessagesText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  attachButton: {
    padding: 8,
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginHorizontal: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#c7d2fe',
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#6b7280',
    marginTop: 16,
  },
  emptyButton: {
    marginTop: 16,
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    gap: 8,
  },
  typeOptionSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  typeTextSelected: {
    color: '#fff',
  },
  createButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
