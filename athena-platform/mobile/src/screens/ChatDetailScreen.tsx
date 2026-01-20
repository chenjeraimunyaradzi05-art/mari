import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { messagesApi } from '../services/api';
import { queueOfflineAction } from '../services/offlineSync';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatDetail'>;

interface MessageItem {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export function ChatDetailScreen({ route }: Props) {
  const { conversationId, participantName } = route.params;
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<FlatList<MessageItem>>(null);

  const loadMessages = async () => {
    const response = await messagesApi.getMessages(conversationId);
    setMessages(response.data?.data || response.data?.messages || []);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setIsSending(true);
    try {
      const response = await messagesApi.send(conversationId, newMessage.trim());
      const message = response.data?.data || response.data?.message;
      setMessages((prev) => [...prev, message]);
      setNewMessage('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (error) {
      await queueOfflineAction({
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        type: 'api',
        payload: { method: 'post', url: `/messages/conversations/${conversationId}`, data: { content: newMessage.trim() } },
      });
      setNewMessage('');
    } finally {
      setIsSending(false);
    }
  };

  const renderItem = ({ item }: { item: MessageItem }) => {
    const isMe = item.senderId === 'me';
    return (
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.content}</Text>
        <Text style={styles.timestamp}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{participantName}</Text>
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type a message"
          value={newMessage}
          onChangeText={setNewMessage}
        />
        <TouchableOpacity
          style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={isSending}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  listContent: { padding: 16, gap: 12 },
  bubble: {
    maxWidth: '78%',
    padding: 12,
    borderRadius: 16,
  },
  bubbleMe: {
    backgroundColor: '#6366f1',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, color: '#111827' },
  bubbleTextMe: { color: '#fff' },
  timestamp: { marginTop: 6, fontSize: 10, color: '#9ca3af' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: '#6366f1',
    padding: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: { opacity: 0.6 },
});
