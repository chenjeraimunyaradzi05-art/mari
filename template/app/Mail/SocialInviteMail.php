<?php

namespace App\Mail;

use App\Models\Invite;
use App\Models\Profile;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

final class SocialInviteMail extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Invite $invite,
        public User $sender,
        public Profile $profile,
        public ?string $customMessage = null,
    ) {
    }

    public function build(): self
    {
        $body = $this->customMessage ?: 'You have an invite. Click the link to accept.';

        $html = sprintf(
            '<div><p>%s</p><p><a href="%s">Accept invite</a></p></div>',
            htmlspecialchars($body, ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($this->buildCtaUrl(), ENT_QUOTES, 'UTF-8')
        );

        return $this->subject('You have an invite')->html($html);
    }

    protected function buildCtaUrl(): string
    {
        $base = config('app.url');

        return rtrim($base, '/').'/signup?invite_token='.$this->invite->token;
    }
}

