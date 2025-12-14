<?php

namespace App\Models\Business;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $business_profile_id
 * @property string $title
 * @property string|null $category
 * @property string $status
 * @property int $progress_percent
 * @property \Illuminate\Support\Carbon|null $due_date
 * @property string|null $summary
 * @property string|null $ai_prompt
 * @property string|null $cta_label
 * @property string|null $cta_url
 * @property int $sort_order
 * @property \Illuminate\Support\Carbon|null $completed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Business\BusinessProfile $profile
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone whereAiPrompt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone whereBusinessProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone whereCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone whereCtaLabel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone whereCtaUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone whereDueDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone whereProgressPercent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone whereSortOrder($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone whereSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BusinessMilestone whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class BusinessMilestone extends Model
{
    use HasFactory;

    protected $fillable = [
        'business_profile_id',
        'title',
        'category',
        'status',
        'progress_percent',
        'due_date',
        'summary',
        'ai_prompt',
        'cta_label',
        'cta_url',
        'sort_order',
        'completed_at',
    ];

    protected $casts = [
        'due_date' => 'date',
        'completed_at' => 'datetime',
        'progress_percent' => 'integer',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(BusinessProfile::class, 'business_profile_id');
    }

    public function statusLabel(): string
    {
        return match ($this->status) {
            'in_progress' => 'In progress',
            'done' => 'Complete',
            default => 'Not started',
        };
    }
}

