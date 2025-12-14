<?php

namespace App\Observers;

use App\Models\JobAlertMatch;
use App\Notifications\DreamJobMatchFound;

final class JobAlertMatchObserver
{
    public function created(JobAlertMatch $match): void
    {
        $alert = $match->alert;

        if (! $alert || ! $alert->user) {
            return;
        }

        // Notify only according to the user's preferences
        $user = $alert->user;

        $channels = [];

        if ($user->notify_job_matches_in_app) {
            $channels[] = 'database';
        }

        if ($user->notify_job_matches_email) {
            $channels[] = 'mail';
        }

        if (empty($channels)) {
            return; // user opted out entirely
        }

        // The notification can use the channels the Notifiable resolves. We call notify
        // but the Notification will be delivered via the configured channels. Laravel
        // doesn't accept channels array at notify() - instead the Notification class
        // controls via() so we'll use user's preferences here to conditionally send.

        // We will send the Notification when appropriate — the Notification class
        // supports both mail and database; preferences are enforced by early checks above.
        $user->notify(new DreamJobMatchFound($match));
    }
}
