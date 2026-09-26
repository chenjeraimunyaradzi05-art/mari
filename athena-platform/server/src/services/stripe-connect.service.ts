/**
 * Stripe Connect Service
 * Multi-party payouts for Mentors and Creators
 * Phase 2: Backend Logic & Integrations
 */

import type Stripe from 'stripe';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import { getStripe, isStripeConfigured } from '../utils/stripe';
import { bestEffort } from '../utils/best-effort';

// Platform fee percentage (e.g., 15% of mentor/creator earnings)
const PLATFORM_FEE_PERCENT = 15;

/**
 * Whether this deployment should fall back to the development mocks below.
 *
 * The key is checked with isStripeConfigured() rather than by null-testing a
 * client: getStripe() never returns null - outside production it hands back a
 * placeholder client - so a null test would always say "Stripe is ready" and
 * every mock path here would instead try to move real money with a key that
 * could only fail.
 */
function canUseMockStripe(feature: string): boolean {
  if (isStripeConfigured()) {
    return false;
  }

  const message = `${feature} requires STRIPE_SECRET_KEY`;
  if (process.env.NODE_ENV === 'production') {
    logger.error(message);
    throw new ApiError(503, message);
  }

  logger.warn(`${message}; using development mock`);
  return true;
}

/**
 * Where a development machine with no Stripe key sends a member who presses
 * "Connect payouts". There is nothing to onboard with — the mock account is
 * written ACTIVE the moment it is created — so she is sent straight to the
 * earnings page, which reads the account back and shows it connected.
 *
 * This used to name /dashboard/payments/mock-onboarding, a page that was never
 * built, so the local flow ended on a 404 and looked broken when it was not.
 */
function mockOnboardingUrl(): string {
  return `${process.env.CLIENT_URL}/dashboard/earnings`;
}

export interface ConnectedAccountInput {
  userId: string;
  email: string;
  country: string;
  type: 'mentor' | 'creator';
  businessType?: 'individual' | 'company';
}

export interface PayoutInput {
  connectedAccountId: string;
  /**
   * In major units — dollars, not cents — because that is the unit a member
   * types into the withdraw box and the unit the route validates against its
   * ceiling. createPayout converts it for Stripe.
   *
   * This field used to be documented as cents while its only caller sent
   * dollars, and createPayout passed it straight to Stripe: a A$150 withdrawal
   * became a A$1.50 payout under a toast saying the money was on its way, and
   * "Withdraw all" on A$123.45 sent Stripe a fraction it refused, so the member
   * got a 500. The conversion now happens in exactly one place, here, so a
   * caller cannot do it a second time. Do not pass cents.
   */
  amount: number;
  currency: string;
  description?: string;
  /**
   * A key derived from something stable on the caller's side — the id of the
   * row that records this payout, not a fresh uuid. The Stripe SDK attaches a
   * random key of its own to every POST, which dedupes that one request's
   * network retries and nothing else, so two separate calls still move money
   * twice. Only the caller knows which two calls are the same payout.
   */
  idempotencyKey?: string;
}

/**
 * Who is asking for an escrow transition. Escrow moves real money between two
 * named people, so a transition has to be authorised against the row itself —
 * holding a valid session is not enough.
 */
export interface EscrowActor {
  id: string;
  role?: string;
}

/**
 * The platform itself, for the server-side flows that move a hold without
 * anybody pressing anything in a browser: the expiry sweeper, and a mentor
 * session whose own route has already authorised the caller against the
 * session row. assertEscrowParty lets an ADMIN through, so this is the same
 * thing those flows were already doing with an inline literal — named, so that
 * a reader can see the authorisation happened somewhere else and go and check
 * it there rather than assuming this call site did it.
 */
export const PLATFORM_ESCROW_ACTOR: EscrowActor = { id: 'system', role: 'ADMIN' };

export interface EscrowPaymentInput {
  buyerId: string;
  sellerId: string;
  amount: number; // in cents
  currency: string;
  description: string;
  metadata?: Record<string, string>;
  sessionType?: 'mentor_session' | 'course_purchase' | 'creator_content' | 'service_order' | 'vehicle_purchase' | 'car_service' | 'vehicle_inspection';
  /** The platform's cut for this hold, when it differs from the default (a car sale carries a smaller percentage than a session). */
  platformFeePercent?: number;
  /**
   * The exact platform cut in cents, for a caller that has already worked it
   * out and stored it on its own row. A mentor session records the fee against
   * the session in dollars; recomputing it here from a percentage can land a
   * cent away from that, and the two numbers then disagree on the member's tax
   * statement.
   */
  platformFeeAmount?: number;
  /**
   * Let Stripe offer whatever payment methods the account has enabled, rather
   * than the card-only default. The mentor booking screen mounts a Payment
   * Element, which needs this.
   */
  automaticPaymentMethods?: boolean;
}

/**
 * The connected account a member is paid through.
 *
 * There were three columns holding this for one person —
 * `User.stripeConnectAccountId`, `MentorProfile.stripeAccountId` and
 * `CreatorProfile.stripeAccountId` — each written by a different "enable
 * payouts" path, so the same woman could end up with three Express accounts
 * and the earnings dashboard read the first while her mentor sessions paid
 * into the second: a balance of A$0 and a withdraw button that never enabled.
 *
 * `User.stripeConnectAccountId` is the identity now. The profile columns are
 * still written alongside it for one release, so that a half-deployed build
 * cannot strand an account nobody can find, and are read here only to adopt an
 * account created before this change.
 */
export async function resolveConnectedAccountId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      stripeConnectAccountId: true,
      mentorProfile: { select: { stripeAccountId: true } },
      creatorProfile: { select: { stripeAccountId: true } },
    },
  });

  if (!user) return null;
  if (user.stripeConnectAccountId) return user.stripeConnectAccountId;

  const adopted = user.mentorProfile?.stripeAccountId || user.creatorProfile?.stripeAccountId;
  if (!adopted) return null;

  await prisma.user.update({
    where: { id: userId },
    data: { stripeConnectAccountId: adopted },
  });
  logger.info('Adopted a profile Stripe account as the member payout identity', { userId, accountId: adopted });

  // `stripeConnectStatus` was never written for accounts created by the mentor
  // and creator paths, and escrow refuses a seller who is not ACTIVE. Adopting
  // the account without asking Stripe what state it is in would lock a mentor
  // out of the bookings she was already taking, so the one lookup happens here,
  // once, at the moment of adoption.
  await bestEffort('stripe-connect.adopt-account-state', () => refreshConnectedAccount(userId, adopted), null);

  return adopted;
}

