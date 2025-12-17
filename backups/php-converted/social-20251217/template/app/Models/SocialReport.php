<?php

namespace App\Models;

use App\Models\Admin;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int|null $reporter_profile_id
 * @property string $reportable_type
 * @property int $reportable_id
 * @property string $category
 * @property string $severity
 * @property string|null $description
 * @property string $status
 * @property string|null $resolution_notes
 * @property int|null $reviewer_id
 * @property \Illuminate\Support\Carbon|null $reviewed_at
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialEnforcementAction> $enforcementActions
 * @property int|null enforcement_actions_count
 * @property-read Model|\Eloquent $reportable
 * @property-read \App\Models\SocialProfile|null $reporter
 * @property-read Admin|null $reviewer
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport open()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport whereReportableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport whereReportableType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport whereReporterProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport whereResolutionNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport whereReviewedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport whereReviewerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport whereSeverity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialReport whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialReport extends Model
{
    use HasFactory;

    protected $fillable = [
        'reporter_profile_id',
        'reportable_type',
        'reportable_id',
        'category',
        'severity',
        'description',
        'status',
        'resolution_notes',
        'reviewer_id',
        'reviewed_at',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'reviewed_at' => 'datetime',
    ];

    public function reporter()
    {
        return $this->belongsTo(SocialProfile::class, 'reporter_profile_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(Admin::class, 'reviewer_id');
    }

    public function reportable()
    {
        return $this->morphTo();
    }

    public function enforcementActions()
    {
        return $this->hasMany(SocialEnforcementAction::class, 'report_id');
    }

    public function scopeOpen($query)
    {
        return $query->whereIn('status', ['open', 'triage', 'under_review']);
    }
}

