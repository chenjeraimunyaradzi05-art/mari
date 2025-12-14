<?php

namespace App\Services\Compliance;

use App\Models\ComplianceAudit;
use App\Models\User;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;

final class AuditTrailLogger
{
    public function log(
        ?Model $auditable,
        string $action,
        array $meta = [],
        ?Authenticatable $user = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): ComplianceAudit {
        $defaults = request();
        $ipAddress ??= $defaults?->ip();
        $userAgent ??= $defaults?->userAgent();

        $actorId = $user instanceof User ? $user->getAuthIdentifier() : null;

        return ComplianceAudit::create([
            'user_id' => $actorId,
            'auditable_type' => $auditable?->getMorphClass(),
            'auditable_id' => $auditable?->getKey(),
            'action' => $action,
            'meta' => $meta ?: null,
            'actor_ip' => $ipAddress,
            'actor_user_agent' => $userAgent,
            'recorded_at' => now(),
        ]);
    }
}

