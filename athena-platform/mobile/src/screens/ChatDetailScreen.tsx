import React, { useEffect, useState, useRef } from 'react';
import {
  Alert,
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
import { memberSafetyApi, messagesApi, unwrapApiData } from '../services/api';
import { ReportSheet } from '../components/ReportSheet';
import { EmergencyHelpButton } from '../components/pillar/EmergencyHelp';
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

export function ChatDetailScreen({ route, navigation }: Props) {
  const { conversationId, participantName, participantId, isRequest } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  // A request is waiting on her answer until she accepts, declines, or replies
  // (replying accepts it, on the server too).
  const [requestOpen, setRequestOpen] = useState(Boolean(isRequest));
  const [deciding, setDeciding] = useState(false);
  // What the report sheet is open on: one message, or the member herself.
  const [reporting, setReporting] = useState<{ type: 'message' | 'user'; id: string; title: string } | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const listRef = useRef<FlatList<MessageItem>>(null);

  const name = participantName || 'this member';
  // The thread knows who the other person is by who wrote to her; a thread
  // opened from the list carries the id as well.
  const counterpartId = participantId || messages.find((m) => m.senderId && m.senderId !== user?.id)?.senderId;

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

  const decideRequest = async (accept: boolean) => {
    setDeciding(true);
    try {
      if (accept) {
        await messagesApi.acceptRequest(conversationId);
        setRequestOpen(false);
      } else {
        await messagesApi.declineRequest(conversationId);
        navigation.goBack();
      }
    } catch (error: any) {
      setSendError(error?.response?.data?.message || 'That could not be done. Please try again.');
    } finally {
      setDeciding(false);
    }
  };

  const confirmDecline = () =>
    Alert.alert(
      `Decline ${name}'s request?`,
      'They cannot message you again unless you message them first.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: () => void decideRequest(false) },
      ]
    );

  const submitReport = async (reason: string) => {
    if (!reporting) return;
    setReportBusy(true);
    setReportError(null);
    try {
      await memberSafetyApi.report({ targetType: reporting.type, targetId: reporting.id, reason });
      setReporting(null);
      Alert.alert('Thank you', 'Our safety team will take a look.');
    } catch (error: any) {
      setReportError(error?.response?.data?.message || 'The report could not be sent. Check your connection and try again.');
    } finally {
      setReportBusy(false);
    }
  };

  const openReport = (target: { type: 'message' | 'user'; id: string; title: string }) => {
    setReportError(null);
    setReporting(target);
  };

  const blockMember = async () => {
    if (!counterpartId) return;
    try {
      await memberSafetyApi.block(counterpartId);
      Alert.alert(`${name} is blocked`, 'You can undo this on the website, in Settings under Privacy.');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Could not block', error?.response?.data?.message || 'Please try again.');
    }
  };

  // Report and block are one tap from the thread, behind a menu rather than on
  // the screen, so they are not pressed by mistake.
  const openMenu = () =>
    Alert.alert(name, undefined, [
      {
        text: `Report ${name}`,
        onPress: () => counterpartId && openReport({ type: 'user', id: counterpartId, title: `Report ${name}` }),
      },
      {
        text: `Block ${name}`,
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            `Block ${name}?`,
            "They will not be able to message you, and you will not see each other's posts. You can undo this on the website, in Settings under Privacy.",
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Block', style: 'destructive', onPress: () => void blockMember() },
            ]
          ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setIsSending(true);
    setSendError(null);
    try {
      const response = await messagesApi.send(conversationId, newMessage.trim());
      const message = response.data?.data || response.data?.message;
      setMessages((prev) => [...prev, message]);
      setNewMessage('');
      // Answering a request is accepting it, which the server does in the same write.
      setRequestOpen(false);
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
    // Pressing and holding what someone else said offers to report it. Her own
    // words have nothing to report.
    const reportable = !isMe && Boolean(item.id) && !(item as { deletedAt?: string | null }).deletedAt;
    return (
      <TouchableOpacity
        activeOpacity={reportable ? 0.7 : 1}
        onLongPress={reportable ? () => openReport({ type: 'message', id: item.id, title: 'Report this message' }) : undefined}
        accessibilityRole={reportable ? 'button' : undefined}
        accessibilityLabel={reportable ? `Message from ${name}: ${item.content}. Press and hold to report.` : undefined}
        accessibilityHint={reportable ? 'Opens a list of reasons to report this message' : undefined}
        style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}
      >
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.content}</Text>
        <Text style={styles.timestamp}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
      </TouchableOpacity>
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
        {/* This thread draws its own header, so the button the other screens get from
            the navigator is mounted here: it is the screen she may be on when it is
            needed. */}
        <EmergencyHelpButton />
        {counterpartId ? (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={openMenu}
            accessibilityRole="button"
            accessibilityLabel={`More options for ${name}`}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color="#4b5563" />
          </TouchableOpacity>
        ) : null}
      </View>
      {requestOpen ? (
        <View style={styles.requestBanner}>
          <Text style={styles.requestText}>
            {name} wants to message you. They can send a few messages until you accept, and cannot see when you read them.
          </Text>
          <View style={styles.requestButtons}>
            <TouchableOpacity
              style={[styles.requestButton, styles.requestAccept]}
              onPress={() => void decideRequest(true)}
              disabled={deciding}
              accessibilityRole="button"
              accessibilityLabel="Accept message request"
            >
              <Text style={styles.requestAcceptText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.requestButton, styles.requestDecline]}
              onPress={confirmDecline}
              disabled={deciding}
              accessibilityRole="button"
              accessibilityLabel="Decline message request"
            >
              <Text style={styles.requestDeclineText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
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
      <ReportSheet
        visible={reporting !== null}
        title={reporting?.title ?? 'Report'}
        note={
          reporting?.type === 'message'
            ? 'We keep a copy of this message and the few before it, so our team can see what happened even if it is deleted. Only our safety team sees them.'
            : 'Reports are private.'
        }
        busy={reportBusy}
        error={reportError}
        onPick={(reason) => void submitReport(reason)}
        onClose={() => setReporting(null)}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 16, fontWeight: '600', flex: 1 },
  menuButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8, marginLeft: 8 },
  requestBanner: { padding: 12, backgroundColor: '#eef2ff', borderBottomWidth: 1, borderBottomColor: '#e0e7ff' },
  requestText: { fontSize: 13, color: '#312e81' },
  requestButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  requestButton: { minHeight: 44, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  requestAccept: { backgroundColor: '#6366f1' },
  requestAcceptText: { color: '#fff', fontWeight: '600' },
  requestDecline: { borderWidth: 1, borderColor: '#c7d2fe', backgroundColor: '#fff' },
  requestDeclineText: { color: '#4338ca', fontWeight: '600' },
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
