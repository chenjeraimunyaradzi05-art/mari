/**
 * Formation: where each ABN or company registration is up to.
 *
 * GET /formation answers with her registrations, and each is shown with the
 * same heading the web uses for its status, so a paid registration reads the
 * same on both. Starting one, filling in its details and paying the fee are
 * done on the web, where the card form is. A list that could not be read is
 * said to be unreadable; "none yet" is only said when the server said so.
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { BUSINESS_TYPE_WORDS, formationApi, formationBody, registrationStep, type Registration } from '../../services/money';
import { loadFailure } from '../../utils/apiErrors';
import { longDate } from '../../utils/format';
import { Card, LoadError, Loading, Muted, WebRow, colours, pillarStyles } from '../../components/pillar/PillarUi';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function FormationScreen() {
  const navigation = useNavigation<Nav>();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setState((current) => (current === 'ready' ? current : 'loading'));
    try {
      const response = await formationApi.list();
      const list = formationBody<Registration[]>(response.data);
      setRegistrations(Array.isArray(list) ? list : []);
      setLoadError(null);
      setState('ready');
    } catch (error) {
      setRegistrations([]);
      setLoadError(loadFailure(error, 'Your registrations'));
      setState('failed');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <ScrollView
      style={pillarStyles.screen}
      contentContainerStyle={pillarStyles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      {state === 'loading' && <Loading label="Reading your registrations…" />}
      {state === 'failed' && loadError && <LoadError title="Your registrations could not be read" message={loadError} onRetry={() => void load()} />}
      {state === 'ready' && registrations.length === 0 && (
        <Card title="No registrations yet">
          <Muted>ATHENA can register a sole trader ABN, a partnership, a company or a trust for you, and track it here while it is reviewed.</Muted>
        </Card>
      )}
      {state === 'ready' &&
        registrations.map((r) => {
          const step = registrationStep(r.status);
          return (
            <TouchableOpacity key={r.id} onPress={() => navigation.navigate('FormationDetail', { registrationId: r.id, name: r.businessName ?? undefined })} accessibilityRole="button" accessibilityLabel={r.businessName ?? BUSINESS_TYPE_WORDS[r.type]}>
              <Card title={r.businessName || 'Unnamed business'} subtitle={`${BUSINESS_TYPE_WORDS[r.type] ?? r.type} · updated ${longDate(r.updatedAt)}`}>
                <Text style={[styles.step, r.status === 'ADDITIONAL_INFO_REQUIRED' && styles.stepAction]}>{step.heading}</Text>
                <Muted>{step.body}</Muted>
              </Card>
            </TouchableOpacity>
          );
        })}
      <Card>
        <WebRow icon="add-circle-outline" label="Start a registration" hint="The details and the fee are done on the web" path="/dashboard/formation/new" />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  step: { fontSize: 15, fontWeight: '700', color: colours.primaryDeep, marginTop: 8, marginBottom: 2 },
  stepAction: { color: colours.warn },
});
