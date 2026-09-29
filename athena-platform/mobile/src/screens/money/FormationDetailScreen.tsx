/**
 * One business registration: where it is up to, what a reviewer asked or
 * decided, and the documents drawn up for it.
 *
 * The heading for each status is the web's, word for word. What a reviewer
 * wrote (the information she asked for, the reason for a refusal, the
 * registration number on approval) is shown as written. When a reviewer asked
 * for more, she updates the details on the web and can send the registration
 * back from here; that is not a re-submission, and nothing more is charged.
 *
 * The documents are the ones generated for this registration. Each can be
 * read here in full; they are produced, and downloaded as files, on the web.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { unwrapApiData } from '../../services/api';
import { BUSINESS_TYPE_WORDS, formationApi, formationBody, registrationStep, type Registration, type RegistrationDocuments } from '../../services/money';
import { apiMessage, isNotFound, loadFailure } from '../../utils/apiErrors';
import { longDate } from '../../utils/format';
import { Card, LoadError, Loading, Muted, PrimaryButton, Row, SectionTitle, WebRow, colours, pillarStyles } from '../../components/pillar/PillarUi';

/** "51824753556" as "51 824 753 556". Anything that is not eleven digits is shown as stored. */
export function formatAbn(abn: string): string {
  const d = abn.replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : abn;
}

