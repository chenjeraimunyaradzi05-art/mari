<?php

namespace App\Notifications\Messaging;

use App\Models\SocialMessageReport;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

final class MessageReportFiledNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly SocialMessageReport $report)
    {
        $this->onConnection(config('social_messaging.queue.connection', config('queue.default')));
        $this->onQueue(config('social_messaging.queue.name', 'notifications'));
    }

    /**
     * Determine which channels the notification should be delivered on.
     *
     * For tests and the incident pipeline we store an audit-style copy in
     * the database. Mail isn't required in tests so we keep this minimal.
     *
     * @param  mixed  $notifiable
     * @return array
     */
    public function via(mixed $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return (int|mixed|null|string)[]
     *
     * @psalm-return array{type: 'message_report_filed', report_id: mixed, message_id: mixed|null, thread_id: int|null, reason: null|string, status: string, preview: mixed|null|string, filed_at: string}
     */
    public function toArray(object $notifiable): array
    {
        $message = $this->report->message;
        $status = $this->report->status instanceof \UnitEnum
            ? $this->report->status->value
            : $this->report->status;

        return [
            'type' => 'message_report_filed',
            'report_id' => $this->report->getKey(),
            'message_id' => $message?->getKey(),
            'thread_id' => $message?->social_thread_id,
            'reason' => $this->report->reason,
            'status' => $status,
            'preview' => $this->report->metadata['preview']
                ?? ($message?->body ? Str::limit($message->body, 160) : null),
            'filed_at' => optional($this->report->created_at)->toIso8601String(),
        ];
    }
}

