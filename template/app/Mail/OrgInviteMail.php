<?php

namespace App\Mail;

use App\Models\OrganizationPage;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

final class OrgInviteMail extends Mailable implements ShouldQueue
{
	use Queueable, SerializesModels;

	public function __construct(
		public OrganizationPage $page,
		public ?User $inviter = null,
		public ?string $message = null
	) {
	}
}

