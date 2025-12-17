<?php

namespace App\Models;

use App\Enums\SocialMessageReportStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $social_message_id
 * @property int $reporter_social_profile_id
 * @property int|null $incident_report_id
 * @property string|null $reason
 * @property string|null $notes
 * @property SocialMessageReportStatus $status
 * @property int|null $resolved_by_social_profile_id
 * @property \Illuminate\Support\Carbon|null $resolved_at
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \App\Models\IncidentReport|null $incident
 * @property-read \App\Models\SocialMessage $message
 * @property-read \App\Models\SocialProfile $reporter
 * @property-read \App\Models\SocialProfile|null $resolvedBy
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport whereIncidentReportId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport whereReason($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport whereReporterSocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport whereResolvedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport whereResolvedBySocialProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport whereSocialMessageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialMessageReport withoutTrashed()
 * @mixin \Eloquent
 */
final class SocialMessageReport extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'social_message_id',
        'reporter_social_profile_id',
        'incident_report_id',
        'reason',
        'notes',
        'status',
        'resolved_by_social_profile_id',
        'resolved_at',
        'metadata',
    ];

    protected $casts = [
        'status' => SocialMessageReportStatus::class,
        'resolved_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function message(): BelongsTo
    {
        return $this->belongsTo(SocialMessage::class, 'social_message_id');
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'reporter_social_profile_id');
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(SocialProfile::class, 'resolved_by_social_profile_id');
    }

    public function incident(): BelongsTo
    {
        return $this->belongsTo(IncidentReport::class, 'incident_report_id');
    }
}

