<?php

namespace App\Mail;

use App\Models\UserPlan;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

final class SubscriptionExpiringMail extends Mailable
{
    use Queueable, SerializesModels;

    public $userPlan;
    public $daysRemaining;
}

