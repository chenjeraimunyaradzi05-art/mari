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

export interface ConnectedAccountInput {
  userId: string;
  email: string;
  country: string;
  type: 'mentor' | 'creator';
  businessType?: 'individual' | 'company';
}

export interface PayoutInput {
  connectedAccountId: string;
  amount: number; // in cents
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
      onboardingUrl: `${process.env.CLIENT_URL}/dashboard/payments/mock-onboarding`,
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
    return `${process.env.CLIENT_URL}/dashboard/payments/mock-onboarding`;
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

  try {
    // Create payment intent with manual capture (escrow)
    const paymentIntent = await getStripe().paymentIntents.create({
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

    // Store escrow record in database
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
    logger.error('Failed to create escrow payment', { error, input });
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

  try {
    const paymentIntent = await getStripe().paymentIntents.capture(paymentIntentId);

    await prisma.escrowPayment.update({
      where: { paymentIntentId },
      data: { status: 'CAPTURED', capturedAt: new Date() },
    });

    logger.info('Captured escrow payment', { paymentIntentId, amount: escrow.amount });

    return {
      status: paymentIntent.status,
      amountCaptured: paymentIntent.amount_received,
    };
  } catch (error) {
    logger.error('Failed to capture escrow payment', { error, paymentIntentId });
    throw new ApiError(500, 'Failed to capture payment');
  }
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

  try {
    // If captured, refund; if not captured, cancel
    if (escrow.status === 'CAPTURED') {
      await getStripe().refunds.create({
        payment_intent: paymentIntentId,
        reason: 'requested_by_customer',
      });

      await prisma.escrowPayment.update({
        where: { paymentIntentId },
        data: { status: 'REFUNDED', canceledAt: new Date(), cancelReason: reason },
      });

      return { status: 'refunded' };
    } else {
      await getStripe().paymentIntents.cancel(paymentIntentId);

      await prisma.escrowPayment.update({
        where: { paymentIntentId },
        data: { status: 'CANCELED', canceledAt: new Date(), cancelReason: reason },
      });

      return { status: 'canceled' };
    }
  } catch (error) {
    logger.error('Failed to cancel escrow payment', { error, paymentIntentId });
    throw new ApiError(500, 'Failed to cancel payment');
  }
}

/**
 * Get seller's earnings dashboard data
 */
export async function getEarningsDashboard(userId: string): Promise<{
  totalEarnings: number;
  pendingPayouts: number;
  availableBalance: number;
  recentTransactions: any[];
}> {
  const connectedAccountId = await resolveConnectedAccountId(userId);

  // Get escrow payments where user is seller
  const escrowPayments = await prisma.escrowPayment.findMany({
    where: { sellerId: userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const totalEarnings = escrowPayments
    .filter((p) => p.status === 'CAPTURED')
    .reduce((sum, p) => sum + (p.amount - p.platformFee), 0);

  const pendingPayouts = escrowPayments
    .filter((p) => p.status === 'PENDING' || p.status === 'AUTHORIZED')
    .reduce((sum, p) => sum + (p.amount - p.platformFee), 0);

  let availableBalance = 0;

  if (isStripeConfigured() && connectedAccountId) {
    try {
      const balance = await getStripe().balance.retrieve({
        stripeAccount: connectedAccountId,
      });

      availableBalance = balance.available.reduce(
        (sum, b) => sum + b.amount,
        0
      );
    } catch (error) {
      logger.warn('Failed to fetch Stripe balance', { error, userId });
    }
  }

  return {
    totalEarnings,
    pendingPayouts,
    availableBalance,
    recentTransactions: escrowPayments.map((p) => ({
      id: p.id,
      amount: p.amount - p.platformFee,
      status: p.status,
      description: p.description,
      createdAt: p.createdAt,
      capturedAt: p.capturedAt,
    })),
  };
}

/**
 * Initiate manual payout to connected account
 */
export async function createPayout(input: PayoutInput): Promise<{ payoutId: string; status: string }> {
  if (canUseMockStripe('Creating a Stripe payout')) {
    return { payoutId: `po_mock_${Date.now()}`, status: 'pending' };
  }

  try {
    const payout = await getStripe().payouts.create(
      {
        amount: input.amount,
        currency: input.currency,
        description: input.description,
      },
      {
        stripeAccount: input.connectedAccountId,
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      }
    );

    return { payoutId: payout.id, status: payout.status };
  } catch (error) {
    logger.error('Failed to create payout', { error, input });
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
