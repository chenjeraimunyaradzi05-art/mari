<?php

namespace App\Models;

use App\Models\Admin;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $subject_type
 * @property int $subject_id
 * @property string $action_type
 * @property string|null $reason
 * @property string|null $notes
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $takes_effect_at
 * @property \Illuminate\Support\Carbon|null $expires_at
 * @property int|null $issued_by
 * @property string $issued_by_type
 * @property int|null $report_id
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\SocialBlock|null $block
 * @property-read Admin|null $issuedBy
 * @property-read \App\Models\SocialReport|null $report
 * @property-read Model|\Eloquent $subject
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction whereActionType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction whereExpiresAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction whereIssuedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction whereIssuedByType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction whereReason($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction whereReportId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction whereSubjectId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction whereSubjectType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction whereTakesEffectAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SocialEnforcementAction whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class SocialEnforcementAction extends Model
{
    use HasFactory;

    protected $fillable = [
        'subject_type',
        'subject_id',
        'action_type',
        'reason',
        'notes',
        'status',
        'takes_effect_at',
        'expires_at',
        'issued_by',
        'issued_by_type',
        'report_id',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'takes_effect_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function subject()
    {
        return $this->morphTo();
    }

    public function report()
    {
        return $this->belongsTo(SocialReport::class);
    }

    public function issuedBy()
    {
        return $this->belongsTo(Admin::class, 'issued_by');
    }

    public function block()
    {
        return $this->hasOne(SocialBlock::class, 'enforcement_action_id');
    }

    public function isActive(): bool
    {
        if ($this->status === 'lifted') {
            return false;
        }

        if ($this->expires_at && $this->expires_at->isPast()) {
            return false;
        }

        return in_array($this->status, ['scheduled', 'active'], true);
    }
}

