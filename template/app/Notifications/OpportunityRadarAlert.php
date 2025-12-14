<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use App\Models\OpportunityRadarEntry;

final class OpportunityRadarAlert extends Notification implements ShouldQueue
{
    use Queueable;

    protected $entries;

    /**
     * Create a new notification instance.
     *
     * @param  \Illuminate\Support\Collection  $entries
     * @return void
     */
    public function __construct($entries)
    {
        $this->entries = $entries;
    }

    /**
     * Get the array representation of the notification.
     *
     * @param mixed  $notifiable
     *
     * @return (mixed|string)[]
     *
     * @psalm-return array{title: 'New Opportunity Radar Matches', count: mixed, top_match: mixed, action_url: string}
     */
    public function toArray($notifiable): array
    {
        return [
            'title' => 'New Opportunity Radar Matches',
            'count' => $this->entries->count(),
            'top_match' => $this->entries->first()->title,
            'action_url' => route('dashboard'),
        ];
    }
}

