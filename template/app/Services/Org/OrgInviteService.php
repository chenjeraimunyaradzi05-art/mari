<?php

namespace App\Services\Org;

use App\Events\OrgInviteFailed;
use App\Events\OrgInviteSent;
use App\Mail\OrgInviteMail;
use App\Mail\OrgInviteSummaryMail;
use App\Models\OrgInviteLog;
use App\Models\OrganizationPage;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Mail;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

final class OrgInviteService
{
    /**
     * @param  array<int, string>  $emails
     * @param  array<string, mixed>  $options
     * @return array{results: Collection, summary: array, summary_mail_queued: bool}
     */
    public function sendInvites(OrganizationPage $page, array $emails, ?User $inviter = null, array $options = []): array
    {
        $message = $options['message'] ?? null;
        $channels = $this->normalizeChannels($options['channels'] ?? ['email']);
        $sendSummary = $options['send_summary'] ?? true;

        $results = collect();

        foreach ($this->normalizeEmails($emails) as $email) {
            foreach ($channels as $channel) {
                $log = $this->createLog($page, $email, $inviter, $channel, $message, $options);

                try {
                    $outcome = $this->dispatchChannel($channel, $log, $page, $inviter, $message, $options);

                    if (! empty($outcome['dispatched_event'])) {
                        $log->refresh();
                    } elseif (! empty($outcome['status_update'])) {
                        $log->forceFill($outcome['status_update'])->save();
                    }

                    $results->push($this->formatResult($log->fresh(), $channel, $outcome));
                } catch (Throwable $exception) {
                    event(new OrgInviteFailed($log, $exception->getMessage()));
                    $log->refresh();

                    $results->push($this->formatResult($log, $channel, [
                        'status' => 'failed',
                        'error' => $exception->getMessage(),
                    ]));
                }
            }
        }

        $summary = $this->summarize($results);
        $summaryMailQueued = false;

        if ($inviter && $sendSummary && $inviter->email) {
            Mail::to($inviter->email)->queue(new OrgInviteSummaryMail($page, $inviter, $summary, $results->toArray()));
            $summaryMailQueued = true;
        }

        return [
            'results' => $results,
            'summary' => $summary,
            'summary_mail_queued' => $summaryMailQueued,
        ];
    }

    /**
     * Retry an existing invite log through its original channel.
     *
     * @return (int|null|string)[]
     *
     * @psalm-return array{email: string, channel: string, status: string, error?: null|string, log_id: int}
     */
    public function retryInvite(OrgInviteLog $log, ?User $inviter = null, array $options = []): array
    {
        $page = $log->page ?? OrganizationPage::find($log->org_page_id);

        if (! $page) {
            throw new RuntimeException('Unable to locate organization page for invite retry.');
        }

        $log->update([
            'status' => 'pending',
            'sent_at' => null,
        ]);

        $meta = $log->meta ?? [];
        $meta['retries'] = ($meta['retries'] ?? 0) + 1;

        if (array_key_exists('message', $options) && $options['message'] !== null) {
            $meta['message'] = $options['message'];
        }

        $log->forceFill(['meta' => $meta])->save();

        try {
            $message = array_key_exists('message', $options) ? $options['message'] : Arr::get($log->meta, 'message');
            $outcome = $this->dispatchChannel($log->channel, $log, $page, $inviter ?? $log->inviter, $message, $options);

            if (! empty($outcome['dispatched_event'])) {
                $log->refresh();
            } elseif (! empty($outcome['status_update'])) {
                $log->forceFill($outcome['status_update'])->save();
            }

            $result = $this->formatResult($log->fresh(), $log->channel, $outcome);
        } catch (Throwable $exception) {
            event(new OrgInviteFailed($log, $exception->getMessage()));
            $log->refresh();

            $result = $this->formatResult($log, $log->channel, [
                'status' => 'failed',
                'error' => $exception->getMessage(),
            ]);
        }

        $sendSummary = $options['send_summary'] ?? false;

        if ($inviter && $sendSummary && $inviter->email) {
            $summary = $this->summarize(collect([$result]));
            Mail::to($inviter->email)->queue(new OrgInviteSummaryMail($page, $inviter, $summary, [$result]));
        }

        return $result;
    }

    /**
     * @psalm-return Collection<int, string>
     */
    protected function normalizeEmails(array $emails): Collection
    {
        return collect($emails)
            ->map(fn ($email) => trim((string) $email))
            ->filter()
            ->unique()
            ->values();
    }

