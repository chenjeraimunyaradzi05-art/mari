<?php

namespace App\Services;

use App\Jobs\PersistAnalyticsEvent;
use App\Models\AnalyticsEvent;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class RealTimeAnalyticsEngine
{
	public function record(string $event, array $payload = []): void
	{
		$normalizedPayload = $this->normalizePayload($payload);

		if ($this->shouldQueue()) {
			$this->dispatchPersistJob($event, $normalizedPayload);

			return;
		}

		$this->persist($event, $normalizedPayload);
	}

	public function persist(string $event, array $payload): void
	{
		AnalyticsEvent::create([
			'event' => $event,
			'properties' => $payload['properties'] ?? [],
			'metadata' => $payload['metadata'] ?? [],
			'source' => $payload['source'] ?? null,
			'received_at' => $payload['received_at'] ?? now(),
		]);

		$this->logEvent($event, $payload);
	}

	/**
	 * Persist a batch of events. Each item in the $events array should be an
	 * array with keys 'event' and optional 'payload'. This method will respect
	 * the configured ingestion mode (async vs sync) by delegating to record().
	 *
	 * @param array<int, array{event: string, payload?: array}> $events
	 */
	public function recordBatch(array $events): void
	{
		foreach ($events as $item) {
			$event = $item['event'] ?? null;
			$payload = $item['payload'] ?? [];

			if (! $event) {
				continue;
			}

			// Reuse record() so that queueing behaviour is honoured.
			$this->record($event, $payload);
		}
	}

	/**
	 * @return (Carbon|array|mixed)[]
	 *
	 * @psalm-return array{properties: array, metadata: array, source: mixed, received_at: Carbon}
	 */
	private function normalizePayload(array $payload): array
	{
		return [
			'properties' => $this->ensureArray($payload['properties'] ?? []),
			'metadata' => $this->ensureArray($payload['metadata'] ?? []),
			'source' => Arr::get($payload, 'source', 'app'),
			'received_at' => $this->resolveReceivedAt($payload),
		];
	}

	private function ensureArray(mixed $value): array
	{
		if (is_array($value)) {
			return $value;
		}

		if (is_null($value)) {
			return [];
		}

		if ($value instanceof \JsonSerializable) {
			return (array) $value->jsonSerialize();
		}

		return (array) $value;
	}

	private function dispatchPersistJob(string $event, array $payload): void
	{
		PersistAnalyticsEvent::dispatch($event, $payload)
			->onConnection($this->queueConnection())
			->onQueue($this->queueName());
	}

	private function logEvent(string $event, array $payload): void
	{
		Log::channel($this->logChannel())->info('analytics.event', [
			'event' => $event,
			'source' => $payload['source'] ?? null,
			'received_at' => optional($payload['received_at'])->toIso8601String(),
			'properties' => $payload['properties'] ?? [],
			'metadata' => $payload['metadata'] ?? [],
		]);
	}

	private function shouldQueue(): bool
	{
		return (bool) config('analytics.ingestion.async', false);
	}

	private function queueConnection(): string
	{
		return config('analytics.ingestion.queue_connection', config('queue.default'));
	}

	private function queueName(): string
	{
		return config('analytics.ingestion.queue', 'default');
	}

	private function logChannel(): string
	{
		return config('analytics.ingestion.log_channel', config('logging.default'));
	}

	private function resolveReceivedAt(array $payload): Carbon
	{
		$receivedAt = Arr::get($payload, 'received_at');

		if (! $receivedAt) {
			return now();
		}

		try {
			return Carbon::parse($receivedAt);
		} catch (\Throwable $exception) {
			return now();
		}
	}
}

