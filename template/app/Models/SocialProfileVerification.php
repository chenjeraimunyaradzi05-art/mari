<?php

namespace App\Models;

use App\Enums\SocialVerificationStatus;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $social_profile_id
 * @property int $user_id
 * @property string $request_type
 * @property SocialVerificationStatus $status
 * @property array<array-key, mixed>|null $evidence_urls
 * @property array<array-key, mixed>|null $attachments
 * @property string|null $notes
 * @property string|null $review_notes
 * @property int|null $reviewed_by
 * @property \Illuminate\Support\Carbon|null $submitted_at
 * @property \Illuminate\Support\Carbon|null $reviewed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialProfile $profile
 * @property-read \App\Models\Admin|null $reviewer
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification whereAttachments($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification whereEvidenceUrls($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification whereRequestType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification whereReviewNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification whereReviewedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification whereReviewedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification whereSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification whereSubmittedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification whereUserId($value)
 * @property int|null $referral_invite_id
 * @property string|null $referral_code
 * @property array<array-key, mixed>|null $privacy_snapshot
 * @property-read \App\Models\Invite|null $referralInvite
 * @method static \Database\Factories\SocialProfileVerificationFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification wherePrivacySnapshot($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification whereReferralCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialProfileVerification whereReferralInviteId($value)
 * @mixin \Eloquent
 */
final class SocialProfileVerification extends Model
{
    use HasFactory;

    protected $fillable = [
        'social_profile_id',
        'user_id',
        'request_type',
        'status',
        'evidence_urls',
        'attachments',
        'notes',
        'review_notes',
        'reviewed_by',
        'reviewed_at',
        'submitted_at',
        'referral_invite_id',
        'referral_code',
        'privacy_snapshot',
    ];

    protected $casts = [
        'status' => SocialVerificationStatus::class,
        'evidence_urls' => 'array',
        'attachments' => 'array',
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'privacy_snapshot' => 'array',
    ];

    protected $dates = [
        'submitted_at',
        'reviewed_at',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'social_profile_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'reviewed_by');
    }

    public function referralInvite(): BelongsTo
    {
        return $this->belongsTo(Invite::class, 'referral_invite_id');
    }

    protected function attachments(): Attribute
    {
        return Attribute::set(function ($value) {
            if (is_array($value)) {
                return array_values(array_filter($value));
            }

            return $value;
        });
    }
}