/** How Stripe's capability flags map onto the status column the platform gates on. */
function connectStatusFor(account: Stripe.Account): 'PENDING' | 'RESTRICTED' | 'ACTIVE' {
  if (!account.details_submitted) return 'PENDING';
  return account.payouts_enabled ? 'ACTIVE' : 'RESTRICTED';
}

/**
 * Writes what the rest of the platform decides on from a connected account's
 * real state.
 *
 * `isMonetized` used to be set to true in the same statement that created a
 * brand-new Express account, before Stripe had verified anyone — so the flag
 * that means "she can be paid" was true from the first second and never said
 * otherwise. It is derived here instead, from the same two capabilities behind
 * an ACTIVE status, and mirrored onto whichever profiles the member has.
 */
async function writeAccountState(
  userId: string,
  accountId: string,
  status: 'PENDING' | 'RESTRICTED' | 'ACTIVE',
  monetized: boolean
): Promise<void> {
  // A member who came through two of the old paths has two Express accounts,
  // and the mirrors below are about to overwrite the one this half of the
  // platform was using — after which nothing in the database remembers it
  // existed, while Stripe may still be holding a balance on it. The id is put
  // in the log before that happens, loudly, because reconciling the duplicate
  // is a person's decision and they need somewhere to start.
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      mentorProfile: { select: { stripeAccountId: true } },
      creatorProfile: { select: { stripeAccountId: true } },
    },
  });

  for (const [profile, previous] of [
    ['mentor', before?.mentorProfile?.stripeAccountId],
    ['creator', before?.creatorProfile?.stripeAccountId],
  ] as const) {
    if (previous && previous !== accountId) {
      logger.warn('Member has a second Stripe Connect account that is no longer referenced', {
        userId,
        profile,
        supersededAccountId: previous,
        connectedAccountId: accountId,
      });
    }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { stripeConnectAccountId: accountId, stripeConnectStatus: status },
    }),
    // updateMany rather than update: a member has at most one of each profile
    // and usually neither, and update would throw on the row that is not there.
    prisma.mentorProfile.updateMany({
      where: { userId },
      data: { stripeAccountId: accountId, isMonetized: monetized },
    }),
    prisma.creatorProfile.updateMany({
      where: { userId },
      data: { stripeAccountId: accountId, isMonetized: monetized },
    }),
  ]);
}

/** Applies an account object Stripe has just handed us to the member's rows. */
export async function applyAccountState(userId: string, account: Stripe.Account): Promise<void> {
  await writeAccountState(
    userId,
    account.id,
    connectStatusFor(account),
    Boolean(account.charges_enabled && account.payouts_enabled)
  );
}

/**
 * Asks Stripe for an account's current state and stores it.
 *
 * Called when a member's own screens need an answer that is not stale. The
 * authoritative refresh is the `account.updated` webhook, which is the only
 * thing that hears about a verification finishing hours after she closed the
 * tab.
 */
export async function refreshConnectedAccount(userId: string, accountId: string): Promise<void> {
  if (!isStripeConfigured()) {
    // A deployment with no Stripe key has nothing to verify against, and every
    // mocked path below answers "onboarded". Leaving isMonetized false here
    // would make local work look like a Stripe restriction and hide the real
    // behaviour behind a fake one.
    await writeAccountState(userId, accountId, 'ACTIVE', true);
    return;
  }

  const account = await getStripe().accounts.retrieve(accountId);
  await applyAccountState(userId, account);
}

/**
 * The member behind an `account.updated` event, updated from it.
 *
 * Returns false when the account belongs to nobody here, so the webhook can
 * count the event as ignored rather than handled.
 */
export async function syncConnectedAccountFromStripe(account: Stripe.Account): Promise<boolean> {
  const metadataUserId = typeof account.metadata?.userId === 'string' ? account.metadata.userId : null;

  const owner = metadataUserId
    ? await prisma.user.findUnique({ where: { id: metadataUserId }, select: { id: true } })
    : await prisma.user.findFirst({
        where: { stripeConnectAccountId: account.id },
        select: { id: true },
      });

  if (!owner) {
    logger.warn('Stripe account event for an account no member owns', { accountId: account.id });
    return false;
  }

  await applyAccountState(owner.id, account);
  return true;
}

/**
 * Create a Stripe Connect Express account for mentor/creator
 */
export async function createConnectedAccount(input: ConnectedAccountInput): Promise<{
  accountId: string;
  onboardingUrl: string;
}> {
  // One member, one connected account. Mentor and creator monetisation both
  // come through here now, and each of them used to call accounts.create
  // unconditionally: a woman who turned on creator mode and then mentoring had
  // two Express accounts, and whichever one her earnings screen happened to
  // read showed a balance the other one held.
  const existingAccountId = await resolveConnectedAccountId(input.userId);
  if (existingAccountId) {
    // Re-read the account's state on the way past, which is also what mirrors
    // it onto a profile the member has only just created — a creator who
    // connected through the payments page months ago and switches on creator
    // mode today would otherwise end up with a profile that names no account.
    await refreshConnectedAccount(input.userId, existingAccountId);
    return {
      accountId: existingAccountId,
      onboardingUrl: await getOnboardingLink(input.userId),
    };
  }

  if (canUseMockStripe('Creating a Stripe Connect account')) {
    const mockAccountId = `acct_mock_${input.userId}`;
    // Stored, unlike the other mocks here, because this one is an identity the
    // rest of the flow looks up again: without the row, enabling monetisation
    // locally left the member with no connected account and every later step
    // refusing her, which is not how the same sequence behaves in production.
    await writeAccountState(input.userId, mockAccountId, 'ACTIVE', true);
    return {
      accountId: mockAccountId,
      onboardingUrl: mockOnboardingUrl(),
    };
  }

  try {
    // Create the Express connected account
    const account = await getStripe().accounts.create({
      type: 'express',
      country: input.country,
      email: input.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: input.businessType || 'individual',
      metadata: {
        userId: input.userId,
        accountType: input.type,
      },
    });

    // Store the connected account ID in the database, along with the state a
    // brand-new Express account is genuinely in: nothing submitted, nothing
    // verified, so not monetised.
    await applyAccountState(input.userId, account);

    // Create the account onboarding link
    const accountLink = await getStripe().accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.CLIENT_URL}/dashboard/payments/refresh`,
      return_url: `${process.env.CLIENT_URL}/dashboard/payments/success`,
      type: 'account_onboarding',
    });

    logger.info('Created Stripe Connect account', { userId: input.userId, accountId: account.id });

    return {
      accountId: account.id,
      onboardingUrl: accountLink.url,
    };
  } catch (error) {
    logger.error('Failed to create Stripe Connect account', { error, userId: input.userId });
    throw new ApiError(500, 'Failed to create payment account');
  }
}

/**
 * Get onboarding link for existing connected account
 */
export async function getOnboardingLink(userId: string): Promise<string> {
  const accountId = await resolveConnectedAccountId(userId);

  if (!accountId) {
    throw new ApiError(404, 'No connected account found');
  }

  if (canUseMockStripe('Creating a Stripe Connect onboarding link')) {
    return mockOnboardingUrl();
  }

  const accountLink = await getStripe().accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.CLIENT_URL}/dashboard/payments/refresh`,
    return_url: `${process.env.CLIENT_URL}/dashboard/payments/success`,
    type: 'account_onboarding',
  });

  return accountLink.url;
}

