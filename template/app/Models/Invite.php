<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $sender_id
 * @property int|null $sender_profile_id
 * @property string|null $recipient_email
 * @property string|null $recipient_phone
 * @property string $channel
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $accepted_at
 * @property int|null $accepted_user_id
 * @property string|null $token
 * @property string|null $referral_code
 * @property string|null $cohort_slug
 * @property string|null $type
 * @property string|null $message
 * @property array<array-key, mixed>|null $payload
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User|null $acceptedUser
 * @property-read \App\Models\User|null $sender
 * @property-read \App\Models\Profile|null $senderProfile
 *
 * @method static \Database\Factories\InviteFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite whereAcceptedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite whereAcceptedUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite whereChannel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite whereMessage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite wherePayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite whereRecipientEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite whereRecipientPhone($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite whereReferralCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite whereSenderId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite whereSenderProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite whereToken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite whereUpdatedAt($value)
 *
 * @property int|null $graph_contact_id
 * @property array<array-key, mixed>|null $consent_snapshot
 * @property-read string|null $qr_code
 * @property-read \App\Models\SocialGraphContact|null $graphContact
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite whereCohortSlug($value)
 * @method static \Illuminate\Database\\Eloquent\Builder<static>|Invite whereConsentSnapshot($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Invite whereGraphContactId($value)
 *
 * @mixin \Eloquent
 */
final class Invite extends Model
{
    use HasFactory;

    protected $fillable = [
        'sender_id',
        'sender_profile_id',
        'recipient_email',
        'recipient_phone',
        'channel',
        'status',
        'token',
        'referral_code',
        'cohort_slug',
        'type',
        'message',
        'payload',
        'graph_contact_id',
        'consent_snapshot',
        'accepted_at',
        'accepted_user_id',
    ];

    protected $casts = [
        'accepted_at' => 'datetime',
        'payload' => 'array',
        'consent_snapshot' => 'array',
    ];

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function senderProfile(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'sender_profile_id');
    }

    public function acceptedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accepted_user_id');
    }

    public function graphContact(): BelongsTo
    {
        return $this->belongsTo(SocialGraphContact::class, 'graph_contact_id');
    }

    public function getQrCodeAttribute(): ?string
    {
        if (! class_exists(\SimpleSoftwareIO\QrCode\Facades\QrCode::class)) {
            return null;
        }

        // Assuming the frontend route is /invite/{token}
        return \SimpleSoftwareIO\QrCode\Facades\QrCode::size(300)->generate(url('/invite/'.$this->token));
    }
}
