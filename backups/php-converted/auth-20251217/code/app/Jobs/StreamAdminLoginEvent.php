<?php

namespace App\Jobs;

use App\Models\AdminLoginAudit;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class StreamAdminLoginEvent implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public readonly int $auditId)
    {
    }

    public function handle(): void
    {
        $audit = AdminLoginAudit::query()->find($this->auditId);

        if (! $audit) {
            return;
        }

        $payload = [
            'audit_id' => $audit->id,
            'admin_id' => $audit->admin_id,
            'email' => $audit->admin->email ?? null,
            'roles' => method_exists($audit->admin, 'getRoleNames') ? $audit->admin->getRoleNames()->toArray() : [],
            'source' => $audit->source,
            'timezone' => $audit->timezone,
            'offset_minutes' => $audit->offset_minutes,
            'ip_address' => $audit->ip_address,
            'user_agent' => $audit->user_agent,
            'logged_in_at' => optional($audit->logged_in_at)->toIso8601String(),
            'meta' => $audit->meta ?? [],
            'environment' => config('app.env'),
        ];

        $endpoint = config('analytics.siem_endpoint');

        if ($endpoint) {
            try {
                // Build HTTP headers based on config. Support API keys (Bearer)
                // or X-API-Key style headers, plus optional HMAC signatures.
                $headers = [];

                $apiKey = config('analytics.siem_api_key');
                if ($apiKey !== null) {
                    // Use Authorization: Bearer when the key looks like a token,
                    // otherwise fall back to X-API-Key.
                    if (str_contains($apiKey, '.') || str_contains($apiKey, ':') || strlen($apiKey) >= 20) {
                        $headers['Authorization'] = 'Bearer ' . $apiKey;
                    } else {
                        $headers['X-API-Key'] = $apiKey;
                    }
                }

                $hmacSecret = config('analytics.siem_hmac_secret');
                $timestamp = now()->toIso8601String();

                $json = json_encode($payload);

                if ($hmacSecret) {
                    try {
                        $signature = 'sha256=' . hash_hmac('sha256', $json . $timestamp, $hmacSecret);
                        $headers['X-Signature'] = $signature;
                        $headers['X-Signature-Timestamp'] = $timestamp;
                    } catch (\Throwable $e) {
                        // If signing fails, leave headers unset and continue (non-fatal)
                    }
                }

                $client = Http::withHeaders($headers)->timeout(config('analytics.siem_timeout', 5));

                $client->post($endpoint, $payload);
            } catch (\Throwable $e) {
                Log::warning('siem.stream_failed', ['error' => $e->getMessage(), 'audit_id' => $audit->id]);
            }

            return;
        }

        // If no SIEM endpoint is configured, write to logs as a fallback so
        // the event is still visible to platform operators.
        Log::info('siem.admin_login', $payload);
    }
}