/**
 * Check if connected account is fully onboarded
 */
export async function getAccountStatus(userId: string): Promise<{
  isOnboarded: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  requirements?: string[];
}> {
  const accountId = await resolveConnectedAccountId(userId);

  if (!accountId) {
    return {
      isOnboarded: false,
      payoutsEnabled: false,
      chargesEnabled: false,
    };
  }

  if (canUseMockStripe('Checking Stripe Connect account status')) {
    return {
      isOnboarded: true,
      payoutsEnabled: true,
      chargesEnabled: true,
    };
  }

  try {
    const account = await getStripe().accounts.retrieve(accountId);

    const isOnboarded = account.details_submitted || false;
    const payoutsEnabled = account.payouts_enabled || false;
    const chargesEnabled = account.charges_enabled || false;

    // Written unconditionally rather than only when the status string moved:
    // isMonetized rides on the same two capabilities, and a member whose status
    // stayed ACTIVE while her payouts were restricted and restored again would
    // otherwise keep whichever flag she happened to have.
    await applyAccountState(userId, account);

    return {
      isOnboarded,
      payoutsEnabled,
      chargesEnabled,
      requirements: account.requirements?.currently_due || [],
    };
  } catch (error) {
    logger.error('Failed to get account status', { error, userId });
    throw new ApiError(500, 'Failed to check account status');
  }
}

/**
 * Create an escrow-style payment (hold funds until service delivered)
 * Uses PaymentIntents with manual capture for mentor sessions
 */
export async function createEscrowPayment(input: EscrowPaymentInput): Promise<{
  escrowId: string;
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  platformFee: number;
}> {
  const sellerAccountId = await resolveConnectedAccountId(input.sellerId);

  if (!sellerAccountId) {
    throw new ApiError(400, 'Seller has not set up payment account');
  }

  const seller = await prisma.user.findUnique({
    where: { id: input.sellerId },
    select: { stripeConnectStatus: true },
  });

  if (seller?.stripeConnectStatus !== 'ACTIVE') {
    throw new ApiError(400, 'Seller payment account is not fully verified');
  }

  const platformFee =
    input.platformFeeAmount ??
    Math.round(input.amount * ((input.platformFeePercent ?? PLATFORM_FEE_PERCENT) / 100));

  if (canUseMockStripe('Creating an escrow payment')) {
    const mockId = `pi_mock_${Date.now()}`;
    
    // Store mock escrow record
    const mockRow = await prisma.escrowPayment.create({
      data: {
        paymentIntentId: mockId,
        buyerId: input.buyerId,
        sellerId: input.sellerId,
        amount: input.amount,
        platformFee,
        currency: input.currency,
        status: 'PENDING',
        description: input.description,
        sessionType: input.sessionType || 'mentor_session',
        metadata: input.metadata || {},
      },
    });

    return {
      escrowId: mockRow.id,
      paymentIntentId: mockId,
      clientSecret: `${mockId}_secret_mock`,
      amount: input.amount,
      platformFee,
    };
  }

  let paymentIntent: Stripe.PaymentIntent;

  try {
    // Create payment intent with manual capture (escrow)
    paymentIntent = await getStripe().paymentIntents.create({
      amount: input.amount,
      currency: input.currency,
      capture_method: 'manual', // Don't capture immediately - hold in escrow
      application_fee_amount: platformFee,
      ...(input.automaticPaymentMethods ? { automatic_payment_methods: { enabled: true } } : {}),
      transfer_data: {
        destination: sellerAccountId,
      },
      metadata: {
        buyerId: input.buyerId,
        sellerId: input.sellerId,
        sessionType: input.sessionType || 'mentor_session',
        ...input.metadata,
      },
      description: input.description,
    });
  } catch (error) {
    logger.error('Failed to create escrow payment', { error, input });
    throw new ApiError(500, 'Failed to create payment');
  }

  // The intent now exists at Stripe and the row here does not. The two writes
  // used to sit in one try block with nothing but a log between them, so a
  // failed insert left a live intent that nothing in this platform knew about:
  // no row for the expiry sweep to find, no row for either party to cancel, and
  // a buyer who could still be asked for the money by a checkout page that had
  // already been handed the client secret. The insert is separated out here so
  // that its failure can be compensated — the intent we just created is
  // cancelled again, and only then does the caller get its error.
  try {
    const row = await prisma.escrowPayment.create({
      data: {
        paymentIntentId: paymentIntent.id,
        buyerId: input.buyerId,
        sellerId: input.sellerId,
        amount: input.amount,
        platformFee,
        currency: input.currency,
        status: 'PENDING',
        description: input.description,
        sessionType: input.sessionType || 'mentor_session',
        metadata: input.metadata || {},
      },
    });

    logger.info('Created escrow payment', {
      paymentIntentId: paymentIntent.id,
      buyerId: input.buyerId,
      sellerId: input.sellerId,
      amount: input.amount,
    });

    return {
      escrowId: row.id,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
      amount: input.amount,
      platformFee,
    };
  } catch (error) {
    // bestEffort rather than a bare catch: the cancel is allowed to fail — the
    // intent may already have been confirmed by a buyer who was quick — but it
    // must not fail silently, because an intent that survives this is money
    // held against nothing and the id below is all anyone has to find it with.
    const cancelled = await bestEffort(
      'stripe-connect.cancel-orphaned-intent',
      async () => {
        await getStripe().paymentIntents.cancel(paymentIntent.id);
        return true;
      },
      false
    );

    logger.error('Failed to record an escrow payment after Stripe created the hold', {
      error,
      paymentIntentId: paymentIntent.id,
      orphanedIntentCancelled: cancelled,
      buyerId: input.buyerId,
      sellerId: input.sellerId,
      amount: input.amount,
      currency: input.currency,
    });

    throw new ApiError(500, 'Failed to create payment');
  }
}

