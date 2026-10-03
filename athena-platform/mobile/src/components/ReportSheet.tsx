/**
 * A list of reasons for a report, over the screen she is on.
 *
 * Reporting from a message thread used to be impossible on the phone: the
 * server could take a report and nothing in the app could send one. This is the
 * smallest thing that lets her do it where it is happening. Choosing a reason
 * sends the report, so it asks nothing else of her, and it says what is kept.
 */
import React from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const REPORT_REASONS: Array<{ value: string; label: string }> = [
  { value: 'harassment', label: 'Harassment or bullying' },
  // Named, as on the web, so that she does not have to guess which of the others
  // an intimate image of her, or a threat, comes under. The server files both as
  // critical, on the 24-hour clock, and a person is asked to open them within hours.
  { value: 'intimate_image', label: 'An intimate image shared without consent' },
  { value: 'threat', label: 'A threat to hurt someone' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'sexual', label: 'Sexual or explicit content' },
  { value: 'hate', label: 'Hate or discrimination' },
  { value: 'spam', label: 'Spam or misleading' },
  { value: 'impersonation', label: 'Impersonation or a fake account' },
  { value: 'other', label: 'Something else' },
];

interface ReportSheetProps {
  visible: boolean;
  title: string;
  /** Said under the title, so she knows who sees what she reports. */
  note?: string;
  busy?: boolean;
  /** Why the last attempt did not go through, if it did not. */
  error?: string | null;
  onPick: (reason: string) => void;
  onClose: () => void;
}

export function ReportSheet({ visible, title, note, busy, error, onPick, onClose }: ReportSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {note ? <Text style={styles.note}>{note}</Text> : null}
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <ScrollView>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.value}
                style={styles.reason}
                onPress={() => onPick(reason.value)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={reason.label}
              >
                <Text style={styles.reasonText}>{reason.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {busy ? <ActivityIndicator color="#6366f1" style={styles.busy} /> : null}
          <TouchableOpacity style={styles.cancel} onPress={onClose} disabled={busy} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  note: { marginTop: 6, marginBottom: 8, fontSize: 13, color: '#4b5563' },
  error: { marginBottom: 8, fontSize: 13, color: '#b91c1c' },
  reason: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  reasonText: { fontSize: 15, color: '#111827' },
  busy: { marginTop: 8 },
  cancel: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#6366f1' },
});
