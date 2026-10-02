/**
 * Whether a legal hold keeps a member's photo ID check out of reach.
 *
 * The nightly retention sweep (scripts/data-retention.ts) reads the holds once
 * and applies them to every row it touches. The redaction that happens at the
 * moment a person decides a check (services/identity-verification.service.ts)
 * has no sweep around it, so it asks the question for the one member in front
 * of it, and it has to ask the same question the sweep asks. A hold keeps a
 * member's identity check if it names the member, or if it names this kind of
 * record (under any spelling the console or a person typing might have used),
 * or if it holds everything. Asking only whether the member is named would let
 * a hold on "identity verification" be broken by the next decision, and a
 * redaction cannot be taken back.
 *
 * Kept free of imports so the sweep, the service and their tests can all read
 * it without pulling a database client in. The spellings are the ones the
 * console offers for this data type; the sweep's catalogue is built from this
 * list, so the two cannot drift apart.
 */

export const IDENTITY_HOLD_ALIASES: readonly string[] = [
  'identity_verification',
  'verification_documents',
  'identity_documents',
];

/** The words that make one hold freeze every purge (the same two the sweep reads). */
const HOLD_EVERYTHING: readonly string[] = ['*', 'all'];

/** The same normalisation the console and the sweep use: case, spaces and hyphens do not matter. */
function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function holdCoversIdentityChecks(
  hold: { affectedUserIds: readonly string[]; affectedDataTypes: readonly string[] },
  userId: string
): boolean {
  if (hold.affectedUserIds.includes(userId)) return true;
  return hold.affectedDataTypes.some((type) => {
    const normalised = normalise(type);
    return HOLD_EVERYTHING.includes(normalised) || IDENTITY_HOLD_ALIASES.includes(normalised);
  });
}
