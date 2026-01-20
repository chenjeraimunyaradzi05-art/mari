/**
 * Settings Screen (Language & Region)
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getDeviceDefaults, getLocalPreferences, setLocalPreferences } from '../utils/preferences';

const LANGUAGES = [
  { code: 'en-AU', label: 'English (Australia)' },
  { code: 'en-US', label: 'English (United States)' },
  { code: 'en-GB', label: 'English (United Kingdom)' },
  { code: 'en-SG', label: 'English (Singapore)' },
  { code: 'en-PH', label: 'English (Philippines)' },
  { code: 'es', label: 'Spanish' },
  { code: 'es-MX', label: 'Spanish (Mexico)' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
];

const REGIONS = [
  { value: 'ANZ', label: 'Australia / New Zealand' },
  { value: 'US', label: 'United States' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'EU', label: 'European Union' },
  { value: 'JP', label: 'Japan' },
  { value: 'KR', label: 'South Korea' },
  { value: 'IN', label: 'India' },
  { value: 'BR', label: 'Brazil' },
  { value: 'MX', label: 'Mexico' },
  { value: 'LATAM', label: 'LatAm' },
  { value: 'SEA', label: 'Southeast Asia' },
  { value: 'MEA', label: 'Middle East & Africa' },
  { value: 'ROW', label: 'Rest of World' },
];

const CURRENCIES = [
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'KRW', label: 'KRW — South Korean Won' },
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'BRL', label: 'BRL — Brazilian Real' },
  { value: 'MXN', label: 'MXN — Mexican Peso' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'PHP', label: 'PHP — Philippine Peso' },
  { value: 'IDR', label: 'IDR — Indonesian Rupiah' },
  { value: 'THB', label: 'THB — Thai Baht' },
  { value: 'VND', label: 'VND — Vietnamese Dong' },
  { value: 'MYR', label: 'MYR — Malaysian Ringgit' },
  { value: 'NZD', label: 'NZD — New Zealand Dollar' },
  { value: 'AED', label: 'AED — Emirati Dirham' },
  { value: 'SAR', label: 'SAR — Saudi Riyal' },
  { value: 'ZAR', label: 'ZAR — South African Rand' },
  { value: 'EGP', label: 'EGP — Egyptian Pound' },
];

const TIMEZONES = [
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'Australia/Perth', label: 'Perth (AWST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Seoul', label: 'Seoul (KST)' },
  { value: 'Asia/Kolkata', label: 'Kolkata (IST)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'America/New_York', label: 'New York (EST)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { value: 'America/Mexico_City', label: 'Mexico City (CST)' },
];

function OptionList({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { value?: string; code?: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {options.map((option) => {
        const optionValue = option.value ?? option.code ?? '';
        const isSelected = optionValue === value;
        return (
          <TouchableOpacity
            key={optionValue}
            style={[styles.optionRow, isSelected && styles.optionRowSelected]}
            onPress={() => onChange(optionValue)}
          >
            <Text style={styles.optionLabel}>{option.label}</Text>
            {isSelected && <Ionicons name="checkmark" size={18} color="#6366f1" />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function SettingsScreen() {
  const { user, refreshUser } = useAuth();
  const [language, setLanguage] = useState('en-AU');
  const [region, setRegion] = useState('ANZ');
  const [currency, setCurrency] = useState('AUD');
  const [timezone, setTimezone] = useState('Australia/Sydney');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadPreferences = async () => {
      const deviceDefaults = getDeviceDefaults();
      const stored = await getLocalPreferences();
      const merged = {
        ...deviceDefaults,
        ...stored,
        preferredLocale: user?.preferredLocale || stored?.preferredLocale || deviceDefaults.preferredLocale,
        preferredCurrency: user?.preferredCurrency || stored?.preferredCurrency || deviceDefaults.preferredCurrency,
        timezone: user?.timezone || stored?.timezone || deviceDefaults.timezone,
        region: user?.region || stored?.region || deviceDefaults.region,
      };

      setLanguage(merged.preferredLocale);
      setCurrency(merged.preferredCurrency);
      setTimezone(merged.timezone);
      setRegion(merged.region);

      await setLocalPreferences(merged);
    };

    loadPreferences();
  }, [user?.preferredLocale, user?.preferredCurrency, user?.timezone, user?.region]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.patch('/users/me/preferences', {
        preferredLocale: language,
        preferredCurrency: currency,
        timezone,
        region,
      });
      await setLocalPreferences({
        preferredLocale: language,
        preferredCurrency: currency,
        timezone,
        region,
      });
      await refreshUser();
      Alert.alert('Saved', 'Your preferences have been updated.');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update preferences');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Settings</Text>
      <Text style={styles.subheader}>Language & Region</Text>

      <OptionList
        title="Language"
        options={LANGUAGES.map((lang) => ({ code: lang.code, label: lang.label }))}
        value={language}
        onChange={setLanguage}
      />

      <OptionList
        title="Region"
        options={REGIONS.map((region) => ({ value: region.value, label: region.label }))}
        value={region}
        onChange={setRegion}
      />

      <OptionList
        title="Currency"
        options={CURRENCIES.map((currency) => ({ value: currency.value, label: currency.label }))}
        value={currency}
        onChange={setCurrency}
      />

      <OptionList
        title="Timezone"
        options={TIMEZONES.map((timezone) => ({ value: timezone.value, label: timezone.label }))}
        value={timezone}
        onChange={setTimezone}
      />

      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
      >
        <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Preferences'}</Text>
      </TouchableOpacity>
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
    paddingBottom: 40,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subheader: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionRowSelected: {
    backgroundColor: '#f8f7ff',
  },
  optionLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  saveButton: {
    marginTop: 10,
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