/**
 * The client secret the buyer needs to authorise a hold that is still pending,
 * for a checkout they left and came back to. Nothing for a hold already
 * authorised, captured or cancelled.
 */
export async function getEscrowClientSecret(paymentIntentId: string): Promise<string | null> {
  if (paymentIntentId.startsWith('pi_mock_')) return `${paymentIntentId}_secret_mock`;
  if (!isStripeConfigured()) return null;
  const intent = await getStripe().paymentIntents.retrieve(paymentIntentId);
  return intent.client_secret ?? null;
}

/**
 * Authorise an escrow transition against the row it targets.
 *
 * 'buyer' is for releasing funds: only the person who paid can confirm the
 * service actually arrived. 'cancel' returns the money to the buyer, so either
 * party backing out is safe.
 *
 * A non-party gets the same 404 an unknown id gets, deliberately — otherwise
 * this endpoint becomes an oracle for which payment intents exist.
 */
function assertEscrowParty(
  escrow: { buyerId: string; sellerId: string },
  actor: EscrowActor,
  allow: 'buyer' | 'either'
): void {
  if (actor.role === 'ADMIN') return;

  const isBuyer = escrow.buyerId === actor.id;
  const isSeller = escrow.sellerId === actor.id;

  if (allow === 'buyer' ? isBuyer : isBuyer || isSeller) return;

  throw new ApiError(404, 'Escrow payment not found');
}

/**
 * What Stripe says about a hold we are about to release, before we try.
 *
 * A row is written PENDING and only moves to AUTHORIZED when the buyer has
 * actually put a card behind it — normally on the
 * `payment_intent.amount_capturable_updated` webhook. Release used to accept
 * PENDING as well, so a release attempted before authorisation went all the way
 * to Stripe, was refused there because the intent was still
 * requires_payment_method, and came back to the person pressing the button as a
 * flat 500 'Failed to capture payment'. Every caller had copied the same
 * permissive pair of statuses, so it had to be decided here.
 *
 * Asking Stripe rather than refusing outright on the local status is
 * deliberate. The row is a copy of Stripe's answer and can be behind it — a
 * webhook that has not landed, or a deployment with none configured, both leave
 * a genuinely authorised hold reading PENDING here — and refusing those would
 * strand money that is sitting there ready to be released.
 *
 * Returns 'capturable' when the hold is real, or 'already_captured' when the
 * money has already moved and only the row is behind, which is the shape the
 * ordering in captureEscrowPayment can leave behind: capture succeeds at Stripe
 * and the update after it fails.
 */
async function readHoldStateAtStripe(
  paymentIntentId: string
): Promise<{ state: 'capturable' } | { state: 'already_captured'; amountCaptured: number }> {
  const intent = await getStripe().paymentIntents.retrieve(paymentIntentId);

  if (intent.status === 'requires_capture') {
    return { state: 'capturable' };
  }

  if (intent.status === 'succeeded') {
    return { state: 'already_captured', amountCaptured: intent.amount_received };
  }

  if (intent.status === 'canceled') {
    throw new ApiError(409, 'This payment was cancelled, so there is nothing to release.');
  }

  throw new ApiError(
    409,
    'This payment has not been authorised yet, so there is nothing to release. Ask the buyer to complete the payment first.'
  );
}

/**
 * Capture escrowed payment (release funds to seller after service delivered)
 */
export async function captureEscrowPayment(
  paymentIntentId: string,
  actor: EscrowActor
): Promise<{
  status: string;
  amountCaptured: number;
}> {
  const escrow = await prisma.escrowPayment.findUnique({
    where: { paymentIntentId },
  });

  if (!escrow) {
    throw new ApiError(404, 'Escrow payment not found');
  }

  assertEscrowParty(escrow, actor, 'buyer');

  if (escrow.status !== 'PENDING' && escrow.status !== 'AUTHORIZED') {
    throw new ApiError(400, `Cannot capture payment in ${escrow.status} status`);
  }

  if (canUseMockStripe('Capturing an escrow payment')) {
    await prisma.escrowPayment.update({
      where: { paymentIntentId },
      data: { status: 'CAPTURED', capturedAt: new Date() },
    });

    return {
      status: 'captured',
      amountCaptured: escrow.amount,
    };
  }

  const hold = await readHoldStateAtStripe(paymentIntentId);

  if (hold.state === 'already_captured') {
    // The money is with the seller and only the row was left behind. Bringing
    // it into line is the whole of the work here; capturing again would be
    // refused by Stripe and reported to the buyer as a failure of a release
    // that had in fact succeeded.
    await prisma.escrowPayment.update({
      where: { paymentIntentId },
      data: { status: 'CAPTURED', capturedAt: escrow.capturedAt ?? new Date() },
    });

    logger.warn('Escrow row was behind Stripe: the hold had already been captured', {
      paymentIntentId,
      escrowId: escrow.id,
      amountCaptured: hold.amountCaptured,
    });

    return { status: 'succeeded', amountCaptured: hold.amountCaptured };
  }

  if (escrow.status === 'PENDING') {
    // Stripe says the hold is real, so the row is simply behind its webhook.
    // Written before the capture rather than after it, so that the sequence
    // holds even if the process dies between the two calls.
    await prisma.escrowPayment.update({
      where: { paymentIntentId },
      data: { status: 'AUTHORIZED' },
    });
  }

  let paymentIntent: Stripe.PaymentIntent;

  try {
    paymentIntent = await getStripe().paymentIntents.capture(paymentIntentId);
  } catch (error) {
    logger.error('Failed to capture escrow payment', { error, paymentIntentId });
    throw new ApiError(500, 'Failed to capture payment');
  }

  try {
    await prisma.escrowPayment.update({
      where: { paymentIntentId },
      data: { status: 'CAPTURED', capturedAt: new Date() },
    });
  } catch (error) {
    // The money has moved. Failing the request here would tell the buyer her
    // release did not happen when it did, and she would press the button
    // again; the row is repaired instead on the next release attempt, by the
    // already_captured branch above, and the id is logged so it can be found
    // before anyone gets that far.
    logger.error('Captured an escrow hold but could not record it', {
      error,
      paymentIntentId,
      escrowId: escrow.id,
      amountCaptured: paymentIntent.amount_received,
    });
  }

  logger.info('Captured escrow payment', { paymentIntentId, amount: escrow.amount });

  return {
    status: paymentIntent.status,
    amountCaptured: paymentIntent.amount_received,
  };
}

