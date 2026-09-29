/**
 * One pre-loved listing: the photos, the price against ATHENA's guide, the
 * facts the seller gave, what to check before paying, and how buyer
 * protection works.
 *
 * She can save it and make an offer from here. An offer is only an offer:
 * the seller is told and accepts or declines, and nothing is charged. Paying,
 * which holds the money on her card until she has the car, is done on the
 * web where the card form is, and the screen says so rather than offering a
 * button that could not take a payment.
 *
 * The seller's own ticks (a PPSR check, a roadworthy) are shown as hers. A
 * listing the server says is gone is gone; one that did not load did not load.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Image, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { unwrapApiData } from '../../services/api';
import { carsApi, type ListingDetail } from '../../services/cars';
import { apiMessage, isNotFound, loadFailure } from '../../utils/apiErrors';
import { aud, shortDate, toNumber, whole, words } from '../../utils/format';
import { Card, LoadError, Loading, Muted, Notes, NumberField, PrimaryButton, Row, SectionTitle, Stat, TextField, WebRow, colours, pillarStyles } from '../../components/pillar/PillarUi';

const HISTORY_WORDS: Record<string, string> = { FULL: 'Full service history', PARTIAL: 'Partial service history', NONE: 'No service history', UNKNOWN: 'Service history not known' };
const ACCIDENT_WORDS: Record<string, string> = { NONE: 'No accidents declared', MINOR_REPAIRED: 'Minor accident, repaired', MAJOR_REPAIRED: 'Major accident, repaired', UNKNOWN: 'Accident history not known' };

export function CarListingDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'CarListingDetail'>>();
  const listingId = route.params?.listingId;
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'gone' | 'failed'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offering, setOffering] = useState(false);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!listingId) {
      setState('gone');
      return;
    }
    setState((current) => (current === 'ready' ? current : 'loading'));
    try {
      const response = await carsApi.listing(listingId);
      setListing(unwrapApiData<ListingDetail>(response.data));
      setState('ready');
    } catch (error) {
      setListing(null);
      if (isNotFound(error)) setState('gone');
      else {
        setLoadError(loadFailure(error, 'This listing'));
        setState('failed');
      }
    }
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSave = async () => {
    if (!listing) return;
    const wasSaved = listing.saved === true;
    setListing({ ...listing, saved: !wasSaved });
    try {
      if (wasSaved) await carsApi.unsave(listing.id);
      else await carsApi.save(listing.id);
    } catch (error) {
      setListing((current) => (current ? { ...current, saved: wasSaved } : current));
      Alert.alert(wasSaved ? 'Not removed' : 'Not saved', apiMessage(error, 'Check your connection and try again.'));
    }
  };

  const sendOffer = () => {
    if (!listing) return;
    const offer = toNumber(amount);
    if (offer === null || offer < 100) {
      Alert.alert('How much?', 'Type the amount you are offering, in dollars.');
      return;
    }
    Alert.alert(`Offer ${aud(offer)}?`, 'The seller is told straight away and can accept or decline. Nothing is charged now; if the offer is accepted, you pay through ATHENA on the web and the money is held until you have the car.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send offer',
        onPress: async () => {
          setSending(true);
          try {
            await carsApi.offer(listing.id, { amount: Math.round(offer), ...(message.trim() ? { message: message.trim() } : {}) });
            setOffering(false);
            setAmount('');
            setMessage('');
            await load();
          } catch (error) {
            Alert.alert('Offer not sent', apiMessage(error, 'Your offer could not be sent. Check your connection and try again.'));
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
        <Loading label="Loading the listing…" />
      </View>
    );
  }

  if (state === 'gone') {
    return (
      <View style={[pillarStyles.screen, pillarStyles.content]}>
        <Card title="This listing is no longer up">
          <Muted>The seller may have sold the car or taken the listing down.</Muted>
        </Card>
      </View>
    );
  }

  if (state === 'failed' || !listing) {
    return (
      <View style={[pillarStyles.screen, pillarStyles.content]}>
        <LoadError title="This listing could not be loaded" message={loadError ?? 'Check your connection and try again.'} onRetry={() => void load()} />
      </View>
    );
  }

  return (
    <ScrollView style={pillarStyles.screen} contentContainerStyle={pillarStyles.content} keyboardShouldPersistTaps="handled">
      {listing.photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
          {listing.photos.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.photo} resizeMode="cover" accessibilityLabel={`Photo of ${listing.title}`} />
          ))}
        </ScrollView>
      )}

      <Card>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{listing.title}</Text>
          {!listing.isOwner && (
            <TouchableOpacity onPress={() => void toggleSave()} accessibilityRole="button" accessibilityLabel={listing.saved ? 'Remove from saved' : 'Save this listing'}>
              <Ionicons name={listing.saved ? 'heart' : 'heart-outline'} size={26} color={listing.saved ? colours.rose : colours.faint} />
            </TouchableOpacity>
          )}
        </View>
        <Stat big label={listing.sellerKind === 'DEALER' ? `From ${listing.seller.name}` : 'Asking'} value={aud(listing.price)} />
        {listing.guide ? (
          <>
            <Text style={styles.guide}>
              ATHENA's guide for this year and kilometres: {aud(listing.guide.guideLow)} to {aud(listing.guide.guideHigh)}.
            </Text>
            <Muted>{listing.guide.words}</Muted>
            {listing.guide.assumed ? <Muted>The guide assumed a typical new price for this make, so treat it as rough.</Muted> : null}
          </>
        ) : null}
      </Card>

      {listing.isOwner ? (
        <Card tone="indigo" title="This is your listing">
          <WebRow label="Manage it" hint="Offers, edits, marking it sold" path={`/dashboard/cars/sell/${listing.id}`} />
        </Card>
      ) : listing.myPurchase ? (
        <Card tone="indigo" title={`Your offer: ${aud(listing.myPurchase.offerAmount)}`} subtitle={words(listing.myPurchase.status)}>
          <WebRow label="Open your purchase" hint="Paying, the handover and releasing the money are done on the web" path={`/dashboard/cars/purchases/${listing.myPurchase.id}`} />
        </Card>
      ) : listing.canOffer ? (
        <Card title="Interested?">
          {offering ? (
            <>
              <NumberField label="Your offer" prefix="$" value={amount} onChangeText={setAmount} placeholder={String(listing.price)} hint="An offer under half the asking price is not sent." />
              <TextField label="A note to the seller" value={message} onChangeText={setMessage} placeholder="Optional" maxLength={1000} multiline />
              <PrimaryButton label="Send offer" onPress={sendOffer} busy={sending} />
              <TouchableOpacity onPress={() => setOffering(false)} accessibilityRole="button">
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Muted>An offer tells the seller the price you would pay. Nothing is charged unless the offer is accepted and you choose to pay.</Muted>
              <PrimaryButton label="Make an offer" icon="pricetag-outline" onPress={() => setOffering(true)} />
            </>
          )}
          <WebRow label="Book an inspection first" hint="A workshop checks the car and reports section by section" path={`/cars/preloved/${listing.id}`} />
        </Card>
      ) : null}

      <SectionTitle>The car</SectionTitle>
      <Card>
        <Row label="Year" value={String(listing.year)} />
        <Row label="Kilometres" value={`${whole(listing.odometerKm)} km`} />
        <Row label="Body and fuel" value={`${listing.bodyLabel}, ${listing.fuelLabel}`} />
        {listing.transmission ? <Row label="Transmission" value={words(listing.transmission)} /> : null}
        <Row label="History" value={HISTORY_WORDS[listing.serviceHistory] ?? words(listing.serviceHistory)} />
        <Row label="Accidents" value={ACCIDENT_WORDS[listing.accidentHistory] ?? words(listing.accidentHistory)} />
        {listing.ownersCount ? <Row label="Owners" value={String(listing.ownersCount)} /> : null}
        {listing.regoExpires ? <Row label="Rego until" value={shortDate(listing.regoExpires, { day: 'numeric', month: 'short', year: 'numeric' })} /> : null}
        <Row label="Where" value={[listing.suburb || listing.city, listing.state].filter(Boolean).join(', ')} />
        {listing.ppsrChecked ? <Muted>The seller says a PPSR check was done. ATHENA has not checked it; the two-dollar certificate is worth getting yourself.</Muted> : null}
        {listing.roadworthy ? <Muted>The seller says it has a roadworthy certificate.</Muted> : null}
        {listing.description ? <Text style={styles.description}>{listing.description}</Text> : null}
        {listing.features.length > 0 ? <Notes notes={listing.features} /> : null}
      </Card>

      {listing.beforeYouPay.length > 0 && (
        <>
          <SectionTitle>Before you pay</SectionTitle>
          <Card tone="warn">
            {listing.beforeYouPay.map((flag) => (
              <View key={flag.key} style={styles.flag}>
                <Text style={styles.flagTitle}>{flag.label}</Text>
                <Muted>{flag.advice}</Muted>
              </View>
            ))}
          </Card>
        </>
      )}

      <SectionTitle>Running it</SectionTitle>
      <Card>
        <View style={styles.stats}>
          <Stat label="Running costs, estimated" value={`${aud(listing.running.perWeek)} a week`} sub="Fuel, servicing, tyres, rego, insurance and value lost, averaged over three years" />
          <Stat label="Repayment, estimated" value={`${aud(listing.finance.repayment)} a month`} sub={`${aud(listing.finance.deposit)} deposit, ${listing.finance.ratePct}% over 5 years`} />
        </View>
        <Muted>ATHENA's own arithmetic, not a quote. ATHENA does not arrange finance.</Muted>
      </Card>

      <SectionTitle>Buyer protection</SectionTitle>
      <Card>
        <Notes notes={listing.protection.steps} />
        <Muted>{`You have ${listing.protection.inspectionDays} days after collecting the car to check it. ATHENA's ${listing.protection.feePercent}% comes from the seller's side.`}</Muted>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  photos: { gap: 8 },
  photo: { width: 280, height: 190, borderRadius: 14, backgroundColor: '#eee' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  title: { flex: 1, fontSize: 19, fontWeight: '700', color: colours.ink },
  guide: { color: colours.body, fontSize: 14, marginTop: 10, lineHeight: 20 },
  cancel: { color: colours.muted, textAlign: 'center', marginTop: 10 },
  description: { color: colours.body, fontSize: 14, lineHeight: 21, marginTop: 12 },
  flag: { paddingVertical: 6 },
  flagTitle: { fontWeight: '600', color: colours.warn },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
});
