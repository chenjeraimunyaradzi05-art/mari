<?php

namespace App\Mail;

use App\Models\AppliedJob;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

final class ApplicationStatusChangedMail extends Mailable
{
    use Queueable, SerializesModels;

    public $application;
    public $oldStatus;
    public $newStatus;
}

