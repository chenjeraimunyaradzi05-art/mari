<?php

namespace App\DataTransferObjects\OpportunityRadar;

use Illuminate\Contracts\Support\Arrayable;

final class OpportunitySignal implements Arrayable
{
    public function __construct(
        public readonly string $type,
        public readonly ?int $opportunityId,
        public readonly string $title,
        public readonly ?string $subtitle,
        public readonly ?string $summary,
        public readonly int $score,
        public readonly string $urgency,
        public readonly array $fitReasons = [],
        public readonly ?string $actionUrl = null,
        public readonly ?string $expiresAt = null,
    ) {
    }

    public function key(): string
    {
        return sprintf('%s:%s', $this->type, $this->opportunityId ?? md5($this->title));
    }

    #[\Override]
    /**
     * @return (array|int|null|string)[]
     *
     * @psalm-return array{type: string, opportunity_id: int|null, title: string, subtitle: null|string, summary: null|string, score: int, urgency: string, fit_reasons: array, action_url: null|string, expires_at: null|string}
     */
    public function toArray(): array
    {
        return [
            'type' => $this->type,
            'opportunity_id' => $this->opportunityId,
            'title' => $this->title,
            'subtitle' => $this->subtitle,
            'summary' => $this->summary,
            'score' => $this->score,
            'urgency' => $this->urgency,
            'fit_reasons' => $this->fitReasons,
            'action_url' => $this->actionUrl,
            'expires_at' => $this->expiresAt,
        ];
    }
}