/**
 * What Stripe says about a hold we are about to give back, before we try.
 *
 * The sibling of readHoldStateAtStripe, and it exists for the same reason:
 * cancellation decided what to do from the local row alone, and the local row
 * can be behind Stripe in both directions. A refund that succeeded and whose
 * row write then failed left the row reading CAPTURED, so the next attempt
 * refunded a charge Stripe had already fully refunded, was refused, and came
 * back as a flat 500 — for ever, because nothing ever moved the row. A buyer
 * pressing "cancel" on an order she had already been refunded for would be
 * told the cancellation had failed, on every attempt, while her money was
 * already back on her card.
 *
 * `already_returned` is that case: the money is where it should be and only the
 * row is behind, which is the whole of the work left to do. `refundable` and
 * `cancelable` are the two ordinary paths, told apart by Stripe rather than by
 * the row, so a capture whose row write failed is still refunded rather than
 * being sent to paymentIntents.cancel, which Stripe refuses on a succeeded
 * intent.
 */
async function readReturnStateAtStripe(
  paymentIntentId: string
): Promise<{ state: 'already_returned'; as: 'refunded' | 'canceled' } | { state: 'refundable' } | { state: 'cancelable' }> {
  const intent = await getStripe().paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge'],
  });

  if (intent.status === 'canceled') {
    return { state: 'already_returned', as: 'canceled' };
  }

  if (intent.status === 'succeeded') {
    // `latest_charge` is a bare id unless it is expanded, which is why the
    // retrieve above asks for it. Without the expansion there is no way to see
    // that a charge has already been given back, and the double refund this
    // whole function exists to prevent goes ahead.
    const charge = intent.latest_charge;
    const refunded =
      charge !== null && typeof charge === 'object' ? charge.refunded : false;

    return refunded ? { state: 'already_returned', as: 'refunded' } : { state: 'refundable' };
  }

  return { state: 'cancelable' };
}

/**
 * Cancel/refund escrowed payment (if service not delivered or disputed)
 */
export async function cancelEscrowPayment(
  paymentIntentId: string,
  actor: EscrowActor,
  reason?: string
): Promise<{ status: string }> {
  const escrow = await prisma.escrowPayment.findUnique({
    where: { paymentIntentId },
  });

  if (!escrow) {
    throw new ApiError(404, 'Escrow payment not found');
  }

  assertEscrowParty(escrow, actor, 'either');

  if (escrow.status === 'REFUNDED' || escrow.status === 'CANCELED') {
    throw new ApiError(400, 'Payment already canceled or refunded');
  }

  if (canUseMockStripe('Canceling an escrow payment')) {
    await prisma.escrowPayment.update({
      where: { paymentIntentId },
      data: { status: 'CANCELED', canceledAt: new Date(), cancelReason: reason },
    });

    return { status: 'canceled' };
  }

  const at = await readReturnStateAtStripe(paymentIntentId);

  if (at.state === 'already_returned') {
    // Nothing is asked of Stripe. The money has already gone back and the row
    // is simply behind it; repairing the row is the entire remaining job, and
    // reporting a failure here would send the buyer round the same loop again.
    await recordEscrowReturn(paymentIntentId, at.as, reason, escrow.id);

    logger.warn('Escrow row was behind Stripe: the hold had already been given back', {
      paymentIntentId,
      escrowId: escrow.id,
      as: at.as,
    });

    return { status: at.as };
  }

  try {
    if (at.state === 'refundable') {
      await getStripe().refunds.create(
        {
          payment_intent: paymentIntentId,
          reason: 'requested_by_customer',
        },
        {
          // Derived from the escrow row rather than generated, so that two
          // presses of the same cancel button inside Stripe's idempotency
          // window are one refund rather than two. The read above is what
          // covers the same two presses a week apart; this covers the two that
          // arrive together, which is the far more likely pair.
          idempotencyKey: `escrow-refund-${escrow.id}`,
        }
      );
    } else {
      await getStripe().paymentIntents.cancel(paymentIntentId);
    }
  } catch (error) {
    logger.error('Failed to cancel escrow payment', { error, paymentIntentId });
    throw new ApiError(500, 'Failed to cancel payment');
  }

  const as = at.state === 'refundable' ? 'refunded' : 'canceled';

  try {
    await recordEscrowReturn(paymentIntentId, as, reason, escrow.id);
  } catch (error) {
    // The money has already gone back. Failing the request here would tell the
    // buyer her cancellation did not happen when it did, and the row would stay
    // CAPTURED while her card had been credited — which is how the double
    // refund used to become possible. The row is repaired instead on the next
    // attempt, by the already_returned branch above, and the ids are logged so
    // it can be found before anyone gets that far.
    logger.error('Returned an escrow hold but could not record it', {
      error,
      paymentIntentId,
      escrowId: escrow.id,
      as,
    });
  }

  return { status: as };
}

/** The one place the row is moved to its final returned state, so the repair path and the ordinary path cannot drift. */
async function recordEscrowReturn(
  paymentIntentId: string,
  as: 'refunded' | 'canceled',
  reason: string | undefined,
  escrowId: string
): Promise<void> {
  await prisma.escrowPayment.update({
    where: { paymentIntentId },
    data: {
      status: as === 'refunded' ? 'REFUNDED' : 'CANCELED',
      canceledAt: new Date(),
      cancelReason: reason,
    },
  });

  logger.info('Escrow hold returned to the buyer', { paymentIntentId, escrowId, as });
}