    /**
     * @param array<string>|string  $channels
     *
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    protected function normalizeChannels(array|string $channels): array
    {
        $channels = is_array($channels) ? $channels : [$channels];

        $normalized = collect($channels)
            ->map(fn ($channel) => strtolower((string) $channel))
            ->filter()
            ->unique()
            ->values();

        if ($normalized->isEmpty()) {
            throw new InvalidArgumentException('At least one invite channel must be provided.');
        }

        return $normalized->all();
    }

    protected function createLog(OrganizationPage $page, string $email, ?User $inviter, string $channel, ?string $message, array $options): OrgInviteLog
    {
        $meta = array_filter([
            'inviter_name' => $inviter?->name,
            'message' => $message,
            'channels' => $this->normalizeChannels($options['channels'] ?? ['email']),
        ]);

        return OrgInviteLog::create([
            'org_page_id' => $page->id,
            'email' => $email,
            'invited_by' => $inviter?->id,
            'channel' => $channel,
            'status' => 'pending',
            'meta' => $meta,
        ]);
    }

    /**
     * @return (array|bool|string)[]
     *
     * @psalm-return array{status: string, dispatched_event?: bool, status_update?: array}
     */
    protected function dispatchChannel(string $channel, OrgInviteLog $log, OrganizationPage $page, ?User $inviter, ?string $message, array $options): array
    {
        return match ($channel) {
            'email' => $this->sendEmailInvite($log, $page, $inviter, $message),
            'sms' => $this->recordDeferredChannel($log, 'sms', $options),
            'slack' => $this->recordDeferredChannel($log, 'slack', $options),
            default => throw new InvalidArgumentException("Unsupported invite channel [{$channel}]."),
        };
    }

    /**
     * @return (string|true)[]
     *
     * @psalm-return array{status: 'sent', dispatched_event: true}
     */
    protected function sendEmailInvite(OrgInviteLog $log, OrganizationPage $page, ?User $inviter, ?string $message): array
    {
        Mail::to($log->email)->queue(new OrgInviteMail($page, $inviter, $message));
        event(new OrgInviteSent($log));

        return [
            'status' => 'sent',
            'dispatched_event' => true,
        ];
    }

    /**
     * Record a placeholder for channels that are not yet integrated.
     *
     * @return ((((mixed|string)[][]|mixed)[]|string)[]|string)[]
     *
     * @psalm-return array{status: 'queued', status_update: array{status: 'queued', meta: array{channel_status: array<string, array{status: 'queued', notes: 'Dispatch queued for future integration.'|mixed}>|mixed,...}}}
     */
    protected function recordDeferredChannel(OrgInviteLog $log, string $channel, array $options): array
    {
        $meta = $log->meta ?? [];
        $current = Arr::get($meta, 'channel_status', []);
        $current[$channel] = [
            'status' => 'queued',
            'notes' => $options['channel_notes'][$channel] ?? 'Dispatch queued for future integration.',
        ];

        $meta['channel_status'] = $current;

        return [
            'status' => 'queued',
            'status_update' => [
                'status' => 'queued',
                'meta' => $meta,
            ],
        ];
    }

    /**
     * @param  array{status?: string, error?: string|null}  $outcome
     * @return array{email: string, channel: string, status: string, error?: string|null, log_id: int}
     */
    protected function formatResult(OrgInviteLog $log, string $channel, array $outcome): array
    {
        return [
            'email' => $log->email,
            'channel' => $channel,
            'status' => $outcome['status'] ?? $log->status,
            'error' => $outcome['error'] ?? Arr::get($log->meta, 'error'),
            'log_id' => $log->id,
        ];
    }

    /**
     * @return (array|int)[]
     *
     * @psalm-return array{total: int, sent: int, queued: int, failed: int, by_status: array, by_channel: array}
     */
    protected function summarize(Collection $results): array
    {
    $byStatus = $results->groupBy('status')->map(fn (Collection $group) => $group->count());
    $byChannel = $results->groupBy('channel')->map(fn (Collection $group) => $group->count());

        return [
            'total' => $results->count(),
            'sent' => $results->where('status', 'sent')->count(),
            'queued' => $results->where('status', 'queued')->count(),
            'failed' => $results->where('status', 'failed')->count(),
            'by_status' => $byStatus->toArray(),
            'by_channel' => $byChannel->toArray(),
        ];
    }
}

