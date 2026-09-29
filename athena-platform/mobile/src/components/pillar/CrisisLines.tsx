/**
 * The crisis lines, one tap from a call.
 *
 * The list comes from the server's wellness library (GET /wellness/reference),
 * which is dated and maintained in one place for the web and the phone. If it
 * cannot be read, these screens still show the three numbers that do not
 * change and are answered around the clock, because a member who opened the
 * wellness pillar at 2am on a bad signal is exactly the member who must not be
 * shown an empty box. The fallback says it is the short list, so it is never
 * mistaken for the whole of the help there is.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours } from './PillarUi';
import type { CrisisLine } from '../../services/wellness';

/** Always answered, 24 hours: emergency, crisis support, and domestic, family and sexual violence. */
export const ALWAYS_ANSWERED: CrisisLine[] = [
  { key: 'emergency', name: 'Emergency', phone: '000', url: 'https://www.triplezero.gov.au', when: '24/7', who: 'If someone is in immediate danger' },
  { key: 'lifeline', name: 'Lifeline', phone: '13 11 14', url: 'https://www.lifeline.org.au', when: '24/7', who: 'Anyone in crisis or thinking about suicide' },
  { key: '1800respect', name: '1800RESPECT', phone: '1800 737 732', url: 'https://www.1800respect.org.au', when: '24/7', who: 'Domestic, family and sexual violence' },
];

export function callLine(phone: string): void {
  void Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
}

export function CrisisLines({ lines, title = 'If today is hard', limit = 6, fallbackNote = true }: { lines: CrisisLine[] | null | undefined; title?: string; limit?: number; fallbackNote?: boolean }) {
  const usingFallback = !lines || lines.length === 0;
  const shown = (usingFallback ? ALWAYS_ANSWERED : lines).slice(0, limit);
  return (
    <View style={styles.box} accessibilityRole="summary" accessibilityLabel="Crisis support lines">
      <View style={styles.header}>
        <Ionicons name="call-outline" size={18} color={colours.roseDeep} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {shown.map((line) => (
        <TouchableOpacity
          key={line.key}
          style={styles.line}
          onPress={() => callLine(line.phone)}
          accessibilityRole="button"
          accessibilityLabel={`Call ${line.name} on ${line.phone}`}
        >
          <View style={styles.lineText}>
            <Text style={styles.name}>
              {line.name} <Text style={styles.phone}>{line.phone}</Text>
            </Text>
            <Text style={styles.who}>
              {line.who}
              {line.when ? ` · ${line.when}` : ''}
            </Text>
          </View>
          <Ionicons name="call" size={16} color={colours.rose} />
        </TouchableOpacity>
      ))}
      <Text style={styles.foot}>
        {usingFallback && fallbackNote
          ? 'The full list of support lines could not be loaded just now; these three are always answered. If someone is in immediate danger, call 000.'
          : 'Free, confidential, and staffed now. If someone is in immediate danger, call 000.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colours.roseSoft, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colours.roseLine },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontWeight: '700', color: colours.roseDeep, fontSize: 15 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#ffe4e6' },
  lineText: { flex: 1 },
  name: { color: colours.ink, fontWeight: '600', fontSize: 14 },
  phone: { color: colours.roseDeep, fontWeight: '700' },
  who: { color: colours.muted, fontSize: 12, marginTop: 2 },
  foot: { color: colours.roseDeep, fontSize: 12, marginTop: 8, lineHeight: 17 },
});
