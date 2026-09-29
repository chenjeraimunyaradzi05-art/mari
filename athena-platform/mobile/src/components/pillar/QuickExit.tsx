/**
 * Quick exit, on the phone.
 *
 * The web app carries a quick-exit button on every wellness and safety page,
 * because those are the pages a woman is most likely to be reading when
 * someone walks in behind her. The wellness pillar here used to be a card
 * that opened the website; now that it is native, it needs the same way off
 * the screen.
 *
 * On a phone "leaving" is two things at once. The app's own history is reset
 * to the feed, so reopening ATHENA, or anyone pressing back, lands on
 * something ordinary rather than a check-in or the crisis lines. And the
 * phone switches to the browser at a harmless page: the address she chose in
 * her safety settings, or a search engine. The address is read from her
 * settings once and kept for a few minutes; if it cannot be read the default
 * is used, because the button has to work on a bad signal above all.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { safetyApi, unwrapApiData, type SafetySettings } from '../../services/api';

/** The same default the web uses: a search engine is unremarkable on any screen. */
export const DEFAULT_EXIT_URL = 'https://www.google.com';

const CACHE_MS = 5 * 60 * 1000;
let cached: { url: string; at: number } | null = null;

/** Her chosen address, or the default. Never rejects. */
export async function exitAddress(): Promise<string> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.url;
  try {
    const response = await safetyApi.settings();
    const chosen = unwrapApiData<Partial<SafetySettings>>(response.data)?.safeExitUrl;
    const url = typeof chosen === 'string' && /^https?:\/\//i.test(chosen.trim()) ? chosen.trim() : DEFAULT_EXIT_URL;
    cached = { url, at: Date.now() };
    return url;
  } catch {
    // Not cached: the next screen asks again. Until it gets an answer the
    // default is the address, which is a harmless page either way.
    return DEFAULT_EXIT_URL;
  }
}

/** For tests: forget the address read from her settings. */
export function forgetExitAddress(): void {
  cached = null;
}

export function useQuickExit(): () => void {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [url, setUrl] = useState(cached?.url ?? DEFAULT_EXIT_URL);

  useEffect(() => {
    let live = true;
    void exitAddress().then((address) => {
      if (live) setUrl(address);
    });
    return () => {
      live = false;
    };
  }, []);

  return useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    void Linking.openURL(url);
  }, [navigation, url]);
}

/** The header button. Worded plainly; it is not hidden, and it is not labelled "panic". */
export function QuickExitButton() {
  const exit = useQuickExit();
  return (
    <TouchableOpacity style={styles.button} onPress={exit} accessibilityRole="button" accessibilityLabel="Quick exit" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name="exit-outline" size={18} color="#fff" />
      <Text style={styles.text}>Exit</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Filled, so it reads on the plain white stack header these screens use.
  button: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#e11d48' },
  text: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
