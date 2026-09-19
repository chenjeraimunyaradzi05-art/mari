/**
 * Edit Profile. Saves with PATCH /users/me, the only verb the server has for
 * it (the old PUT was a 404, so nothing ever saved). The route ignores
 * `avatar`, so the photo is not offered here as though it could be changed;
 * that is done on the web.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../services/api';
import { openOnWeb } from './OpensOnWebScreen';

export function ProfileEditScreen() {
  const { user, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [headline, setHeadline] = useState(user?.headline || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Almost there', 'Your first and last name cannot be empty.');
      return;
    }
    setIsSaving(true);
    try {
      await userApi.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        headline: headline.trim(),
        bio: bio.trim(),
      });
      await refreshUser();
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (error: any) {
      Alert.alert('Not saved', error.response?.data?.message || 'We could not update your profile just now.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Edit Profile</Text>

      <View style={styles.avatarWrap}>
        {user?.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.avatar} accessibilityLabel="Your profile photo" />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{user?.firstName?.charAt(0) || '?'}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.avatarLink}
          onPress={() => openOnWeb('/settings')}
          accessibilityRole="link"
          accessibilityLabel="Change your photo on the web"
        >
          <Ionicons name="open-outline" size={14} color="#4338ca" />
          <Text style={styles.avatarLinkText}>Change your photo on the web</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label} nativeID="firstNameLabel">First Name</Text>
        <TextInput value={firstName} onChangeText={setFirstName} style={styles.input} accessibilityLabelledBy="firstNameLabel" maxLength={80} />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label} nativeID="lastNameLabel">Last Name</Text>
        <TextInput value={lastName} onChangeText={setLastName} style={styles.input} accessibilityLabelledBy="lastNameLabel" maxLength={80} />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label} nativeID="headlineLabel">Headline</Text>
        <TextInput value={headline} onChangeText={setHeadline} style={styles.input} accessibilityLabelledBy="headlineLabel" maxLength={200} placeholder="A line about what you do" placeholderTextColor="#9ca3af" />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label} nativeID="bioLabel">Bio</Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          style={[styles.input, styles.textarea]}
          multiline
          maxLength={2000}
          accessibilityLabelledBy="bioLabel"
        />
      </View>

      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
        accessibilityRole="button"
      >
        <Text style={styles.saveText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#f5f5f5', flexGrow: 1 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20, color: '#111827' },
  avatarWrap: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '600' },
  avatarLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  avatarLinkText: { color: '#4338ca', fontSize: 13, fontWeight: '500' },
  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    color: '#111827',
  },
  textarea: { height: 90, textAlignVertical: 'top' },
  saveButton: {
    backgroundColor: '#6366f1',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveText: { color: '#fff', fontWeight: '600' },
});
