<?php

namespace App\Services\Social;

use App\Models\DeviceCaptureConsent;
use App\Models\User;
use Illuminate\Support\Carbon;

final class DeviceCaptureConsentService
{
    public function record(User $user, string $captureType, array $context = []): DeviceCaptureConsent
    {
        $normalizedType = strtolower(trim($captureType));
        $intervalHours = max(1, (int) config('social.capture.consent_interval_hours', 24));

        $recent = DeviceCaptureConsent::query()
            ->where('user_id', $user->getKey())
            ->where('capture_type', $normalizedType)
            ->latest('created_at')
            ->first();

        if ($recent && $recent->created_at instanceof Carbon && $recent->created_at->greaterThan(now()->subHours($intervalHours))) {
            $recent->forceFill([
                'context' => $context['context'] ?? $recent->context,
                'consent_copy' => $context['consent_copy'] ?? $recent->consent_copy,
                'reminded_at' => now(),
                'ip_address' => $context['ip_address'] ?? $recent->ip_address,
                'user_agent' => $context['user_agent'] ?? $recent->user_agent,
            ])->save();

            return $recent->fresh();
        }

        return DeviceCaptureConsent::create([
            'user_id' => $user->getKey(),
            'capture_type' => $normalizedType,
            'context' => $context['context'] ?? null,
            'consent_copy' => $context['consent_copy'] ?? null,
            'ip_address' => $context['ip_address'] ?? null,
            'user_agent' => $context['user_agent'] ?? null,
            'reminded_at' => now(),
        ]);
    }
}

