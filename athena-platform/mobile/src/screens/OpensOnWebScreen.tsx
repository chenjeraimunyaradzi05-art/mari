/**
 * The "opens on the web" pattern, as one screen.
 *
 * A pillar that has no native screen yet is still a real destination on the
 * phone: this says, in a sentence, what lives there and what the app cannot
 * do about it yet, then opens the web page. It is the pattern UpgradeScreen
 * uses for billing, lifted out so nothing in More is a dead tap.
 *
 * `opensOnWeb(...)` makes a placeholder component for a route that is being
 * built natively: register it in AppNavigator under the final route name, and
 * the real screen replaces the import when it lands.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { webUrl } from '../services/api';

export interface OpensOnWebProps {
  title: string;
  /** One warm sentence about what this is for. */
  blurb: string;
  /** The web path, e.g. "/wellness". */
  path: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** What the button says. */
  action?: string;
}

/** Opens a page of the web app in the phone's browser. */
export function openOnWeb(path: string): Promise<void> {
  return Linking.openURL(webUrl(path)).then(() => undefined);
}

export function OpensOnWebScreen({ title, blurb, path, icon = 'globe-outline', action }: OpensOnWebProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={28} color="#4338ca" />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.blurb}>{blurb}</Text>
        <Text style={styles.note}>This part of ATHENA opens on the web for now. You will be signed in there with the same account.</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => openOnWeb(path)}
          accessibilityRole="button"
          accessibilityLabel={`${action ?? `Open ${title}`} on the web`}
        >
          <Ionicons name="open-outline" size={18} color="#fff" />
          <Text style={styles.buttonText}>{action ?? `Open ${title} on the web`}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** A route component that renders the pattern with fixed copy. */
export function opensOnWeb(props: OpensOnWebProps): () => React.JSX.Element {
  return function OpensOnWebPlaceholder() {
    return <OpensOnWebScreen {...props} />;
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20, justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center' },
  iconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center' },
  blurb: { marginTop: 8, fontSize: 15, color: '#374151', textAlign: 'center', lineHeight: 22 },
  note: { marginTop: 14, fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 19 },
  button: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
