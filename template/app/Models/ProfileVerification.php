<?php

namespace App\Models;

use App\Enums\ProfileVerificationStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $profile_id
 * @property int|null $user_id
 * @property string $request_type
 * @property ProfileVerificationStatus $status
 * @property numeric|null $risk_score
 * @property array<array-key, mixed>|null $fraud_flags
 * @property array<array-key, mixed>|null $submitted_data
 * @property array<array-key, mixed>|null $attachment_manifest
 * @property \Illuminate\Support\Carbon|null $submitted_at
 * @property string|null $reviewed_by
 * @property int|null $assigned_reviewer_id
 * @property \Illuminate\Support\Carbon|null $reviewed_at
 * @property \Illuminate\Support\Carbon|null $decision_at
 * @property string|null $decision_reason
 * @property \Illuminate\Support\Carbon|null $license_expires_at
 * @property string|null $notes
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Admin|null $assignedReviewer
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\VerificationAudit> $audits
 * @property int|null audits_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\VerificationDocument> $documents
 * @property int|null documents_count
 * @property-read \App\Models\Profile $profile
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\VerificationQueueAssignment> $queueAssignments
 * @property int|null queue_assignments_count
 * @property-read \App\Models\User|null $user
 *
 * @method static \Database\Factories\ProfileVerificationFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereAssignedReviewerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereAttachmentManifest($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereDecisionAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereDecisionReason($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereFraudFlags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereLicenseExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereRequestType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereReviewedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereReviewedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereRiskScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereSubmittedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereSubmittedData($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ProfileVerification whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class ProfileVerification extends Model
{
    use HasFactory;

    protected $fillable = [
        'profile_id',
        'user_id',
        'request_type',
        'status',
        'submitted_data',
        'attachment_manifest',
        'risk_score',
        'fraud_flags',
        'submitted_at',
        'reviewed_by',
        'assigned_reviewer_id',
        'reviewed_at',
        'decision_at',
        'decision_reason',
        'notes',
        'license_expires_at',
    ];

    protected $casts = [
        'status' => ProfileVerificationStatus::class,
        'submitted_data' => 'array',
        'reviewed_at' => 'datetime',
        'submitted_at' => 'datetime',
        'decision_at' => 'datetime',
        'risk_score' => 'decimal:2',
        'attachment_manifest' => 'array',
        'fraud_flags' => 'array',
        'license_expires_at' => 'date',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function assignedReviewer(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'assigned_reviewer_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(VerificationDocument::class, 'verification_id');
    }

    public function audits(): HasMany
    {
        return $this->hasMany(VerificationAudit::class, 'verification_id');
    }

    public function queueAssignments(): HasMany
    {
        return $this->hasMany(VerificationQueueAssignment::class, 'verification_id');
    }
}
