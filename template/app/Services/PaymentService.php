<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Plan;
use App\Models\UserPlan;
use App\Models\Company;
use Illuminate\Support\Facades\Log;
use Stripe\Stripe;
use Stripe\Checkout\Session as StripeSession;
use Stripe\Webhook;
use Srmklive\PayPal\Services\PayPal as PayPalClient;

final class PaymentService
{
    /**
     * Initialize Stripe
     */
    private function initializeStripe(): void
    {
        Stripe::setApiKey(config('services.stripe.secret'));
    }

    /**
     * Create Stripe checkout session
     *
     * @param Plan $plan
     * @param Company $company
     * @param string $paymentType (subscription|one_time)
     *
     * @return (bool|mixed|null|string)[]
     *
     * @psalm-return array{success: bool, error?: string, session_id?: string, order_id?: mixed, checkout_url?: null|string}
     */
    public function createStripeSession(Plan $plan, Company $company, string $paymentType = 'subscription'): array
    {
        $this->initializeStripe();

        try {
            $lineItems = [[
                'price_data' => [
                    'currency' => 'usd',
                    'product_data' => [
                        'name' => $plan->label,
                        'description' => $plan->description,
                    ],
                    'unit_amount' => $plan->price * 100, // Convert to cents
                    'recurring' => $paymentType === 'subscription' ? [
                        'interval' => 'month',
                        'interval_count' => 1,
                    ] : null,
                ],
                'quantity' => 1,
            ]];

            $sessionParams = [
                'payment_method_types' => ['card'],
                'line_items' => $lineItems,
                'mode' => $paymentType === 'subscription' ? 'subscription' : 'payment',
                'success_url' => route('company.paymentSuccess') . '?session_id={CHECKOUT_SESSION_ID}',
                'cancel_url' => route('company.paymentCancel'),
                'client_reference_id' => $company->id,
                'metadata' => [
                    'company_id' => $company->id,
                    'plan_id' => $plan->id,
                    'payment_type' => $paymentType,
                ],
            ];

            $session = StripeSession::create($sessionParams);

            // Create pending order
            $order = Order::create([
                'company_id' => $company->id,
                'plan_id' => $plan->id,
                'payment_provider' => 'stripe',
                'payment_id' => $session->id,
                'amount' => $plan->price,
                'payment_status' => 'pending',
            ]);

            return [
                'success' => true,
                'session_id' => $session->id,
                'order_id' => $order->id,
                'checkout_url' => $session->url,
            ];

        } catch (\Exception $e) {
            Log::error('Stripe session creation failed', [
                'error' => $e->getMessage(),
                'company_id' => $company->id,
                'plan_id' => $plan->id,
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Handle Stripe webhook
     *
     * @param string $payload
     * @param string $signature
     *
     * @return (bool|string)[]
     *
     * @psalm-return array{success: bool, error?: string}
     */
    public function handleStripeWebhook(string $payload, string $signature): array
    {
        $this->initializeStripe();
        $endpointSecret = config('services.stripe.webhook_secret');

        try {
            $event = Webhook::constructEvent($payload, $signature, $endpointSecret);

            switch ($event->type) {
                case 'checkout.session.completed':
                    $this->handleStripeCheckoutCompleted($event->data->object);
                    break;

                case 'customer.subscription.created':
                    $this->handleStripeSubscriptionCreated($event->data->object);
                    break;

                case 'customer.subscription.updated':
                    $this->handleStripeSubscriptionUpdated($event->data->object);
                    break;

                case 'customer.subscription.deleted':
                    $this->handleStripeSubscriptionCancelled($event->data->object);
                    break;

                case 'invoice.payment_succeeded':
                    $this->handleStripeInvoicePaid($event->data->object);
                    break;

                case 'invoice.payment_failed':
                    $this->handleStripeInvoiceFailed($event->data->object);
                    break;

                default:
                    Log::info('Unhandled Stripe webhook event', ['type' => $event->type]);
            }

            return ['success' => true];

        } catch (\Exception $e) {
            Log::error('Stripe webhook failed', ['error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Handle Stripe checkout completed
     */
    private function handleStripeCheckoutCompleted($session): void
    {
        $order = Order::where('payment_id', $session->id)->first();

        if ($order) {
            $order->update([
                'payment_status' => 'paid',
                'transaction_id' => $session->payment_intent,
            ]);

            // Activate user plan
            $this->activateUserPlan($order);

            Log::info('Stripe payment completed', ['order_id' => $order->id]);
        }
    }

    /**
     * Handle subscription created
     */
    private function handleStripeSubscriptionCreated($subscription): void
    {
        $companyId = $subscription->metadata->company_id ?? null;

        if ($companyId) {
            $company = Company::find($companyId);
            if ($company) {
                $company->update(['stripe_subscription_id' => $subscription->id]);
                Log::info('Stripe subscription created', ['company_id' => $companyId]);
            }
        }
    }

    /**
     * Handle subscription updated
     */
    private function handleStripeSubscriptionUpdated($subscription): void
    {
        Log::info('Stripe subscription updated', ['subscription_id' => $subscription->id]);
    }

    /**
     * Handle subscription cancelled
     */
    private function handleStripeSubscriptionCancelled($subscription): void
    {
        $company = Company::where('stripe_subscription_id', $subscription->id)->first();

        if ($company) {
            $userPlan = UserPlan::where('company_id', $company->id)
                ->where('is_active', 1)
                ->first();

            if ($userPlan) {
                $userPlan->update(['is_active' => 0]);
                Log::info('Subscription cancelled', ['company_id' => $company->id]);
            }
        }
    }

    /**
     * Handle invoice paid
     */
    private function handleStripeInvoicePaid($invoice): void
    {
        Log::info('Stripe invoice paid', ['invoice_id' => $invoice->id]);
    }

    /**
     * Handle invoice failed
     */
    private function handleStripeInvoiceFailed($invoice): void
    {
        Log::error('Stripe invoice payment failed', ['invoice_id' => $invoice->id]);
    }

    /**
     * Create PayPal payment
     *
     * @param Plan $plan
     * @param Company $company
     *
     * @return (bool|mixed|null|string)[]
     *
     * @psalm-return array{success: bool, error?: string, order_id?: mixed, paypal_order_id?: mixed, approval_url?: mixed|null}
     */
    public function createPayPalPayment(Plan $plan, Company $company): array
    {
        try {
            $provider = new PayPalClient;
            $provider->setApiCredentials(config('paypal'));
            $token = $provider->getAccessToken();
            $provider->setAccessToken($token);

            // Create order
            $order = Order::create([
                'company_id' => $company->id,
                'plan_id' => $plan->id,
                'payment_provider' => 'paypal',
                'amount' => $plan->price,
                'payment_status' => 'pending',
            ]);

            $orderData = [
                'intent' => 'CAPTURE',
                'purchase_units' => [[
                    'reference_id' => $order->id,
                    'amount' => [
                        'currency_code' => 'USD',
                        'value' => number_format($plan->price, 2, '.', ''),
                    ],
                    'description' => $plan->label,
                ]],
                'application_context' => [
                    'return_url' => route('company.paypal.success'),
                    'cancel_url' => route('company.paypal.cancel'),
                    'brand_name' => config('app.name'),
                    'shipping_preference' => 'NO_SHIPPING',
                ],
            ];

            $response = $provider->createOrder($orderData);

            if (isset($response['id'])) {
                $order->update(['payment_id' => $response['id']]);

                // Get approval link
                $approvalLink = collect($response['links'])->firstWhere('rel', 'approve');

                return [
                    'success' => true,
                    'order_id' => $order->id,
                    'paypal_order_id' => $response['id'],
                    'approval_url' => $approvalLink['href'] ?? null,
                ];
            }

            return ['success' => false, 'error' => 'PayPal order creation failed'];

        } catch (\Exception $e) {
            Log::error('PayPal payment creation failed', [
                'error' => $e->getMessage(),
                'company_id' => $company->id,
            ]);

            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Capture PayPal payment
     *
     * @param string $paypalOrderId
     *
     * @return (Order|bool|string)[]
     *
     * @psalm-return array{success: bool, error?: string, order?: Order}
     */
    public function capturePayPalPayment(string $paypalOrderId): array
    {
        try {
            $provider = new PayPalClient;
            $provider->setApiCredentials(config('paypal'));
            $token = $provider->getAccessToken();
            $provider->setAccessToken($token);

            $response = $provider->capturePaymentOrder($paypalOrderId);

            if (isset($response['status']) && $response['status'] === 'COMPLETED') {
                $order = Order::where('payment_id', $paypalOrderId)->first();

                if ($order) {
                    $order->update([
                        'payment_status' => 'paid',
                        'transaction_id' => $response['purchase_units'][0]['payments']['captures'][0]['id'] ?? null,
                    ]);

                    $this->activateUserPlan($order);

                    return ['success' => true, 'order' => $order];
                }
            }

            return ['success' => false, 'error' => 'Payment capture failed'];

        } catch (\Exception $e) {
            Log::error('PayPal capture failed', ['error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Create Razorpay order
     *
     * @param Plan $plan
     * @param Company $company
     *
     * @return (bool|mixed|string)[]
     *
     * @psalm-return array{success: bool, error?: string, order_id?: mixed, razorpay_order_id?: mixed, razorpay_key?: mixed, amount?: mixed, currency?: mixed}
     */
    public function createRazorpayOrder(Plan $plan, Company $company): array
    {
        try {
            $api = new \Razorpay\Api\Api(
                config('services.razorpay.key'),
                config('services.razorpay.secret')
            );

            // Create order
            $dbOrder = Order::create([
                'company_id' => $company->id,
                'plan_id' => $plan->id,
                'payment_provider' => 'razorpay',
                'amount' => $plan->price,
                'payment_status' => 'pending',
            ]);

            $razorpayOrder = $api->order->create([
                'receipt' => 'order_' . $dbOrder->id,
                'amount' => $plan->price * 100, // Convert to paise
                'currency' => 'INR',
                'notes' => [
                    'company_id' => $company->id,
                    'plan_id' => $plan->id,
                ],
            ]);

            $dbOrder->update(['payment_id' => $razorpayOrder['id']]);

            return [
                'success' => true,
                'order_id' => $dbOrder->id,
                'razorpay_order_id' => $razorpayOrder['id'],
                'razorpay_key' => config('services.razorpay.key'),
                'amount' => $razorpayOrder['amount'],
                'currency' => $razorpayOrder['currency'],
            ];

        } catch (\Exception $e) {
            Log::error('Razorpay order creation failed', [
                'error' => $e->getMessage(),
                'company_id' => $company->id,
            ]);

            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Verify Razorpay payment
     *
     * @param array $paymentData
     *
     * @return (Order|bool|string)[]
     *
     * @psalm-return array{success: bool, error?: string, order?: Order}
     */
    public function verifyRazorpayPayment(array $paymentData): array
    {
        try {
            $api = new \Razorpay\Api\Api(
                config('services.razorpay.key'),
                config('services.razorpay.secret')
            );

            $attributes = [
                'razorpay_order_id' => $paymentData['razorpay_order_id'],
                'razorpay_payment_id' => $paymentData['razorpay_payment_id'],
                'razorpay_signature' => $paymentData['razorpay_signature'],
            ];

            $api->utility->verifyPaymentSignature($attributes);

            $order = Order::where('payment_id', $paymentData['razorpay_order_id'])->first();

            if ($order) {
                $order->update([
                    'payment_status' => 'paid',
                    'transaction_id' => $paymentData['razorpay_payment_id'],
                ]);

                $this->activateUserPlan($order);

                return ['success' => true, 'order' => $order];
            }

            return ['success' => false, 'error' => 'Order not found'];

        } catch (\Exception $e) {
            Log::error('Razorpay verification failed', ['error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Activate user plan after successful payment
     *
     * @param Order $order
     * @return void
     */
    private function activateUserPlan(Order $order)
    {
        // Deactivate existing plans
        UserPlan::where('company_id', $order->company_id)
            ->update(['is_active' => 0]);

        // Create/activate new plan
        UserPlan::create([
            'company_id' => $order->company_id,
            'plan_id' => $order->plan_id,
            'order_id' => $order->id,
            'job_limit' => $order->plan->job_limit,
            'featured_job_limit' => $order->plan->featured_job_limit,
            'highlight_job_limit' => $order->plan->highlight_job_limit,
            'candidate_cv_view_limit' => $order->plan->candidate_cv_view_limit,
            'is_active' => 1,
        ]);

        Log::info('User plan activated', [
            'order_id' => $order->id,
            'company_id' => $order->company_id,
        ]);
    }

    /**
     * Generate invoice PDF
     *
     * @param Order $order
     *
     * @return string Path to PDF
     */
    public function generateInvoice(Order $order): string
    {
        // This will be implemented with a PDF library like dompdf or tcpdf
        // For now, return a placeholder
        return 'invoices/invoice_' . $order->id . '.pdf';
    }

    /**
     * Cancel subscription
     *
     * @param Company $company
     * @param string $provider
     *
     * @return (bool|string)[]
     *
     * @psalm-return array{success: bool, error?: string, message?: 'Subscription cancelled successfully'}
     */
    public function cancelSubscription(Company $company, string $provider): array
    {
        try {
            if ($provider === 'stripe' && $company->stripe_subscription_id) {
                $this->initializeStripe();
                $subscription = \Stripe\Subscription::retrieve($company->stripe_subscription_id);
                $subscription->cancel();

                return ['success' => true, 'message' => 'Subscription cancelled successfully'];
            }

            return ['success' => false, 'error' => 'Invalid provider or no active subscription'];

        } catch (\Exception $e) {
            Log::error('Subscription cancellation failed', ['error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}

