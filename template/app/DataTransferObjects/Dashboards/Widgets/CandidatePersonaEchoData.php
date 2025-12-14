<?php

namespace App\DataTransferObjects\Dashboards\Widgets;

use App\DataTransferObjects\Dashboards\AbstractDashboardWidgetData;

final class CandidatePersonaEchoData extends AbstractDashboardWidgetData
{
    public function __construct(
        public readonly array $personas,
        public readonly ?string $primaryCtaLabel = null,
        public readonly ?string $primaryCtaUrl = null,
    ) {
    }

    #[\Override]
    /**
     * @return string
     *
     * @psalm-return 'candidate_persona_echo'
     */
    protected function key(): string
    {
        return 'candidate_persona_echo';
    }

    #[\Override]
    /**
     * @return (mixed|string)[][]
     *
     * @psalm-return array{personas: array, primary_cta: array<'label'|'url', string>}
     */
    public function toArray(): array
    {
        return [
            'personas' => $this->personas,
            'primary_cta' => array_filter([
                'label' => $this->primaryCtaLabel,
                'url' => $this->primaryCtaUrl,
            ], fn ($value) => $value !== null),
        ];
    }
}
