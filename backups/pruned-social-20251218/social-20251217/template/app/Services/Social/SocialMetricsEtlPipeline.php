<?php

namespace App\Services\Social;

use App\Support\Etl\EtlContext;
use App\Support\Etl\EtlPipeline;

final class SocialMetricsEtlPipeline extends EtlPipeline
{

    protected SocialMetricsAggregationService $aggregation;

    public function __construct(SocialMetricsAggregationService $aggregation, ?string $logChannel = null)
    {
        parent::__construct($logChannel);

        $this->aggregation = $aggregation;
    }


    /**
     * @return (bool|mixed)[]
     *
     * @psalm-return array{persona_id: mixed, force: bool}
     */
    #[\Override]
    /**
     * @return (bool|mixed)[]
     *
     * @psalm-return array{persona_id: mixed, force: bool}
     */
    protected function extract(EtlContext $context): array
    {
        return [
            'persona_id' => $context->option('persona_id'),
            'force' => (bool) $context->option('force', false),
        ];
    }

    /**
     * @return (int|mixed)[]
     *
     * @psalm-return array{processed: int, persona_id: mixed}
     */
    #[\Override]
    /**
     * @return (int|mixed)[]
     *
     * @psalm-return array{processed: int, persona_id: mixed}
     */
    protected function load(EtlContext $context, mixed $payload): array
    {
        $processed = $this->aggregation->capture(
            $context->targetDate,
            $payload['persona_id'],
            $payload['force'],
        );

        return [
            'processed' => $processed,
            'persona_id' => $payload['persona_id'],
        ];
    }
}

