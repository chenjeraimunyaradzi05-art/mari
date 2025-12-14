<?php
/**
 * NewsletterMail
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

final class NewsletterMail extends Mailable
{
    use Queueable, SerializesModels;

    public $mailSubject;
    public $mailMessage;
    /**
     * Create a new message instance.
     */
    public function __construct($mailSubject, $mailMessage)
    {
        $this->mailSubject = $mailSubject;
        $this->mailMessage = $mailMessage;
    }
}

