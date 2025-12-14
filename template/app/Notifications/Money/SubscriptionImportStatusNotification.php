<?php

namespace App\Notifications\Money;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

final class SubscriptionImportStatusNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $status,
        public readonly ?string $filename = null,
        public readonly array $stats = [],
        public readonly array $warnings = [],
        public readonly ?string $error = null,
    ) {
    }

    /**
     * @return (array|int|null|string)[]
     *
     * @psalm-return array{type: 'subscription_import', status: string, filename: null|string, stats: array, warnings: array<int, mixed>, warning_count: int<0, max>, error: null|string, message: 'Athena finished your subscription import with a soft landing.'|'Athena needs a refreshed subscription file before we can finish.', cta_label: 'View notification', cta_url: string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'subscription_import',
            'status' => $this->status,
            'filename' => $this->filename,
            'stats' => $this->stats,
            'warnings' => collect($this->warnings)->take(5)->values()->all(),
            'warning_count' => count($this->warnings),
            'error' => $this->error,
            'message' => $this->status === 'completed'
                ? 'Athena finished your subscription import with a soft landing.'
                : 'Athena needs a refreshed subscription file before we can finish.',
            'cta_label' => 'View notification',
            'cta_url' => route('notifications.index'),
        ];
    }

    private function greetingFor(object $notifiable): string
    {
        $name = $notifiable->first_name ?? $notifiable->name ?? null;

        if ($name) {
            return 'Hi '.trim($name).',';
        }

        if (isset($notifiable->email)) {
            return 'Hi '.strtok($notifiable->email, '@').',';
        }

        return 'Hi there,';
    }
}

