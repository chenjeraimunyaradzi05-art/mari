<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\VerificationAudit */
final class VerificationAuditResource extends JsonResource
{
    /**
     * @param Request $request
     */
    #[\Override]
    /**
     * @return (\Illuminate\Http\Resources\MissingValue|array|int|mixed|null|string)[]
     *
     * @psalm-return array{id: int, action: string, notes: array|null, ai_summary: array|null, actor: \Illuminate\Http\Resources\MissingValue|mixed, created_at: string}
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'action' => $this->action,
            'notes' => $this->notes,
            'ai_summary' => $this->ai_summary,
            'actor' => $this->when($this->relationLoaded('actor') && $this->actor, fn () => [
                'id' => $this->actor->id,
                'name' => $this->actor->name,
                'email' => $this->actor->email,
            ]),
            'created_at' => optional($this->created_at)->toIso8601String(),
        ];
    }
}