/**
 * What became of a hold that has outlived its card authorisation.
 *
 * - `captured`: the money reached the seller and only the row was behind; the
 *   row now says CAPTURED.
 * - `expired`: Stripe cancelled the intent, which is what it does when an
 *   authorisation lapses uncaptured; the row now says CANCELED, with the reason.
 * - `still_held`: Stripe still holds a capturable authorisation (some cards
 *   allow longer than seven days), or Stripe could not be asked here.
 * - `unpaid`: the buyer never put a card behind it, so there was never money to
 *   lose.
 *
 * `changed` is false when the row had already left the held statuses by the
 * time this wrote, because a release or a cancellation got there first; the
 * caller then has nothing new to tell anyone.
 */
export type LapsedHoldOutcome =
  | { state: 'captured' | 'expired'; changed: boolean }
  | { state: 'still_held' | 'unpaid' };

/**
 * Brings a hold that has outlived its authorisation into line with Stripe.
 *
 * Before this, nothing ever moved such a row: it stayed PENDING or AUTHORIZED
 * for good, the expiry sweep found it again every six hours, and it was
 * reported to admins as a lapsed hold whose funds "may no longer be
 * collectable" — including the ones whose capture had in fact succeeded and
 * only the row update had failed, so the seller had been paid and the platform
 * was saying she might not be. Each is now asked about once at Stripe and
 * settled into the state that is actually true.
 *
 * Both writes are conditional on the row still being held, so a release or a
 * cancellation that lands at the same moment is not overwritten.
 */
export async function resolveLapsedEscrowHold(paymentIntentId: string): Promise<LapsedHoldOutcome> {
  if (!isStripeConfigured()) {
    return { state: 'still_held' };
  }

  const intent = await getStripe().paymentIntents.retrieve(paymentIntentId);

  if (intent.status === 'succeeded') {
    const { count } = await prisma.escrowPayment.updateMany({
      where: { paymentIntentId, status: { in: HELD_STATUSES } },
      data: { status: 'CAPTURED', capturedAt: new Date() },
    });
    if (count > 0) {
      logger.warn('Escrow row was behind Stripe: a hold reported as lapsed had been captured', {
        paymentIntentId,
        amountCaptured: intent.amount_received,
      });
    }
    return { state: 'captured', changed: count > 0 };
  }

  if (intent.status === 'canceled') {
    const reason =
      intent.cancellation_reason === 'automatic'
        ? 'The card authorisation lapsed before the payment was released'
        : `Cancelled at Stripe (${intent.cancellation_reason ?? 'no reason given'})`;

    const { count } = await prisma.escrowPayment.updateMany({
      where: { paymentIntentId, status: { in: HELD_STATUSES } },
      data: {
        status: 'CANCELED',
        canceledAt: intent.canceled_at ? new Date(intent.canceled_at * 1000) : new Date(),
        cancelReason: reason,
      },
    });
    return { state: 'expired', changed: count > 0 };
  }

  if (intent.status === 'requires_capture') {
    return { state: 'still_held' };
  }

  return { state: 'unpaid' };
}

/** Holds where the money has moved to the seller. */
const EARNED_STATUSES = ['CAPTURED'];
/** Holds where the money exists but has not moved yet. */
const HELD_STATUSES = ['PENDING', 'AUTHORIZED'];

export interface EarningsByCurrency {
  currency: string;
  totalEarnings: number;
  pendingPayouts: number;
  /** How many holds in this currency have been captured, over every row she has. */
  completedCount: number;
}

/** One month of captured earnings in one currency, for the earnings chart. */
export interface EarningsMonth {
  /** `YYYY-MM`, in Queensland time. */
  month: string;
  currency: string;
  /** Net of the platform fee, in minor units. */
  earnings: number;
  /** How many holds were captured that month. */
  count: number;
}

/** How far back the monthly series reaches. The chart says so; it is not "all time". */
export const EARNINGS_SERIES_MONTHS = 12;

// Queensland keeps AEST all year, with no daylight saving, so a fixed offset is
// exact. Bucketing by UTC instead would put a session paid at 9am on the 1st
// into the previous month.
const QUEENSLAND_OFFSET_MS = 10 * 60 * 60 * 1000;

function queenslandMonth(date: Date): string {
  return new Date(date.getTime() + QUEENSLAND_OFFSET_MS).toISOString().slice(0, 7);
}

/** Midnight on the first of the month EARNINGS_SERIES_MONTHS - 1 months ago, Queensland time. */
function earningsSeriesStart(now: Date): Date {
  const local = new Date(now.getTime() + QUEENSLAND_OFFSET_MS);
  const startLocal = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth() - (EARNINGS_SERIES_MONTHS - 1),
    1
  );
  return new Date(startLocal - QUEENSLAND_OFFSET_MS);
}

export interface EarningsDashboard {
  /** The currency the flat totals below are counted in. */
  currency: string;
  /** Net of the platform fee, over every hold she has ever had in `currency`. */
  totalEarnings: number;
  pendingPayouts: number;
  /**
   * Null, not zero, when Stripe could not be asked. A member whose balance
   * lookup failed has not been told she has no money; she has been told we do
   * not know, and `balanceUnavailable` is what says which of the two it is.
   */
  availableBalance: number | null;
  balanceUnavailable: boolean;
  /** Every currency she has earned in, including the one above. */
  byCurrency: EarningsByCurrency[];
  /**
   * Captured earnings by month over the last EARNINGS_SERIES_MONTHS months,
   * every currency, oldest first. Months with nothing captured are absent.
   *
   * The chart and the "Total Sessions" count used to be derived on the client
   * from `recentTransactions`, which is twenty rows long, so both capped out at
   * twenty for exactly the mentors who had done the most work. They are counted
   * here from the rows themselves.
   */
  monthly: EarningsMonth[];
  recentTransactions: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    description: string | null;
    createdAt: Date;
    capturedAt: Date | null;
  }[];
}

/**
 * Get seller's earnings dashboard data.
 *
 * Both totals used to be reduced out of the same twenty rows the recent-activity
 * list was drawn from, so "total earnings" quietly meant "earnings from my last
 * twenty transactions" and shrank as a mentor did more work — the successful
 * sellers were the ones it lied to. They are counted here by the database over
 * every row, grouped by currency, because the reduce also added AUD cents to USD
 * cents and called the result one number. The Stripe balance had the same defect
 * on its own side, summing every currency bucket the connected account held.
 */
