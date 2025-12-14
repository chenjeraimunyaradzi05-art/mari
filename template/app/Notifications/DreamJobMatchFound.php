<?php

namespace App\Notifications;

use App\Models\JobAlertMatch;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

final class DreamJobMatchFound extends Notification
{
    use Queueable;

    public function __construct(private JobAlertMatch $match)
    {
    }

    public function via($notifiable): array
    {
        $channels = [];

        if ($notifiable->notify_job_matches_in_app) {
            $channels[] = 'database';
        }

        if ($notifiable->notify_job_matches_email) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toMail($notifiable): MailMessage
    {
        $job = $this->match->job;

        return (new MailMessage)
            ->subject('New job matches your alert')
            ->line("We found a new job that matches your dream job alert: {$job->title}")
            ->action('View job', url('/jobs/'.$job->id))
            ->line('Good luck — we are cheering you on.');
    }

    public function toArray($notifiable): array
    {
        return [
            'match_id' => $this->match->id,
            'job_id' => $this->match->job_posting_id,
            'score' => $this->match->match_score,
        ];
    }
}
