import Stripe from 'stripe';
import { User, PrismaClient, Subscription } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

type UserWithSubscription = User & { subscription: Subscription | null };

class PaymentService {
  private stripe: Stripe | null = null;
  private isEnabled: boolean = false;

  constructor() {
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
      });
      this.isEnabled = true;
    } else {
      logger.warn('STRIPE_SECRET_KEY not found. Payment features will be simulated or disabled.');
    }
  }

  async createCustomer(user: UserWithSubscription) {
    if (!this.isEnabled || !this.stripe) {
        // Return dummy ID if Stripe is not configured
        return `cus_simulated_${user.id}`;
    }

    try {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          userId: user.id,
        },
      });

      // Update subscription with Stripe Customer ID
      if (user.subscription) {
        await prisma.subscription.update({
          where: { id: user.subscription.id },
          data: { stripeCustomerId: customer.id },
        });
      } else {
        await prisma.subscription.create({
          data: {
            userId: user.id,
            stripeCustomerId: customer.id,
            tier: 'FREE',
          },
        });
      }

      return customer.id;
    } catch (error) {
      logger.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  async createCheckoutSession(userId: string, priceId: string, returnUrl: string) {
    if (!this.isEnabled || !this.stripe) {
      // Simulate a success URL for dev testing without Stripe
      return { url: `${returnUrl}?session_id=simulated_session` };
    }

    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      include: { subscription: true }
    });
    if (!user) throw new Error('User not found');

    let customerId = user.subscription?.stripeCustomerId;

    if (!customerId) {
        customerId = await this.createCustomer(user);
    }

    try {
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: returnUrl,
        metadata: {
            userId: user.id,
        }
      });

      return { url: session.url };
    } catch (error) {
      logger.error('Error creating checkout session:', error);
      throw error;
    }
  }

  async createPortalSession(userId: string, returnUrl: string) {
     if (!this.isEnabled || !this.stripe) {
         return { url: returnUrl };
     }

     const user = await prisma.user.findUnique({ 
       where: { id: userId },
       include: { subscription: true }
     });
     
     if (!user || !user.subscription?.stripeCustomerId) throw new Error('User or Stripe Customer not found');

     try {
         const session = await this.stripe.billingPortal.sessions.create({
             customer: user.subscription.stripeCustomerId,
             return_url: returnUrl,
         });
         return { url: session.url };
     } catch (error) {
         logger.error('Error creating portal session:', error);
         throw error;
     }
  }

  async getSubscription(userId: string) {
      // In a real implementation, we would fetch from DB or Stripe
      // For now, we rely on the webhook to have updated the user record in the DB
      // So we just return what's in the DB usually, or fetch from Stripe for fresh data.
      
      const user = await prisma.user.findUnique({ 
        where: { id: userId },
        include: { subscription: true }
      });
      if(!user) return null;

      const hasStripeId = user.subscription?.stripeCustomerId;

      if (!this.isEnabled || !this.stripe || !hasStripeId) {
          const tier = user.subscription?.tier || 'FREE';
          const isPro = tier !== 'FREE';
          
          return {
              status: isPro ? 'active' : 'inactive', 
              plan: tier,
              current_period_end: new Date(Date.now() + 86400000).toISOString() // Fake date
          };
      }

      // If we have stripe, we might want to list subscriptions
      const subscriptions = await this.stripe.subscriptions.list({
          customer: hasStripeId,
          status: 'active',
          limit: 1
      });

      if (subscriptions.data.length === 0) {
           return { status: 'inactive', plan: 'FREE' };
      }

      const sub = subscriptions.data[0];
      return {
          id: sub.id,
          status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          plan: 'PREMIUM_CAREER' // Using a valid Enum value instead of 'PRO'
      };
  }

  // Webhook handler would go here (requires raw body parsing in express)
}

export const paymentService = new PaymentService();
