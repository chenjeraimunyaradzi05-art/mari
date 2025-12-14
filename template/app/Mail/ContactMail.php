<?php
/**
 * ContactMail
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

final class ContactMail extends Mailable
{
    use Queueable, SerializesModels;

    public $userName;
    public $userEmail;
    public $userSubject;
    public $userMessage;
    /**
     * Create a new message instance.
     */
    public function __construct($userName, $userEmail, $userSubject, $userMessage)
    {
        $this->userName = $userName;
        $this->userEmail = $userEmail;
        $this->userSubject = $userSubject;
        $this->userMessage = $userMessage;
    }
}

