<?php

namespace App\Http\Controllers\Frontend\Social;

use App\Http\Controllers\Controller;
use App\Models\SocialNotificationPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class NotificationPreferenceController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $preference = SocialNotificationPreference::firstOrCreate(
            ['user_id' => $user->id],
            ['settings' => SocialNotificationPreference::defaults()]
        );

        return response()->json([
            'data' => [
                'settings' => $preference->settings ?? SocialNotificationPreference::defaults(),
                'categories' => config('social.notifications.categories', []),
                'channels' => config('social.notifications.channels', []),
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user !== null, 401);

        $categories = array_keys(config('social.notifications.categories', []));
        $channels = config('social.notifications.channels', []);

        $validated = $request->validate([
            'settings' => ['required', 'array'],
            'settings.*' => ['array'],
        ]);

        $settings = collect($validated['settings'])
            ->mapWithKeys(function ($payload, $category) use ($channels, $categories) {
                if (! in_array($category, $categories, true)) {
                    return [];
                }

                $normalized = [];
                foreach ($channels as $channel) {
                    if (array_key_exists($channel, $payload ?? [])) {
                        $normalized[$channel] = (bool) $payload[$channel];
                    }
                }

                return [$category => $normalized];
            })
            ->toArray();

        $preference = SocialNotificationPreference::firstOrCreate(
            ['user_id' => $user->id],
            ['settings' => SocialNotificationPreference::defaults()]
        );

        $preference->apply($settings);

        return response()->json([
            'data' => [
                'settings' => $preference->settings,
            ],
        ]);
    }
}

