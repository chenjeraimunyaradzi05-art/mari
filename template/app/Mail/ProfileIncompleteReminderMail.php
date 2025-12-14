<?php

namespace App\Mail;

use App\Models\Candidate;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

final class ProfileIncompleteReminderMail extends Mailable
{
    use Queueable, SerializesModels;

    public $candidate;
    public $completionPercentage;
    public $missingFields;
}

