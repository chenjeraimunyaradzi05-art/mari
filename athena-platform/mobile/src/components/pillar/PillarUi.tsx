/**
 * The small pieces the pillar screens (wellness, cars, the money plans,
 * finance, formation) are built from.
 *
 * Those screens replaced a single "opens on the web" card each, and the
 * failure the audit kept finding in the rest of this app was a load that
 * failed and then rendered as an answer: an empty list that said "nothing
 * yet", a missing figure printed as $0. So the loading and failure states are
 * components here, written once, and a screen reaches for `LoadError` rather
 * than an empty state whenever it does not actually know. A failure always
 * names what did not load and always offers to try again.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { openOnWeb } from '../../screens/OpensOnWebScreen';

export const colours = {
  ink: '#1f2937',
  body: '#374151',
  muted: '#6b7280',
  faint: '#9ca3af',
  line: '#f0f0f0',
  page: '#f7f5f8',
  card: '#ffffff',
  primary: '#6366f1',
  primaryDeep: '#4338ca',
  primarySoft: '#eef2ff',
  rose: '#e11d48',
  roseDeep: '#9f1239',
  roseSoft: '#fff1f2',
  roseLine: '#fecdd3',
  good: '#047857',
  goodSoft: '#ecfdf5',
  warn: '#92400e',
  warnSoft: '#fffbeb',
  warnLine: '#fcd34d',
  bad: '#b91c1c',
  badSoft: '#fef2f2',
} as const;

type Tone = 'plain' | 'rose' | 'good' | 'warn' | 'indigo';

const toneStyle: Record<Tone, { backgroundColor: string; borderColor: string }> = {
  plain: { backgroundColor: colours.card, borderColor: colours.card },
  rose: { backgroundColor: colours.roseSoft, borderColor: colours.roseLine },
  good: { backgroundColor: colours.goodSoft, borderColor: '#a7f3d0' },
  warn: { backgroundColor: colours.warnSoft, borderColor: colours.warnLine },
  indigo: { backgroundColor: colours.primarySoft, borderColor: '#c7d2fe' },
};

export function Loading({ label }: { label: string }) {
  return (
    <View style={styles.loading} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colours.primary} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

/**
 * A load that did not work. Never an empty state: it says what could not be
 * read and offers to read it again.
 */
