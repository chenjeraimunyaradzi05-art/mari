<?php

namespace App\Support\Etl;

use Illuminate\Support\Facades\Log;
use Throwable;

abstract class EtlPipeline
{
    protected string $logChannel;

    public function __construct(?string $logChannel = null)
    {
        $this->logChannel = $logChannel ?? config('etl.log_channel', 'etl');
    }

    public function run(EtlContext $context): EtlResult
    {
        $start = microtime(true);
        $logger = Log::channel($this->logChannel);

        try {
            $logger->info('etl.start', [
                'pipeline' => $context->pipeline,
                'target_date' => $context->targetDate->toDateString(),
                'options' => $context->options,
            ]);

            $extracted = $this->extract($context);
            $transformed = $this->transform($context, $extracted);
            $meta = $this->load($context, $transformed) ?? [];

            $duration = microtime(true) - $start;
            $logger->info('etl.success', [
                'pipeline' => $context->pipeline,
                'target_date' => $context->targetDate->toDateString(),
                'duration_ms' => (int) round($duration * 1000),
                'meta' => $meta,
            ]);

            return EtlResult::success($context->pipeline, $duration, (array) $meta);
        } catch (Throwable $exception) {
            $duration = microtime(true) - $start;
            $logger->error('etl.failed', [
                'pipeline' => $context->pipeline,
                'target_date' => $context->targetDate->toDateString(),
                'duration_ms' => (int) round($duration * 1000),
                'exception' => $exception->getMessage(),
            ]);

            report($exception);

            return EtlResult::failure(
                $context->pipeline,
                $duration,
                ['options' => $context->options],
                $exception->getMessage()
            );
        }
    }

    abstract protected function extract(EtlContext $context): mixed;

    protected function transform(EtlContext $context, mixed $payload): mixed
    {
        return $payload;
    }

    abstract protected function load(EtlContext $context, mixed $payload): array;
}
