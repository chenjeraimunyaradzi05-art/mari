/**
 * Opening a page of the web app from the phone.
 *
 * This file used to hold the "opens on the web" screen as well, a card that
 * stood in for every pillar the app had not built natively: wellness, cars,
 * the money plans, finance and formation were all that one card, and a
 * member who installed the super app found most of it was a link out. Those
 * pillars are native screens now, and the card went with them. Its promise
 * that she would "be signed in there with the same account" went too: the
 * phone's browser does not share the app's session, so she may be asked to
 * sign in.
 *
 * What is left is the one helper the app's "opens on the web" rows use.
 */
import { Linking } from 'react-native';
import { webUrl } from '../services/api';

/** Opens a page of the web app in the phone's browser. */
export function openOnWeb(path: string): Promise<void> {
  return Linking.openURL(webUrl(path)).then(() => undefined);
}
