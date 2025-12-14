<?php

namespace App\Http\Controllers\Api\Money;

use App\Http\Controllers\Controller;
use App\Models\UserSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class UserSubscriptionController extends Controller
{
    /**
     * Return the authenticated user's active subscriptions ordered by category and impact.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $subscriptions = $user->subscriptions()
            ->where('is_active', true)
            ->orderBy('category')
            ->orderByDesc('monthly_amount')
            ->get();

        return response()->json([
            'subscriptions' => $subscriptions,
        ]);
    }

    /**
     * Create or update a subscription entry for the authenticated user.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'id' => ['nullable', 'integer', 'exists:user_subscriptions,id'],
            'category' => [
                'required',
                'string',
                Rule::in([
                    'phone_plan',
                    'internet',
                    'streaming',
                    'gaming',
                    'fitness',
                    'transport',
                    'insurance',
                    'housing',
                    'business',
                    'software',
                    'cloud',
                    'education',
                    'other',
                ]),
            ],
            'label' => ['required', 'string', 'max:255'],
            'monthly_amount' => ['required', 'numeric', 'min:0'],
            'necessity_level' => ['required', Rule::in(['need', 'nice_to_have', 'luxury'])],
            'is_active' => ['sometimes', 'boolean'],
            'meta' => ['nullable', 'array'],
        ]);


        if (!empty($data['id'])) {
            $subscription = $user->subscriptions()->whereKey($data['id'])->firstOrFail();
            unset($data['id']);
            $subscription->fill($data);
        } else {
            $subscription = new UserSubscription($data);
            $subscription->user()->associate($user);
        }

        if (!array_key_exists('is_active', $data)) {
            $subscription->is_active = true;
        }

        $subscription->save();

        return response()->json([
            'message' => 'Subscription saved.',
            'subscription' => $subscription,
        ]);
    }

    /**
     * Soft delete a subscription by marking it inactive.
     */
    public function destroy(Request $request, UserSubscription $subscription): JsonResponse
    {
        abort_if($subscription->user_id !== $request->user()->id, 403);

        $subscription->is_active = false;
        $subscription->save();

        return response()->json([
            'message' => 'Subscription deactivated.',
        ]);
    }
}

