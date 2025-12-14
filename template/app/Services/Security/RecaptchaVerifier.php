<?php

namespace App\Services\Security;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class RecaptchaVerifier
{
    public function verify(string $token, ?string $ip = null, string $action = null): bool
    {
        $secret = config('services.recaptcha.secret');

        if (empty($secret)) {
            Log::warning('ReCAPTCHA verification attempted without secret key configured.');

            return false;
        }

        $payload = [
            'secret' => $secret,
            'response' => $token,
        ];

        if ($ip) {
            $payload['remoteip'] = $ip;
        }

        $response = Http::asForm()
            ->timeout(5)
            ->post('https://www.google.com/recaptcha/api/siteverify', $payload);

        if (! $response->successful()) {
            Log::warning('ReCAPTCHA verification HTTP request failed.', ['status' => $response->status()]);

            return false;
        }

        $data = $response->json();

        if (! Arr::get($data, 'success')) {
            Log::info('ReCAPTCHA verification did not succeed.', ['errors' => Arr::get($data, 'error-codes', [])]);

            return false;
        }

        if ($action && ($receivedAction = Arr::get($data, 'action')) && $receivedAction !== $action) {
            Log::info('ReCAPTCHA action mismatch.', ['expected' => $action, 'received' => $receivedAction]);

            return false;
        }

        $score = (float) Arr::get($data, 'score', 0);
        $threshold = (float) config('features.leads.recaptcha.score_threshold', 0.5);

        return $score >= $threshold;
    }
}