/** "004085616" as "004 085 616". */
export function formatAcn(acn: string): string {
  const d = acn.replace(/\D/g, '');
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : acn;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function FormationDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'FormationDetail'>>();
  const id = route.params?.registrationId;
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'gone' | 'failed'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [docs, setDocs] = useState<RegistrationDocuments | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ key: string; body: string | null; error: string | null } | null>(null);
  const [sending, setSending] = useState(false);

  const loadDocs = useCallback(async () => {
    if (!id) return;
    try {
      const response = await formationApi.documents(id);
      setDocs(unwrapApiData<RegistrationDocuments>(response.data));
      setDocsError(null);
    } catch (error) {
      setDocs(null);
      setDocsError(loadFailure(error, 'The documents'));
    }
  }, [id]);

  const load = useCallback(async () => {
    if (!id) {
      setState('gone');
      return;
    }
    setState((current) => (current === 'ready' ? current : 'loading'));
    try {
      const response = await formationApi.get(id);
      setRegistration(formationBody<Registration>(response.data));
      setState('ready');
      void loadDocs();
    } catch (error) {
      setRegistration(null);
      if (isNotFound(error)) setState('gone');
      else {
        setLoadError(loadFailure(error, 'This registration'));
        setState('failed');
      }
    }
  }, [id, loadDocs]);

  useEffect(() => {
    void load();
  }, [load]);

  const readDocument = async (key: string) => {
    if (!id) return;
    if (open?.key === key) {
      setOpen(null);
      return;
    }
    setOpen({ key, body: null, error: null });
    try {
      const response = await formationApi.document(id, key);
      setOpen({ key, body: typeof response.data === 'string' ? response.data : '', error: null });
    } catch (error) {
      setOpen({ key, body: null, error: loadFailure(error, 'This document') });
    }
  };

  const sendBack = () => {
    if (!id) return;
    Alert.alert('Send it back for review?', 'Do this once you have updated the details on the web with what was asked for. There is nothing more to pay.', [
      { text: 'Not yet', style: 'cancel' },
      {
        text: 'Send it back',
        onPress: async () => {
          setSending(true);
          try {
            await formationApi.provideInfo(id);
            await load();
          } catch (error) {
            Alert.alert('Not sent', apiMessage(error, 'It could not be sent back just now. Check your connection and try again.'));
          } finally {
            setSending(false);
          }
        },
      },
    ]);
  };

  if (state === 'loading') {
    return (
      <View style={pillarStyles.screen}>
        <Loading label="Reading the registration…" />
      </View>
    );
  }
  if (state === 'gone') {
    return (
      <View style={[pillarStyles.screen, pillarStyles.content]}>
        <Card title="That registration is not there">
          <Muted>It may have been removed. Your registrations are listed on the Formation screen.</Muted>
        </Card>
      </View>
    );
  }
  if (state === 'failed' || !registration) {
    return (
      <View style={[pillarStyles.screen, pillarStyles.content]}>
        <LoadError title="This registration could not be read" message={loadError ?? 'Check your connection and try again.'} onRetry={() => void load()} />
      </View>
    );
  }

  const step = registrationStep(registration.status);
  const data = registration.data ?? {};
  const infoRequested = text(data.infoRequested);
  const rejectionReason = text(data.rejectionReason);
  const registrationNumber = text(data.registrationNumber);
  const certificateUrl = text(data.certificateUrl);
  const needsInfo = registration.status === 'ADDITIONAL_INFO_REQUIRED';

  return (
    <ScrollView style={pillarStyles.screen} contentContainerStyle={pillarStyles.content}>
      <Card title={registration.businessName || 'Unnamed business'} subtitle={BUSINESS_TYPE_WORDS[registration.type] ?? registration.type}>
        <Text style={[styles.step, needsInfo && styles.stepAction]}>{step.heading}</Text>
        <Muted>{step.body}</Muted>
      </Card>

      {needsInfo && (
        <Card tone="warn" title="What the reviewer asked for">
          <Text style={styles.body}>{infoRequested ?? 'The request is on the web page for this registration.'}</Text>
          <WebRow label="Update the details" path={`/dashboard/formation/${registration.id}`} />
          <PrimaryButton label="Send it back for review" onPress={sendBack} busy={sending} />
        </Card>
      )}
      {registration.status === 'REJECTED' && rejectionReason ? (
        <Card title="Why it was not approved">
          <Text style={styles.body}>{rejectionReason}</Text>
        </Card>
      ) : null}

      <SectionTitle>Details</SectionTitle>
      <Card>
        {registration.abn ? <Row label="ABN" value={formatAbn(registration.abn)} /> : null}
        {registration.acn ? <Row label="ACN" value={formatAcn(registration.acn)} /> : null}
        {registrationNumber ? <Row label="Registration number" value={registrationNumber} /> : null}
        <Row label="Started" value={longDate(registration.createdAt)} />
        {registration.submittedAt ? <Row label="Sent for review" value={longDate(registration.submittedAt)} /> : null}
        {registration.approvedAt ? <Row label="Approved" value={longDate(registration.approvedAt)} /> : null}
        {certificateUrl && /^https?:\/\//i.test(certificateUrl) ? (
          <TouchableOpacity onPress={() => void Linking.openURL(certificateUrl)} accessibilityRole="link">
            <Text style={styles.link}>Open the certificate</Text>
          </TouchableOpacity>
        ) : null}
        <WebRow label="Open this registration on the web" hint="Edit the details, pay the fee, download documents" path={`/dashboard/formation/${registration.id}`} />
      </Card>

      <SectionTitle>Documents</SectionTitle>
      <Card>
        {docsError ? (
          <LoadError title="The documents could not be read" message={docsError} onRetry={() => void loadDocs()} />
        ) : !docs ? (
          <Loading label="Reading the documents…" />
        ) : docs.items.length === 0 ? (
          <Muted>
            {docs.available.length > 0
              ? `None drawn up yet. ${docs.available.length === 1 ? 'One document is' : `${docs.available.length} documents are`} ready to be generated from your details on the web.`
              : 'None for this registration yet.'}
          </Muted>
        ) : (
          <>
            {docs.generatedAt ? <Muted>Drawn up {longDate(docs.generatedAt)}. Tap one to read it.</Muted> : null}
            {docs.items.map((d) => (
              <View key={d.key} style={styles.doc}>
                <TouchableOpacity onPress={() => void readDocument(d.key)} accessibilityRole="button" accessibilityLabel={`Read ${d.title}`}>
                  <Text style={styles.docTitle}>{d.title}</Text>
                  <Muted>{d.purpose}</Muted>
                </TouchableOpacity>
                {open?.key === d.key ? (
                  open.error ? (
                    <Text style={styles.error}>{open.error}</Text>
                  ) : open.body === null ? (
                    <Loading label="Opening…" />
                  ) : (
                    <Text style={styles.docBody} selectable>
                      {open.body}
                    </Text>
                  )
                ) : null}
              </View>
            ))}
          </>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  step: { fontSize: 16, fontWeight: '700', color: colours.primaryDeep, marginTop: 8, marginBottom: 2 },
  stepAction: { color: colours.warn },
  body: { color: colours.body, fontSize: 14, lineHeight: 21 },
  link: { color: colours.primaryDeep, textDecorationLine: 'underline', marginTop: 10 },
  doc: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colours.line },
  docTitle: { fontSize: 15, fontWeight: '600', color: colours.ink },
  docBody: { marginTop: 10, fontSize: 13, lineHeight: 19, color: colours.body, backgroundColor: '#fafafa', padding: 10, borderRadius: 10 },
  error: { color: colours.bad, marginTop: 8, fontSize: 13 },
});