export async function getEarningsDashboard(userId: string): Promise<EarningsDashboard> {
  const connectedAccountId = await resolveConnectedAccountId(userId);

  const [totals, recent, captured] = await Promise.all([
    prisma.escrowPayment.groupBy({
      by: ['currency', 'status'],
      where: { sellerId: userId, status: { in: [...EARNED_STATUSES, ...HELD_STATUSES] } },
      _sum: { amount: true, platformFee: true },
      _count: { _all: true },
    }),
    prisma.escrowPayment.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    // Only the columns the series needs, and only inside its window, so this
    // stays small however long she has been selling.
    prisma.escrowPayment.findMany({
      where: {
        sellerId: userId,
        status: { in: EARNED_STATUSES },
        capturedAt: { gte: earningsSeriesStart(new Date()) },
      },
      select: { amount: true, platformFee: true, currency: true, capturedAt: true },
    }),
  ]);

  const byCurrencyMap = new Map<string, EarningsByCurrency>();

  for (const group of totals) {
    const currency = group.currency.toUpperCase();
    const row =
      byCurrencyMap.get(currency) ??
      { currency, totalEarnings: 0, pendingPayouts: 0, completedCount: 0 };
    const net = (group._sum.amount ?? 0) - (group._sum.platformFee ?? 0);

    if (EARNED_STATUSES.includes(group.status)) {
      row.totalEarnings += net;
      row.completedCount += group._count?._all ?? 0;
    } else {
      row.pendingPayouts += net;
    }

    byCurrencyMap.set(currency, row);
  }

  const monthlyMap = new Map<string, EarningsMonth>();
  for (const row of captured) {
    if (!row.capturedAt) continue;
    const month = queenslandMonth(row.capturedAt);
    const currency = row.currency.toUpperCase();
    const key = `${month}|${currency}`;
    const bucket = monthlyMap.get(key) ?? { month, currency, earnings: 0, count: 0 };
    bucket.earnings += row.amount - row.platformFee;
    bucket.count += 1;
    monthlyMap.set(key, bucket);
  }
  const monthly = [...monthlyMap.values()].sort(
    (a, b) => a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency)
  );

  const byCurrency = [...byCurrencyMap.values()].sort(
    (a, b) => b.totalEarnings + b.pendingPayouts - (a.totalEarnings + a.pendingPayouts)
  );

  // The currency the headline figures are in: whichever she has the most money
  // in, and AUD for a member with no holds at all, this being a Queensland
  // platform. `byCurrency` carries the rest so nothing is hidden by the choice.
  const primary = byCurrency[0]?.currency ?? 'AUD';
  const primaryTotals = byCurrencyMap.get(primary);

  let availableBalance: number | null = null;
  let balanceUnavailable = false;

  if (isStripeConfigured() && connectedAccountId) {
    try {
      const balance = await getStripe().balance.retrieve({
        stripeAccount: connectedAccountId,
      });

      availableBalance = balance.available
        .filter((b) => b.currency.toUpperCase() === primary)
        .reduce((sum, b) => sum + b.amount, 0);
    } catch (error) {
      // Left null rather than zero. Reporting zero here told a mentor during a
      // Stripe outage that she had no money, which is a different and much
      // worse statement than "we could not check".
      balanceUnavailable = true;
      logger.warn('Failed to fetch Stripe balance', { error, userId });
    }
  } else if (connectedAccountId) {
    // No Stripe key in this environment: there is no balance to report, and
    // saying so is better than showing a zero the member would read as real.
    balanceUnavailable = true;
  } else {
    // No connected account yet, so nothing is being held for her anywhere. That
    // genuinely is zero.
    availableBalance = 0;
  }

  return {
    currency: primary,
    totalEarnings: primaryTotals?.totalEarnings ?? 0,
    pendingPayouts: primaryTotals?.pendingPayouts ?? 0,
    availableBalance,
    balanceUnavailable,
    byCurrency,
    monthly,
    recentTransactions: recent.map((p) => ({
      id: p.id,
      amount: p.amount - p.platformFee,
      currency: p.currency.toUpperCase(),
      status: p.status,
      description: p.description,
      createdAt: p.createdAt,
      capturedAt: p.capturedAt,
    })),
  };
}

/**
 * Currencies Stripe counts in whole units, with no cents at all. A payout of
 * ¥1,500 is sent to Stripe as 1500, not 150000.
 * https://docs.stripe.com/currencies#zero-decimal
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
  'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

/**
 * Currencies with three decimal places, which Stripe accepts only in multiples
 * of ten of their smallest unit. ATHENA pays nobody in these, and getting the
 * rounding rule half right would move the wrong amount, so they are refused
 * rather than guessed at.
 */
const THREE_DECIMAL_CURRENCIES = new Set(['bhd', 'jod', 'kwd', 'omr', 'tnd']);

/**
 * How many of a currency's smallest unit make one whole unit, as Stripe counts
 * them: 100 cents to the dollar, 1 yen to the yen, 1000 fils to the dinar.
 */
export function minorUnitScale(currency: string): number {
  const code = currency.trim().toLowerCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 1;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 1000;
  return 100;
}

/**
 * A major-unit amount (dollars) as the integer Stripe expects (cents).
 *
 * Refuses rather than rounds an amount finer than the currency can hold: a
 * payout is money leaving a member's balance, and quietly paying her 10.01 when
 * she asked for 10.005 is a decision she did not make. The route already rounds
 * to two places, so in practice this fires for a zero-decimal currency given
 * cents (¥1,500.50), or for a caller that skipped the route's rounding.
 */
export function payoutAmountInMinorUnits(amount: number, currency: string): number {
  const code = currency.trim().toLowerCase();

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, 'Enter an amount greater than zero');
  }
  if (THREE_DECIMAL_CURRENCIES.has(code)) {
    throw new ApiError(400, `Payouts in ${code.toUpperCase()} are not supported`);
  }

  const scale = minorUnitScale(code);
  const scaled = amount * scale;
  const minor = Math.round(scaled);

  // Floating point makes 123.45 * 100 come out as 12345.000000000002, so
  // "exactly an integer" is tested with a tolerance far below one cent.
  if (Math.abs(scaled - minor) > 1e-6) {
    throw new ApiError(
      400,
      scale === 1
        ? `${code.toUpperCase()} has no cents; enter a whole amount`
        : 'Enter an amount in whole cents'
    );
  }
  if (minor < 1) {
    throw new ApiError(400, 'Enter an amount greater than zero');
  }

  return minor;
}

