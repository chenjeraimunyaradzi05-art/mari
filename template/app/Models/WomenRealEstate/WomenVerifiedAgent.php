<?php

declare(strict_types=1);

namespace App\Models\WomenRealEstate;

use App\Casts\EncryptedJson;
use App\Enums\WomenRealEstate\VerificationStage;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $user_id
 * @property string $license_number
 * @property \Illuminate\Support\Carbon|null $license_expires_at
 * @property string|null $regulator
 * @property string $status
 * @property VerificationStage $verification_stage
 * @property int $trust_badge_level
 * @property numeric|null $compliance_score
 * @property mixed|null $verification_payload
 * @property \Illuminate\Support\Carbon|null $verified_at
 * @property \Illuminate\Support\Carbon|null $last_reviewed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenAgentLead> $leads
 * @property int|null leads_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenListing> $listings
 * @property int|null listings_count
 * @property-read User $user
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenRealEstate\WomenAgentVerificationAudit> $verificationAudits
 * @property int|null verification_audits_count
 * @method static \Database\Factories\WomenRealEstate\WomenVerifiedAgentFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenVerifiedAgent newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenVerifiedAgent newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenVerifiedAgent query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenVerifiedAgent whereComplianceScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenVerifiedAgent whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenVerifiedAgent whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenVerifiedAgent whereLastReviewedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenVerifiedAgent whereLicenseExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenVerifiedAgent whereLicenseNumber($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenVerifiedAgent whereRegulator($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenVerifiedAgent whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenVerifiedAgent whereTrustBadgeLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenVerifiedAgent whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenVerifiedAgent final whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenVerifiedAgent whereVerificationPayload($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenVerifiedAgent whereVerificationStage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|WomenVerifiedAgent whereVerifiedAt($value)
 * @mixin \Eloquent
 */
final class WomenVerifiedAgent extends Model
{
    use HasFactory;

    protected $table = 'women_verified_agents';

    protected $fillable = [
        'user_id',
        'license_number',
        'license_expires_at',
        'regulator',
        'status',
        'verification_stage',
        'trust_badge_level',
        'compliance_score',
        'last_reviewed_at',
        'verification_payload',
        'verified_at',
    ];

    protected $casts = [
        'verification_stage' => VerificationStage::class,
        'trust_badge_level' => 'int',
    'compliance_score' => 'decimal:2',
    'verification_payload' => EncryptedJson::class,
        'license_expires_at' => 'date',
        'last_reviewed_at' => 'datetime',
        'verified_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function listings(): HasMany
    {
        return $this->hasMany(WomenListing::class, 'agent_id');
    }

    public function leads(): HasMany
    {
        return $this->hasMany(WomenAgentLead::class, 'agent_id');
    }

    public function verificationAudits(): HasMany
    {
        return $this->hasMany(WomenAgentVerificationAudit::class, 'agent_id');
    }

    public function inReverification(): bool
    {
        return $this->verification_stage === VerificationStage::REVERIFICATION;
    }
}