export function LoadError({ message, onRetry, title = 'That did not load' }: { message: string; onRetry: () => void; title?: string }) {
  return (
    <View style={[styles.card, toneStyle.warn, styles.bordered]} accessibilityLiveRegion="polite">
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorBody}>{message}</Text>
      <TouchableOpacity style={styles.retry} onPress={onRetry} accessibilityRole="button">
        <Ionicons name="refresh" size={16} color="#fff" />
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

export function Card({ title, subtitle, children, tone = 'plain', style }: { title?: string; subtitle?: string; children?: React.ReactNode; tone?: Tone; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, toneStyle[tone], tone !== 'plain' && styles.bordered, style]}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

/** A labelled figure. `big` is for the one number a screen is about. */
export function Stat({ label, value, sub, big = false }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, big && styles.statValueBig]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

/** A label and a value on one line, for the key facts of a car or a plan. */
export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function Notes({ notes }: { notes: string[] | null | undefined }) {
  const list = (notes ?? []).filter((n) => typeof n === 'string' && n.trim());
  if (list.length === 0) return null;
  return (
    <View style={styles.notes}>
      {list.map((note, index) => (
        <View key={`${index}-${note.slice(0, 12)}`} style={styles.noteRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.noteText}>{note}</Text>
        </View>
      ))}
    </View>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Body({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function PrimaryButton({ label, onPress, disabled = false, busy = false, tone = 'indigo', icon }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; tone?: 'indigo' | 'rose'; icon?: keyof typeof Ionicons.glyphMap }) {
  const off = disabled || busy;
  return (
    <TouchableOpacity
      style={[styles.primary, tone === 'rose' && styles.primaryRose, off && styles.disabled]}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
    >
      {busy ? <ActivityIndicator color="#fff" size="small" /> : icon ? <Ionicons name={icon} size={18} color="#fff" /> : null}
      <Text style={styles.primaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity style={[styles.secondary, disabled && styles.disabled]} onPress={onPress} disabled={disabled} accessibilityRole="button">
      <Text style={styles.secondaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

/** A row that goes to another screen in the app. */
export function NavRow({ icon, label, hint, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; hint?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.navRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.navIcon}>
        <Ionicons name={icon} size={18} color={colours.primaryDeep} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.navLabel}>{label}</Text>
        {hint ? <Text style={styles.navHint}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#c4c4c4" />
    </TouchableOpacity>
  );
}

/**
 * A row for something that is done on the web, and says so before it is
 * tapped. The phone's browser is not signed in to ATHENA just because the app
 * is, so the caption never promises that it will be.
 */
export function WebRow({ icon = 'open-outline', label, hint, path }: { icon?: keyof typeof Ionicons.glyphMap; label: string; hint?: string; path: string }) {
  return (
    <TouchableOpacity style={styles.navRow} onPress={() => void openOnWeb(path)} accessibilityRole="link" accessibilityLabel={`${label}, opens on the web`}>
      <View style={styles.navIcon}>
        <Ionicons name={icon} size={18} color={colours.primaryDeep} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.navLabel}>{label}</Text>
        {hint ? <Text style={styles.navHint}>{hint}</Text> : null}
        <Text style={styles.webNote}>Opens on the web</Text>
      </View>
      <Ionicons name="open-outline" size={18} color="#c4c4c4" />
    </TouchableOpacity>
  );
}

/** Pick one of a few. Chips wrap, so a long list still fits a phone. */
export function Chips<T extends string>({ options, value, onChange, label }: { options: ReadonlyArray<{ value: T; label: string }>; value: T | null; onChange: (value: T) => void; label?: string }) {
  return (
    <View>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <TouchableOpacity
              key={o.value}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={o.label}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/**
 * One to five, with the word for the step she picked shown beside the label,
 * so "2" on the stress scale reads as "A little" and not as a grade.
 */
export function ScaleInput({ label, words, value, onChange }: { label: string; words: string[]; value: number | null; onChange: (value: number) => void }) {
  return (
    <View style={styles.field}>
      <View style={styles.scaleHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.scaleWord}>{value === null ? 'Tap one' : words[value - 1] ?? String(value)}</Text>
      </View>
      <View style={styles.scale} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {[1, 2, 3, 4, 5].map((step) => {
          const on = value === step;
          return (
            <TouchableOpacity
              key={step}
              style={[styles.scaleStep, on && styles.scaleStepOn]}
              onPress={() => onChange(step)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${label}: ${words[step - 1] ?? step}`}
            >
              <Text style={[styles.scaleText, on && styles.scaleTextOn]}>{step}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/** A number typed as text. The screen parses it; an empty field is "not given", never zero. */
export function NumberField({ label, value, onChangeText, prefix, suffix, hint, placeholder }: { label: string; value: string; onChangeText: (text: string) => void; prefix?: string; suffix?: string; hint?: string; placeholder?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        {prefix ? <Text style={styles.affix}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(text.replace(/[^0-9.\-]/g, ''))}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={colours.faint}
          style={styles.input}
          accessibilityLabel={label}
        />
        {suffix ? <Text style={styles.affix}>{suffix}</Text> : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function TextField({ label, value, onChangeText, placeholder, multiline = false, maxLength, hint }: { label: string; value: string; onChangeText: (text: string) => void; placeholder?: string; multiline?: boolean; maxLength?: number; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colours.faint}
        multiline={multiline}
        maxLength={maxLength}
        style={[styles.inputBox, multiline && styles.inputMultiline]}
        accessibilityLabel={label}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** How far along, as a bar. Clamped, so a goal past its target draws full rather than off the card. */
export function ProgressBar({ pct: value, tone = 'indigo' }: { pct: number; tone?: 'indigo' | 'rose' | 'good' }) {
  const width = `${Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))}%` as const;
  const fill = tone === 'rose' ? colours.rose : tone === 'good' ? colours.good : colours.primary;
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.max(0, Math.min(100, value))) }}>
      <View style={[styles.fill, { width, backgroundColor: fill }]} />
    </View>
  );
}

/**
 * The line every figure on these screens carries: whose numbers they are and
 * when they date from. Rates and prices age, and a figure without its as-at
 * reads as today's.
 */
export function AsAt({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return <Text style={styles.asAt}>{text}</Text>;
}

export const pillarStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colours.page },
  content: { padding: 16, paddingBottom: 48, gap: 12 },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  muted: { color: colours.muted, fontSize: 13, lineHeight: 19 },
  body: { color: colours.body, fontSize: 14, lineHeight: 21 },
  card: { backgroundColor: colours.card, borderRadius: 16, padding: 16 },
  bordered: { borderWidth: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colours.ink },
  cardSubtitle: { fontSize: 13, color: colours.muted, marginTop: 4, lineHeight: 19 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colours.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 8, marginLeft: 4 },
  errorTitle: { fontWeight: '700', color: colours.warn, fontSize: 15 },
  errorBody: { color: colours.warn, marginTop: 6, fontSize: 13, lineHeight: 19 },
  retry: { marginTop: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colours.warn, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 },
  retryText: { color: '#fff', fontWeight: '600' },
  stat: { flex: 1, minWidth: 120 },
  statLabel: { fontSize: 12, color: colours.muted },
  statValue: { fontSize: 18, fontWeight: '700', color: colours.ink, marginTop: 2 },
  statValueBig: { fontSize: 26 },
  statSub: { fontSize: 12, color: colours.muted, marginTop: 2, lineHeight: 17 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colours.line },
  rowLabel: { color: colours.muted, fontSize: 13, flexShrink: 0, maxWidth: '50%' },
  rowValue: { color: colours.ink, fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' },
  notes: { marginTop: 10, gap: 6 },
  noteRow: { flexDirection: 'row', gap: 8 },
  bullet: { color: colours.faint, fontSize: 13, lineHeight: 19 },
  noteText: { flex: 1, color: colours.body, fontSize: 13, lineHeight: 19 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colours.primary, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, marginTop: 12 },
  primaryRose: { backgroundColor: colours.rose },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondary: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16, marginTop: 10, borderWidth: 1, borderColor: '#c7d2fe' },
  secondaryText: { color: colours.primaryDeep, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colours.line },
  navIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colours.primarySoft, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 15, color: colours.ink },
  navHint: { fontSize: 12, color: colours.muted, marginTop: 2 },
  webNote: { fontSize: 11, color: colours.primaryDeep, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  chipOn: { backgroundColor: colours.primary, borderColor: colours.primary },
  chipText: { color: colours.body, fontSize: 13 },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  field: { marginTop: 12 },
  scaleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  scaleWord: { fontSize: 12, color: colours.muted },
  scale: { flexDirection: 'row', gap: 6, marginTop: 6 },
  scaleStep: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#f3f1f6' },
  scaleStepOn: { backgroundColor: colours.rose },
  scaleText: { fontWeight: '700', color: colours.body },
  scaleTextOn: { color: '#fff' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colours.body },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f7', borderRadius: 10, paddingHorizontal: 12, marginTop: 6 },
  affix: { color: colours.muted, fontSize: 15 },
  input: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, fontSize: 15, color: colours.ink },
  inputBox: { backgroundColor: '#f5f5f7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colours.ink, marginTop: 6 },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: colours.muted, marginTop: 4 },
  track: { height: 8, borderRadius: 4, backgroundColor: '#eceaf2', overflow: 'hidden', marginTop: 8 },
  fill: { height: 8, borderRadius: 4 },
  asAt: { fontSize: 11, color: colours.faint, marginTop: 8, lineHeight: 16 },
});
