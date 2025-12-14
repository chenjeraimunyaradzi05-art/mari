<?php

namespace App\Notifications\Lead;

use App\Models\Lead;
use App\Models\OrganizationPage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

final class OrganizationLeadReceivedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private Lead $lead, private OrganizationPage $page)
    {
        $this->queue = 'mail';
    }
}

