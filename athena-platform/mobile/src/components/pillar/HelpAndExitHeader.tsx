/**
 * The header a safety-adjacent screen carries: Emergency help, and beside it the
 * quick exit.
 *
 * The screens a woman is most likely to be reading with somebody behind her are
 * the wellness screens and the ones about her safety: Safety, which holds the
 * panic button, Help & Support, and her sign-in and devices. The quick exit was on
 * the wellness three and nowhere on the Safety screen, where the panic button
 * is. Each of these screens passes this as its `headerRight`.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { EmergencyHelpButton } from './EmergencyHelp';
import { QuickExitButton } from './QuickExit';

export function HelpAndExitHeaderRight() {
  return (
    <View style={styles.row}>
      <EmergencyHelpButton />
      <QuickExitButton />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
});
