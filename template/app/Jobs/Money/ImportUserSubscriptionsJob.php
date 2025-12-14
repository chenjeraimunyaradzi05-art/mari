<?php

namespace App\Jobs\Money;

use App\Models\User;
use App\Notifications\Money\SubscriptionImportStatusNotification;
use App\Services\Money\UserSubscriptionImportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

final class ImportUserSubscriptionsJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 1;

    public function __construct(
        public int $userId,
        public string $storedPath,
        public bool $archiveMissing = false,
        public ?string $cacheKey = null,
        public ?string $originalFilename = null,
        protected ?string $disk = null,
    ) {
        $this->disk ??= config('money.subscription_import_disk', 'local');
        $this->cacheKey ??= self::cacheKeyFor($this->userId);
    }

    public static function cacheKeyFor(int $userId): string
    {
        return sprintf('subscription-import-status:%d', $userId);
    }

    private function updateStatus(array $attributes): void
    {
        if (! $this->cacheKey) {
            return;
        }

        $current = Cache::get($this->cacheKey, [
            'original_name' => $this->originalFilename,
            'queued_at' => now(),
        ]);

        Cache::put(
            $this->cacheKey,
            array_merge($current, $attributes, [
                'original_name' => $current['original_name'] ?? $this->originalFilename,
            ]),
            $this->cacheTtl()
        );
    }

    private function cacheTtl(): \Illuminate\Support\Carbon
    {
        $seconds = (int) config('money.subscription_import_status_ttl', 6 * 60 * 60);

        return now()->addSeconds($seconds > 0 ? $seconds : 3600);
    }

    private function cleanupStoredFile(): void
    {
        try {
            Storage::disk($this->disk)->delete($this->storedPath);
        } catch (Throwable $exception) {
            Log::warning('Unable to delete stored subscription import file', [
                'path' => $this->storedPath,
                'message' => $exception->getMessage(),
            ]);
        }
    }

    private function notifyUser(User $user, string $status, array $payload = []): void
    {
        if (! $this->shouldNotify($user, $status)) {
            return;
        }

        try {
            $user->notify(new SubscriptionImportStatusNotification(
                status: $status,
                filename: $payload['filename'] ?? $this->originalFilename,
                stats: $payload['stats'] ?? [],
                warnings: $payload['warnings'] ?? [],
                error: $payload['error'] ?? null,
            ));
        } catch (Throwable $exception) {
            Log::warning('Unable to send subscription import notification', [
                'user_id' => $user->getKey(),
                'status' => $status,
                'message' => $exception->getMessage(),
            ]);
        }
    }

    private function shouldNotify(User $user, string $status): bool
    {
        $key = sprintf('subscription-import:notified:%d:%s', $user->getKey(), $status);
        $cooldown = (int) config('money.subscription_import_notification_cooldown', 900);

        if ($cooldown <= 0) {
            return true;
        }

        return Cache::add($key, now(), $cooldown);
    }
}

