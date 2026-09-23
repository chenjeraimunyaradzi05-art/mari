/**
 * What the phone tells a member after she presses the panic button, and the
 * one rule about the contacts it can reach.
 *
 * The screen used to say "Alert sent" and then read `result.notified`, a field
 * the server has never returned, so the fallback string fired and every press
 * ended in "Your contacts were told." The server answers with two lists —
 * `notifiedContacts`, the people an email actually went to, and
 * `unreachableContacts`, the people who asked to be told and could not be —
 * and those lists are the only truth about what happened. A woman who has
 * just pressed this button is entitled to know that nobody heard her, so the
 * wording lives here, on its own, where it can be tested.
 *
 * Email is the only channel triggerPanicButton has (server/src/services/
 * dv-safe.service.ts). A contact with no email address is put on the
 * unreachable list and nothing is sent, which is why the form on this screen
 * insists on one.
 */

/** The panic response, as `POST /safety/dv/panic` returns it. */
export interface PanicOutcome {
  notifiedContacts?: unknown;
  unreachableContacts?: unknown;
}

export interface PanicMessage {
  title: string;
  body: string;
  /**
   * True when no contact was reached — including the case where the answer
   * did not say. The screen offers to dial 000 on exactly this flag, and it
   * errs towards saying nobody was told rather than towards reassurance.
   */
  reachedNobody: boolean;
}

function names(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function list(entries: string[]): string {
  if (entries.length === 1) return entries[0];
  if (entries.length === 2) return `${entries[0]} and ${entries[1]}`;
  return `${entries.slice(0, -1).join(', ')} and ${entries[entries.length - 1]}`;
}

export function describePanicOutcome(result: PanicOutcome | null | undefined): PanicMessage {
  const notified = names(result?.notifiedContacts);
  const unreachable = names(result?.unreachableContacts);

  // A reply we cannot read is not a reply that anyone was told. Saying so is
  // the only honest reading: the alternative is the old bug, where an
  // unrecognised shape still produced "your contacts were told".
  if (!Array.isArray(result?.notifiedContacts)) {
    return {
      title: 'Nobody was told',
      body:
        'ATHENA answered, but not with a list of who was reached, so treat this as nobody having been told. ' +
        'Call 000 if you are in danger, and call the people you trust yourself.',
      reachedNobody: true,
    };
  }

  if (notified.length === 0) {
    return {
      title: 'Nobody was told',
      body:
        unreachable.length > 0
          ? `No message reached ${list(unreachable)}. ATHENA alerts contacts by email, and there is no email address on file for them. ` +
            'Call 000 if you are in danger, and call them yourself. Add an email address for each contact so this works next time.'
          : 'You have no emergency contacts set to be alerted, so no message went anywhere. ' +
            'Call 000 if you are in danger. Add a contact below, with an email address, so this button can reach someone.',
      reachedNobody: true,
    };
  }

  const reached = `${list(notified)} ${notified.length === 1 ? 'was' : 'were'} emailed and asked to reach you now.`;
  return {
    title: notified.length === 1 ? 'One person was told' : `${notified.length} people were told`,
    body:
      unreachable.length > 0
        ? `${reached} ${list(unreachable)} could not be told — there is no email address on file for ${
            unreachable.length === 1 ? 'them' : 'any of them'
          } — so call ${unreachable.length === 1 ? 'them' : 'those people'} yourself. Call 000 if you are in danger.`
        : `${reached} Call 000 if you are in danger.`,
    reachedNobody: false,
  };
}

/**
 * The address has to be one the server will accept and an email can leave
 * for, so the form refuses anything that is plainly not an address rather
 * than letting her save a contact the panic button can never reach. The
 * server's zod schema is the real check; this one only keeps her from
 * discovering the problem in an emergency.
 */
export function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
