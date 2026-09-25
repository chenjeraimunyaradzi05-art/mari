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
import { messagesApi, unwrapApiData } from '../services/api';
import { queueOfflineAction } from '../services/offlineSync';
import { socketService } from '../services/socket';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatDetail'>;

interface MessageItem {
  id: string;
  senderId: string;
  conversationId?: string;
  content: string;
  createdAt: string;
}

export function ChatDetailScreen({ route }: Props) {
  const { conversationId, participantName } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<FlatList<MessageItem>>(null);

  const loadMessages = async () => {
    try {
      const response = await messagesApi.getMessages(conversationId);
      const thread = unwrapApiData<MessageItem[]>(response.data);
      setMessages(Array.isArray(thread) ? thread : []);
      setLoadError(null);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (error: any) {
      // Left unhandled this rejected into nothing and the thread simply stayed
      // empty, which reads as "no messages" rather than "not loaded".
      setLoadError(error?.response?.data?.message || 'This conversation could not be loaded. Check your connection and try again.');
    }
  };

  useEffect(() => {
    void loadMessages();
  }, [conversationId]);

  // Live arrivals. The server emits 'messages:new' to the recipient's own
  // room, so a message reaches this screen whether or not it is in the
  // conversation room; the id check keeps a message meant for another thread
  // out, and the de-duplication covers the message arriving twice when the
  // room and the personal room both deliver it.
  useEffect(() => {
    return socketService.on<MessageItem>('messages:new', (message) => {
      if (!message?.id || message.conversationId !== conversationId) return;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    });
  }, [conversationId]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setIsSending(true);
    setSendError(null);
    try {
      const response = await messagesApi.send(conversationId, newMessage.trim());
      const message = response.data?.data || response.data?.message;
      setMessages((prev) => [...prev, message]);
      setNewMessage('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (error: any) {
      // Only a send that never reached the server belongs in the offline
      // queue. A send the server answered — she is blocked, the conversation
      // is closed, the text was refused — is not going to come good on a
      // reconnection, and queueing it meant replaying the same refusal on
      // every reconnection for the life of the install.
      //
      // The queued path is the same one messagesApi.send uses. It used to be
      // POST /messages/conversations/<id>, which the server has never served:
      // the message went into the queue, 404ed on every retry and was kept
      // because it had failed, so nothing she wrote offline was ever
      // delivered and the queue only grew.
      if (error?.response) {
        setSendError(
          error.response.data?.message || 'That message could not be sent. It has not been saved — please try again.'
        );
        return;
      }
      await queueOfflineAction({
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        type: 'api',
        payload: {
          method: 'post',
          url: `/messages/conversations/${conversationId}/messages`,
          data: { content: newMessage.trim() },
        },
      });
      setSendError('You are offline. This message will be sent when you are back on the network.');
      setNewMessage('');
    } finally {
      setIsSending(false);
    }
  };

  const renderItem = ({ item }: { item: MessageItem }) => {
    // The sender id is compared against the signed-in member. It used to be
    // compared against the literal string 'me', which no message has ever
    // carried, so every message she sent was drawn as though it had come from
    // the other person.
    const isMe = Boolean(user?.id) && item.senderId === user?.id;
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
        ListEmptyComponent={loadError ? <Text style={styles.loadError}>{loadError}</Text> : null}
      />
      {sendError ? <Text style={styles.sendError}>{sendError}</Text> : null}
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
          accessibilityRole="button"
          // The button is an icon and nothing else, so without this a screen
          // reader announced it as an unlabelled button — the one control on
          // the thread that actually sends the message.
          accessibilityLabel="Send message"
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
  loadError: { color: '#b45309', fontSize: 13, textAlign: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  sendError: { color: '#b45309', fontSize: 12, paddingHorizontal: 16, paddingBottom: 6 },
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