/** Whether a Stripe failure was the connected account not holding enough to cover the payout. */
function isInsufficientBalance(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'balance_insufficient'
  );
}

/**
 * Initiate manual payout to connected account.
 *
 * Takes `input.amount` in major units (see PayoutInput) and returns what was
 * actually asked of Stripe, in minor units and lower-case currency, so a caller
 * or a test can see the number that left rather than the number that was typed.
 */
export async function createPayout(
  input: PayoutInput
): Promise<{ payoutId: string; status: string; amount: number; currency: string }> {
  const currency = input.currency.trim().toLowerCase();
  // Converted before the mock branch as well, so a unit mistake fails on a
  // developer's machine instead of first showing up against a live account.
  const amount = payoutAmountInMinorUnits(input.amount, currency);

  if (canUseMockStripe('Creating a Stripe payout')) {
    return { payoutId: `po_mock_${Date.now()}`, status: 'pending', amount, currency };
  }

  try {
    const payout = await getStripe().payouts.create(
      {
        amount,
        currency,
        description: input.description,
      },
      {
        stripeAccount: input.connectedAccountId,
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      }
    );

    return { payoutId: payout.id, status: payout.status, amount: payout.amount, currency: payout.currency };
  } catch (error) {
    // Asking for more than the account holds is the member's to fix — she can
    // enter a smaller amount — so it is a 400 that says so, not the generic 500
    // that told her something had broken.
    if (isInsufficientBalance(error)) {
      throw new ApiError(
        400,
        `Your available ${currency.toUpperCase()} balance is less than that amount`
      );
    }
    logger.error('Failed to create payout', {
      error,
      connectedAccountId: input.connectedAccountId,
      amount,
      currency,
    });
    throw new ApiError(500, 'Failed to create payout');
  }
}

// ===========================================
// PAYOUT METHODS
// ===========================================

export interface PayoutMethod {
  id: string;
  type: 'bank' | 'card';
  name: string;
  last4: string | null;
  currency: string | null;
  isDefault: boolean;
}

// Resolves the caller's connected account, or explains what they need to do
// first. Every payout-method operation needs this.
export async function requireConnectedAccountId(userId: string): Promise<string> {
  const accountId = await resolveConnectedAccountId(userId);

  if (!accountId) {
    throw new ApiError(409, 'Connect a payout account before managing payout methods');
  }

  return accountId;
}

/**
 * Payout destinations for a connected account.
 *
 * These live in Stripe as the account's external accounts, not in our database
 * — Stripe holds the bank and card details and we must not. `isDefault` is
 * Stripe's `default_for_currency`, which is per-currency: an account paid in
 * more than one currency has one default per currency, not one overall.
 */
export async function listPayoutMethods(userId: string): Promise<PayoutMethod[]> {
  if (canUseMockStripe('Listing payout methods')) {
    return [
      {
        id: 'ba_mock_default',
        type: 'bank',
        name: 'Mock Bank ****4321',
        last4: '4321',
        currency: 'aud',
        isDefault: true,
      },
    ];
  }

  const accountId = await requireConnectedAccountId(userId);

  try {
    const external = await getStripe().accounts.listExternalAccounts(accountId, { limit: 100 });

    return external.data.map((account) => {
      const isBank = account.object === 'bank_account';
      const bank = account as { bank_name?: string; last4?: string };
      const card = account as { brand?: string; last4?: string };

      return {
        id: account.id,
        type: isBank ? 'bank' : 'card',
        name: isBank
          ? `${bank.bank_name || 'Bank account'} ****${bank.last4 || ''}`.trim()
          : `${card.brand || 'Card'} ****${card.last4 || ''}`.trim(),
        last4: (isBank ? bank.last4 : card.last4) ?? null,
        currency: (account as { currency?: string }).currency ?? null,
        isDefault: Boolean((account as { default_for_currency?: boolean }).default_for_currency),
      };
    });
  } catch (error) {
    logger.error('Failed to list payout methods', { error, userId });
    throw new ApiError(500, 'Failed to list payout methods');
  }
}

/**
 * Makes one payout method the default for its currency.
 *
 * Stripe clears the flag on the previously default account for that currency,
 * so there is no second call to unset the old one.
 */
export async function setDefaultPayoutMethod(
  userId: string,
  payoutMethodId: string
): Promise<PayoutMethod> {
  if (canUseMockStripe('Setting the default payout method')) {
    return {
      id: payoutMethodId,
      type: 'bank',
      name: 'Mock Bank ****4321',
      last4: '4321',
      currency: 'aud',
      isDefault: true,
    };
  }

  const accountId = await requireConnectedAccountId(userId);

  // Checked against the account's own external accounts first, so one user
  // cannot point at an id belonging to somebody else's connected account.
  const owned = await listPayoutMethods(userId);
  if (!owned.some((method) => method.id === payoutMethodId)) {
    throw new ApiError(404, 'Payout method not found');
  }

  try {
    const updated = await getStripe().accounts.updateExternalAccount(accountId, payoutMethodId, {
      default_for_currency: true,
    });

    const isBank = updated.object === 'bank_account';
    const bank = updated as { bank_name?: string; last4?: string };
    const card = updated as { brand?: string; last4?: string };

    return {
      id: updated.id,
      type: isBank ? 'bank' : 'card',
      name: isBank
        ? `${bank.bank_name || 'Bank account'} ****${bank.last4 || ''}`.trim()
        : `${card.brand || 'Card'} ****${card.last4 || ''}`.trim(),
      last4: (isBank ? bank.last4 : card.last4) ?? null,
      currency: (updated as { currency?: string }).currency ?? null,
      isDefault: true,
    };
  } catch (error) {
    logger.error('Failed to set default payout method', { error, userId, payoutMethodId });
    throw new ApiError(500, 'Failed to set default payout method');
  }
}

export const stripeConnectService = {
  createConnectedAccount,
  getOnboardingLink,
  listPayoutMethods,
  setDefaultPayoutMethod,
  getAccountStatus,
  createEscrowPayment,
  captureEscrowPayment,
  cancelEscrowPayment,
  getEarningsDashboard,
  createPayout,
  requireConnectedAccountId,
  resolveConnectedAccountId,
  refreshConnectedAccount,
  syncConnectedAccountFromStripe,
};
