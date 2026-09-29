/**
 * Help & Support. Feedback is sent from here, to the same inbox the web
 * help centre's form uses (POST /feedback), with her account attached so the
 * team can reply. The help articles and the contact form live on the web;
 * each of those rows opens the matching page and says so first.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { openOnWeb } from './OpensOnWebScreen';
import { feedbackApi, type FeedbackCategory } from '../services/api';
import { apiMessage } from '../utils/apiErrors';
import { Chips, PrimaryButton, TextField } from '../components/pillar/PillarUi';

// The sections client/src/app/help/page.tsx lists, so every row is a page
// that exists.
const TOPICS: Array<{ label: string; path: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { label: 'Getting started', path: '/help/getting-started', icon: 'rocket-outline' },
  { label: 'Safety centre', path: '/help/safety-center', icon: 'shield-checkmark-outline' },
  { label: 'Community guidelines', path: '/help/community-guidelines', icon: 'people-outline' },
  { label: 'Privacy centre', path: '/privacy-center', icon: 'lock-closed-outline' },
];

const CATEGORIES: ReadonlyArray<{ value: FeedbackCategory; label: string }> = [
  { value: 'BUG', label: 'Something is broken' },
  { value: 'IDEA', label: 'An idea' },
  { value: 'PRAISE', label: 'Something I love' },
  { value: 'OTHER', label: 'Something else' },
];

/** The server's own floor, said before she sends rather than after. */
const MIN_LENGTH = 10;

export function HelpSupportScreen() {
  const [category, setCategory] = useState<FeedbackCategory>('IDEA');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (message.trim().length < MIN_LENGTH) {
      setError('Say a little more: at least ten characters.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await feedbackApi.send({ message: message.trim(), category, page: 'mobile:help' });
      setSent(true);
      setMessage('');
    } catch (err) {
      setError(apiMessage(err, 'Your feedback did not send. Check your connection and try again; nothing you wrote has been lost.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Help & Support</Text>
      <Text style={styles.subtitle}>Tell us what is working and what is not, or find an answer in the help centre.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Send feedback</Text>
        {sent ? (
          <>
            <Text style={styles.body}>Thank you. It has reached the ATHENA team, with your account attached so they can reply.</Text>
            <TouchableOpacity onPress={() => setSent(false)} accessibilityRole="button">
              <Text style={styles.link}>Send something else</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Chips options={CATEGORIES} value={category} onChange={setCategory} />
            <TextField label="What would you like us to know?" value={message} onChangeText={setMessage} multiline maxLength={4000} placeholder="What happened, or what would help" />
            <PrimaryButton label="Send" icon="send-outline" onPress={() => void send()} busy={sending} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Help centre</Text>
        {TOPICS.map((topic) => (
          <TouchableOpacity
            key={topic.path}
            style={styles.listItem}
            onPress={() => openOnWeb(topic.path)}
            accessibilityRole="link"
            accessibilityLabel={`${topic.label}, opens on the web`}
          >
            <Ionicons name={topic.icon} size={18} color="#6366f1" />
            <Text style={styles.listText}>{topic.label}</Text>
            <Ionicons name="open-outline" size={16} color="#c4c4c4" />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => openOnWeb('/contact')}
        accessibilityRole="link"
        accessibilityLabel="Contact support, opens on the web"
      >
        <Ionicons name="mail-outline" size={18} color="#fff" />
        <Text style={styles.primaryButtonText}>Contact support</Text>
      </TouchableOpacity>
      <Text style={styles.footnote}>The contact form opens on the web; sign in with the same account if it asks.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  card: {
    marginTop: 16,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  link: {
    marginTop: 10,
    color: '#4338ca',
    fontWeight: '600',
  },
  error: {
    marginTop: 10,
    color: '#b91c1c',
    fontSize: 13,
    lineHeight: 19,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  footnote: {
    marginTop: 8,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
