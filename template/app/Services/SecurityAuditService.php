<?php

namespace App\Services;

use App\Models\SecurityAuditLog;
use App\Models\User;
use Illuminate\Http\Request;

final class SecurityAuditService
{
    /**
     * Persist a structured security audit event.
     */
    public function log(string $eventType, array $context = []): SecurityAuditLog
    {
        $request = $context['request'] ?? request();
        $user = $context['user'] ?? null;

        if ($user instanceof User) {
            $context['user_id'] = $context['user_id'] ?? $user->getKey();
        }

        return SecurityAuditLog::create([
            'user_id' => $context['user_id'] ?? null,
            'event_type' => $eventType,
            'severity' => $this->normalizeSeverity($context['severity'] ?? 'info'),
            'ip_address' => $context['ip_address'] ?? ($request instanceof Request ? $request->ip() : null),
            'user_agent' => $context['user_agent'] ?? ($request instanceof Request ? $request->userAgent() : null),
            'resource_type' => $context['resource_type'] ?? null,
            'resource_id' => $context['resource_id'] ?? null,
            'metadata' => $context['metadata'] ?? [],
        ]);
    }

    private function normalizeSeverity(string $severity): string
    {
        return in_array($severity, ['info', 'warning', 'critical'], true)
            ? $severity
            : 'info';
    }
}

