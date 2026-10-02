/**
 * Emergency help, on the phone: a labelled button in the header of every screen,
 * opening the numbers to ring and a way off the screen.
 *
 * The crisis lines were on the wellness screens and in Help & Support, which is
 * three taps down from More; the quick exit was on the three wellness headers
 * and nowhere else. A woman who needed either from the screen she was already on
 * had to know where they lived. This is the button that is always there.
 *
 * What it holds to, as on the web:
 *   - It asks nobody. The lines are in the code (CrisisLines.ALWAYS_ANSWERED), so
 *     it opens at once on a bad signal, with the API down, or while the screen
 *     under it is still loading. Only the quick exit reads her settings, and it
 *     falls back to a search engine when they cannot be read.
 *   - It is a button with a word on it, not a gesture and not a hidden corner. The
 *     word is "Help", with "Emergency help" read out by a screen reader; not
 *     "panic", which someone looking over her shoulder would understand.
 *   - It does not promise what it cannot do. ATHENA cannot send anyone; the sheet
 *     says so and says to ring 000.
 *
 * BEFORE LAUNCH, as for the numbers it shows: check them against the services'
 * own published numbers (see client/src/lib/crisis-lines.ts).
 */
import React, { useCallback, useState } from 'react';
import { Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { webUrl } from '../../services/api';
import { ALWAYS_ANSWERED, callLine } from './CrisisLines';
import { useQuickExit } from './QuickExit';
import { colours } from './PillarUi';

/** The emergency numbers of the places her phone may be in when she is not in Australia. */
export const ELSEWHERE_NOTE =
  'Not in Australia? Emergency numbers: New Zealand 111, United Kingdom 999, United States 911, European Union 112.';

/** The sheet's own quick exit, so her settings are asked for only while it is open. */
function SheetQuickExit({ onLeave }: { onLeave: () => void }) {
  const exit = useQuickExit();
  return (
    <TouchableOpacity
      style={styles.exit}
      onPress={() => {
        onLeave();
        exit();
      }}
      accessibilityRole="button"
      accessibilityLabel="Quick exit"
    >
      <Ionicons name="exit-outline" size={20} color="#fff" />
      <Text style={styles.exitText}>Quick exit</Text>
    </TouchableOpacity>
  );
}

function EmergencySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} accessibilityViewIsModal>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityLabel="Emergency help">
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.titleRow}>
              <Text style={styles.title} accessibilityRole="header">
                Emergency help
              </Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.close}
                accessibilityRole="button"
                accessibilityLabel="Close emergency help"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={colours.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.lead}>
              If you are in danger now, call the emergency number first. ATHENA cannot send anyone to you; these are lines run by other services, answered by people.
            </Text>

            {ALWAYS_ANSWERED.map((line) => (
              <TouchableOpacity
                key={line.key}
                style={styles.line}
                onPress={() => callLine(line.phone)}
                accessibilityRole="button"
                accessibilityLabel={`Call ${line.name} on ${line.phone}`}
              >
                <Ionicons name="call" size={20} color={colours.rose} />
                <View style={styles.lineText}>
                  <Text style={styles.lineName}>
                    {line.name} <Text style={styles.linePhone}>{line.phone}</Text>
                  </Text>
                  <Text style={styles.lineWho}>{line.who}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <Text style={styles.elsewhere}>{ELSEWHERE_NOTE}</Text>

            <SheetQuickExit onLeave={onClose} />
            <Text style={styles.exitNote}>Leaves ATHENA at once, for a page that looks ordinary.</Text>

            <View style={styles.links}>
              <TouchableOpacity
                style={styles.link}
                onPress={() => {
                  onClose();
                  void Linking.openURL(webUrl('/report'));
                }}
                accessibilityRole="button"
                accessibilityLabel="Report something on ATHENA"
                accessibilityHint="Opens the report form in your browser"
              >
                <Ionicons name="flag-outline" size={18} color={colours.body} />
                <Text style={styles.linkText}>Report something</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.link}
                onPress={() => {
                  onClose();
                  navigation.navigate('Safety');
                }}
                accessibilityRole="button"
                accessibilityLabel="Safety centre"
              >
                <Ionicons name="shield-checkmark-outline" size={18} color={colours.body} />
                <Text style={styles.linkText}>Safety centre</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/**
 * The header button, and the sheet it opens. Drop it in a header, or in a
 * custom header row; it needs to be inside a screen so that the quick exit and
 * the Safety link can reach the navigator.
 */
export function EmergencyHelpButton() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Emergency help"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="help-buoy-outline" size={18} color={colours.roseDeep} />
        <Text style={styles.buttonText}>Help</Text>
      </TouchableOpacity>
      {open && <EmergencySheet visible onClose={close} />}
    </>
  );
}

const styles = StyleSheet.create({
  // Light, so it reads on the indigo tab headers, the white stack headers and the
  // dark video feed alike, and sits beside the filled rose quick exit.
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colours.roseLine,
  },
  buttonText: { color: colours.roseDeep, fontWeight: '700', fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '90%' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700', color: colours.ink },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  lead: { color: colours.body, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 12 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: colours.roseSoft,
    borderWidth: 1,
    borderColor: colours.roseLine,
  },
  lineText: { flex: 1 },
  lineName: { color: colours.ink, fontWeight: '600', fontSize: 15 },
  linePhone: { color: colours.roseDeep, fontWeight: '700' },
  lineWho: { color: colours.muted, fontSize: 12, marginTop: 2 },
  elsewhere: { color: colours.muted, fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 14 },
  exit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colours.rose,
  },
  exitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  exitNote: { color: colours.muted, fontSize: 12, marginTop: 4 },
  links: { flexDirection: 'row', gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colours.line },
  link: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  linkText: { color: colours.body, fontWeight: '600', fontSize: 14 },
});
