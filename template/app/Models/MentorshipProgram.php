<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uuid
 * @property int|null $org_page_id
 * @property int|null $mentor_user_id
 * @property string $title
 * @property string $slug
 * @property string|null $focus_area
 * @property string|null $delivery_mode
 * @property int|null $capacity
 * @property int|null $duration_minutes
 * @property int|null $price_cents
 * @property string $currency
 * @property float $revenue_share
 * @property array<array-key, mixed>|null $matching_criteria
 * @property array<array-key, mixed>|null $impact_metrics
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\MentorshipCohort> $cohorts
 * @property int|null cohorts_count
 * @property-read \App\Models\User|null $mentor
 * @property-read \App\Models\OrganizationPage|null $organizationPage
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\MentorshipSession> $sessions
 * @property int|null sessions_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereCapacity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereCurrency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereDeliveryMode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereDurationMinutes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereFocusArea($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereImpactMetrics($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereMatchingCriteria($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereMentorUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereOrgPageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram wherePriceCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereRevenueShare($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram whereUuid($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MentorshipProgram withoutTrashed()
 *
 * @mixin \Eloquent
 */
final class MentorshipProgram extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'uuid',
        'org_page_id',
        'mentor_user_id',
        'title',
        'slug',
        'focus_area',
        'delivery_mode',
        'capacity',
        'duration_minutes',
        'price_cents',
        'currency',
        'revenue_share',
        'matching_criteria',
        'impact_metrics',
        'status',
    ];

    protected $casts = [
        'capacity' => 'int',
        'duration_minutes' => 'int',
        'price_cents' => 'int',
        'revenue_share' => 'float',
        'matching_criteria' => 'array',
        'impact_metrics' => 'array',
    ];

    #[\Override]
    protected static function booted(): void
    {
        self::creating(function (MentorshipProgram $program): void {
            if (blank($program->uuid)) {
                $program->uuid = (string) Str::uuid();
            }

            static::ensureSlug($program);
        });

        self::saving(function (MentorshipProgram $program): void {
            static::ensureSlug($program);
        });
    }

    protected static function ensureSlug(MentorshipProgram $program): void
    {
        if (blank($program->slug) && filled($program->title)) {
            $program->slug = Str::slug($program->title);
        }

        if (filled($program->slug)) {
            $program->slug = self::uniqueSlug($program->slug, $program->id);
        }
    }

    protected static function uniqueSlug(string $slug, ?int $ignoreId = null): string
    {
        $base = Str::slug($slug) ?: 'mentorship';
        $unique = $base;
        $counter = 1;

        while (self::where('slug', $unique)
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->exists()) {
            $unique = $base.'-'.$counter++;
        }

        return $unique;
    }

    public function organizationPage(): BelongsTo
    {
        return $this->belongsTo(OrganizationPage::class, 'org_page_id');
    }

    public function mentor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mentor_user_id');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(MentorshipSession::class, 'program_id');
    }

    public function cohorts(): HasMany
    {
        return $this->hasMany(MentorshipCohort::class, 'mentorship_program_id');
    }
}
