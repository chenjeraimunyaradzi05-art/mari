<?php

namespace App\Services;

use App\Models\SocialTransparencyLog;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;

final class TransparencyLogService
{


    public function recordDecision(
        string $action,
        Model $subject,
        ?Authenticatable $actor,
        array $context = []
    ): SocialTransparencyLog {
        return SocialTransparencyLog::create([
            'actor_type' => $this->resolveMorphClass($actor) ?? 'system',
            'actor_id' => $actor?->getAuthIdentifier(),
            'subject_type' => $subject->getMorphClass(),
            'subject_id' => $subject->getKey(),
            'action' => $action,
            'decision' => $context['decision'] ?? null,
            'rationale' => $context['rationale'] ?? null,
            'visibility' => $context['visibility'] ?? 'internal',
            'metadata' => $context['metadata'] ?? null,
            'published_at' => $context['visibility'] === 'public' ? now() : null,
        ]);
    }

    protected function resolveMorphClass(?Authenticatable $actor): ?string
    {
        if (!$actor) {
            return null;
        }

        if ($actor instanceof Model) {
            return $actor->getMorphClass();
        }

        return get_class($actor);
    }
}

