<?php

namespace App\Services\Auth;

use App\Models\Admin;
use App\Models\AdminLoginAudit;
use App\Services\RealTimeAnalyticsEngine;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

final class AdminLoginAuditService
{
    public function __construct(private readonly RealTimeAnalyticsEngine $engine)
    {
    }
    public function record(Admin $admin, ?Request $request = null, array $context = []): AdminLoginAudit
    {
        $source = (string) ($context['source'] ?? 'admin');
        $timezone = $this->sanitizeTimezone($context['timezone'] ?? $request?->input('timezone'));
        $offset = $this->sanitizeOffset($context['offset_minutes'] ?? $request?->input('offset_minutes'));
        $meta = $this->buildMeta($request, $context['meta'] ?? []);

        $audit = $admin->loginAudits()->create([
            'source' => $source,
            'timezone' => $timezone,
            'offset_minutes' => $offset,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'logged_in_at' => Carbon::now(),
            'meta' => $meta,
        ]);

        // Emit a lightweight analytics event so external ingestion / SIEM
        // pipelines capture admin sign-ins in near real-time. We swallow any
        // exceptions because persistence in the admin_login_audits table is
        // the true source of record and should not be blocked by telemetry.
        try {
            $this->engine->record('admin.login', [
                'properties' => [
                    'admin_id' => $admin->id,
                    'email' => $admin->email,
                    'roles' => $admin->getRoleNames()->toArray(),
                    'mfa_verified' => (bool) $admin->mfa_verified_at,
                    'auth0_sub' => $admin->auth0_sub ?? null,
                    'source' => $source,
                    'timezone' => $timezone,
                    'offset_minutes' => $offset,
                    'ip_address' => $request?->ip(),
                    'environment' => config('app.env'),
                ],
                'metadata' => [
                    'user_agent' => $request?->userAgent(),
                    'logged_in_at' => $audit->logged_in_at?->toIso8601String(),
                    'route' => $request?->route()?->getName(),
                ],
                'source' => 'admin',
            ]);
        } catch (\Throwable $e) {
            // intentionally ignored
        }

        // Asynchronously stream a copy of the audit to external SIEM/ingestion
        // pipelines for long-term indexing / security processing. This is queued
        // so telemetry issues don't affect sign-in flow.
        try {
            \App\Jobs\StreamAdminLoginEvent::dispatch($audit->id)->onQueue(config('analytics.ingestion.queue', 'default'));
        } catch (\Throwable $e) {
            // ignore failures to dispatch job
        }

        return $audit;
    }

    private function sanitizeTimezone(mixed $timezone): string|null
    {
        if (! is_string($timezone)) {
            return null;
        }

        $trimmed = trim($timezone);

        return $trimmed !== '' ? $trimmed : null;
    }

    /**
     * @psalm-return int<-900, 900>|null
     */
    private function sanitizeOffset(mixed $offset): int|null
    {
        if ($offset === null || $offset === '') {
            return null;
        }

        if (is_numeric($offset)) {
            $value = (int) $offset;

            if ($value < -900) {
                return -900;
            }

            if ($value > 900) {
                return 900;
            }

            return $value;
        }

        return null;
    }

    private function buildMeta(?Request $request, array $meta = []): array
    {
        $base = array_filter([
            'route' => $request?->route()?->getName(),
            'url' => $request?->fullUrl(),
        ]);

        return array_merge($base, $meta);
    }
}
