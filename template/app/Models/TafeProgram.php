<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $tafe_institution_id
 * @property string $title
 * @property string $slug
 * @property string $credential_level
 * @property string $delivery_mode
 * @property int|null $duration_weeks
 * @property int|null $weekly_commitment_hours
 * @property int|null $tuition_from_aud
 * @property int|null $tuition_to_aud
 * @property array<array-key, mixed>|null $funding_options
 * @property array<array-key, mixed>|null $ai_match_traits
 * @property array<array-key, mixed>|null $outcomes
 * @property array<array-key, mixed>|null $support_services
 * @property array<array-key, mixed>|null $tags
 * @property string|null $summary
 * @property string|null $ai_recommendation_snippet
 * @property string|null $cta_label
 * @property string|null $application_url
 * @property string $status
 * @property float $ai_match_score
 * @property \Illuminate\Support\Carbon|null $last_ai_sync_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \App\Models\TafeInstitution $institution
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TafeProgramIntake> $intakes
 * @property int|null intakes_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TafeProgramIntake> $upcomingIntakes
 * @property int|null upcoming_intakes_count
 * @method static Builder<static>|TafeProgram credential(?string $credential)
 * @method static Builder<static>|TafeProgram deliveryMode(?string $mode)
 * @method static Builder<static>|TafeProgram newModelQuery()
 * @method static Builder<static>|TafeProgram newQuery()
 * @method static Builder<static>|TafeProgram onlyTrashed()
 * @method static Builder<static>|TafeProgram published()
 * @method static Builder<static>|TafeProgram query()
 * @method static Builder<static>|TafeProgram whereAiMatchScore($value)
 * @method static Builder<static>|TafeProgram whereAiMatchTraits($value)
 * @method static Builder<static>|TafeProgram whereAiRecommendationSnippet($value)
 * @method static Builder<static>|TafeProgram whereApplicationUrl($value)
 * @method static Builder<static>|TafeProgram whereCreatedAt($value)
 * @method static Builder<static>|TafeProgram whereCredentialLevel($value)
 * @method static Builder<static>|TafeProgram whereCtaLabel($value)
 * @method static Builder<static>|TafeProgram whereDeletedAt($value)
 * @method static Builder<static>|TafeProgram whereDeliveryMode($value)
 * @method static Builder<static>|TafeProgram whereDurationWeeks($value)
 * @method static Builder<static>|TafeProgram whereFundingOptions($value)
 * @method static Builder<static>|TafeProgram whereId($value)
 * @method static Builder<static>|TafeProgram whereLastAiSyncAt($value)
 * @method static Builder<static>|TafeProgram whereOutcomes($value)
 * @method static Builder<static>|TafeProgram whereSlug($value)
 * @method static Builder<static>|TafeProgram whereStatus($value)
 * @method static Builder<static>|TafeProgram whereSummary($value)
 * @method static Builder<static>|TafeProgram whereSupportServices($value)
 * @method static Builder<static>|TafeProgram whereTafeInstitutionId($value)
 * @method static Builder<static>|TafeProgram whereTags($value)
 * @method static Builder<static>|TafeProgram whereTitle($value)
 * @method static Builder<static>|TafeProgram whereTuitionFromAud($value)
 * @method static Builder<static>|TafeProgram whereTuitionToAud($value)
 * @method static Builder<static>|TafeProgram whereUpdatedAt(final $value)
 * @method static Builder<static>|TafeProgram whereWeeklyCommitmentHours($value)
 * @method static Builder<static>|TafeProgram withTrashed(bool $withTrashed = true)
 * @method static Builder<static>|TafeProgram withoutTrashed()
 * @method static \Database\Factories\TafeProgramFactory factory($count = null, $state = [])
 * @mixin \Eloquent
 */
final class TafeProgram extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'tafe_institution_id',
        'title',
        'slug',
        'credential_level',
        'delivery_mode',
        'duration_weeks',
        'weekly_commitment_hours',
        'tuition_from_aud',
        'tuition_to_aud',
        'funding_options',
        'ai_match_traits',
        'outcomes',
        'support_services',
        'tags',
        'summary',
        'ai_recommendation_snippet',
        'cta_label',
        'application_url',
        'status',
        'ai_match_score',
        'last_ai_sync_at',
    ];

    protected $casts = [
        'funding_options' => 'array',
        'ai_match_traits' => 'array',
        'outcomes' => 'array',
        'support_services' => 'array',
        'tags' => 'array',
        'ai_match_score' => 'float',
        'last_ai_sync_at' => 'datetime',
    ];

    #[\Override]
    protected static function booted(): void
    {
        static::saving(function (TafeProgram $program): void {
            if (blank($program->slug) && filled($program->title)) {
                $program->slug = Str::slug($program->title);
            }

            if ($program->isDirty('slug')) {
                $program->slug = static::uniqueSlug($program->slug, $program->tafe_institution_id, $program->id);
            }
        });
    }

    public function institution(): BelongsTo
    {
        return $this->belongsTo(TafeInstitution::class, 'tafe_institution_id');
    }

    public function intakes(): HasMany
    {
        return $this->hasMany(TafeProgramIntake::class);
    }

    /**
     * @psalm-return HasMany<Model, Model>
     */
    public function upcomingIntakes(): HasMany
    {
        return $this->intakes()->where(function ($query) {
            $query->whereNull('start_date')->orWhere('start_date', '>=', now()->startOfDay());
        });
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopePublished(Builder $builder): Builder
    {
        return $builder->where('status', 'published');
    }

    public function scopeCredential(Builder $builder, ?string $credential): Builder
    {
        return $credential ? $builder->where('credential_level', $credential) : $builder;
    }

    public function scopeDeliveryMode(Builder $builder, ?string $mode): Builder
    {
        return $mode ? $builder->where('delivery_mode', $mode) : $builder;
    }

    /**
     * @return string
     *
     * @psalm-return 'slug'
     */
    #[\Override]
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    private static function uniqueSlug(string $slug, int $institutionId, ?int $ignoreId = null): string
    {
        $base = Str::slug($slug) ?: 'program';
        $candidate = $base;
        $counter = 1;

        while (static::where('tafe_institution_id', $institutionId)
            ->where('slug', $candidate)
            ->when($ignoreId, fn (Builder $query) => $query->where('id', '!=', $ignoreId))
            ->exists()) {
            $candidate = $base.'-'.$counter++;
        }

        return $candidate;
    }
}
