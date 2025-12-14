<?php

namespace App\Mail;

use App\Models\Candidate;
use App\Models\CandidateJobAlert;
use App\Models\Job;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

final class JobAlertMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;
}

