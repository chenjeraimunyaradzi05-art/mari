<?php

namespace App\Services\Auth;

use App\Models\User;
use App\Models\UserLoginAudit;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

final class UserLoginAuditService
{
    public function record(User $user, ?Request $request = null, array $context = []): UserLoginAudit
    {
        $source = (string) ($context['source'] ?? 'web');
        $timezone = $this->sanitizeTimezone($context['timezone'] ?? $request?->input('timezone'));
        $offset = $this->sanitizeOffset($context['offset_minutes'] ?? $request?->input('offset_minutes'));
        $meta = $this->buildMeta($request, $context['meta'] ?? []);

        return $user->loginAudits()->create([
            'source' => $source,
            'timezone' => $timezone,
            'offset_minutes' => $offset,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'logged_in_at' => Carbon::now(),
            'meta' => $meta,
        ]);
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

