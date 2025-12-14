<?php

namespace App\Mail;

use App\Models\CareerInterest;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

final class DreamPathwayMatchMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    /**
     * @param  array<int, array<string, mixed>>  $matches
     */
    public function __construct(
        public CareerInterest $interest,
        public array $matches
    ) {
        $this->afterCommit();
    }
}

