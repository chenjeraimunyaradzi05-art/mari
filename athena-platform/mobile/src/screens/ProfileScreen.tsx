/**
 * Profile: who the member is, her two real counts, and her own settings.
 * Everything else (the pillars, groups, mentors, help) lives under More.
 *
 * The counts are the lengths of GET /jobs/me/applications and
 * GET /jobs/me/saved. Until they load, or if they fail, the tile shows a dash
 * rather than a number nobody measured; the server keeps no profile-view
 * counter, so there is no third tile.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { userApi, unwrapApiData } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';

type Counts = { applications: number | null; saved: number | null };

export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, logout } = useAuth();
  const [counts, setCounts] = useState<Counts>({ applications: null, saved: null });

  // Re-read on every visit, so unsaving a job on the saved list is reflected
  // when the member comes back.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [applications, saved] = await Promise.all([
          userApi.getApplications().then((r) => unwrapApiData<unknown[]>(r.data)).catch(() => null),
          userApi.getSavedJobs().then((r) => unwrapApiData<unknown[]>(r.data)).catch(() => null),
        ]);
        if (cancelled) return;
        setCounts({
          applications: Array.isArray(applications) ? applications.length : null,
          saved: Array.isArray(saved) ? saved.length : null,
        });
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const menuItems = [
    { icon: 'document-text-outline', label: 'My Applications', onPress: () => navigation.navigate('Applications') },
    { icon: 'bookmark-outline', label: 'Saved Jobs', onPress: () => navigation.navigate('SavedJobs') },
    { icon: 'notifications-outline', label: 'Notifications', onPress: () => navigation.navigate('Notifications') },
    { icon: 'settings-outline', label: 'Settings', onPress: () => navigation.navigate('Settings') },
  ];

  const stat = (value: number | null) => (value == null ? '—' : String(value));

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.firstName?.charAt(0) || '?'}
          </Text>
        </View>
        <Text style={styles.displayName}>{user?.displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('ProfileEdit')}>
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('Applications')} accessibilityRole="button" accessibilityLabel="My applications">
          <Text style={styles.statValue}>{stat(counts.applications)}</Text>
          <Text style={styles.statLabel}>Applications</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('SavedJobs')} accessibilityRole="button" accessibilityLabel="Saved jobs">
          <Text style={styles.statValue}>{stat(counts.saved)}</Text>
          <Text style={styles.statLabel}>Saved Jobs</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={item.onPress}
          >
            <Ionicons name={item.icon as any} size={22} color="#6366f1" />
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.moreHint}>Wellness, cars, money plans, groups, mentors and help are under the More tab.</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color="#ef4444" />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>ATHENA Mobile v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '600',
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  editButton: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  editButtonText: {
    color: '#6366f1',
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginTop: 15,
    paddingVertical: 20,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
  },
  menuContainer: {
    backgroundColor: '#fff',
    marginTop: 15,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuLabel: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
  },
  moreHint: {
    marginTop: 12,
    marginHorizontal: 20,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 15,
    paddingVertical: 15,
  },
  logoutText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginVertical: 20,
  },
});
