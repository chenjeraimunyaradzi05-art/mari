<?php

namespace App\Services\Compliance;

use App\Models\ConsentLog;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;

final class ConsentLogger
{
    public function log(
        string $surface,
        string $action,
        array $payload = [],
        ?Model $subject = null,
        ?Authenticatable $user = null,
        ?string $actorName = null,
        ?string $actorEmail = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): ConsentLog {
        $contextualUser = $user ?? ($subject && method_exists($subject, 'user') ? $subject->user : null);

        $defaults = request();
        $ipAddress ??= $defaults?->ip();
        $userAgent ??= $defaults?->userAgent();

        return ConsentLog::create([
            'user_id' => $contextualUser?->getAuthIdentifier(),
            'surface' => $surface,
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'payload' => $payload ?: null,
            'actor_name' => $actorName,
            'actor_email' => $actorEmail,
            'actor_ip' => $ipAddress,
            'actor_user_agent' => $userAgent,
            'logged_at' => now(),
        ]);
    }
}

