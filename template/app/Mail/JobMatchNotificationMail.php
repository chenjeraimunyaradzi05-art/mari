<?php

namespace App\Mail;

use App\Models\Candidate;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

final class JobMatchNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public $candidate;
    public $matchedJobs;
}

