<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $slug
 * @property string $name
 * @property string $provider_name
 * @property string $provider_type
 * @property string|null $location_restriction
 * @property int|null $max_amount_cents
 * @property string $currency
 * @property array|null $required_documents
 * @property array|null $eligibility_requirements
 * @property array|null $tags
 * @property array|null $missing_criteria
 * @property array|null $states
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\GrantApplication> $applications
 * @property \Illuminate\Support\Carbon|null $opens_at
 * @property \Illuminate\Support\Carbon|null $closes_at
 * @property \Illuminate\Support\Carbon|null $decision_at
 * @property string|null $application_url
 * @property string|null $description
 * @property int|null $match_score
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property int|null applications_count
 * @property-read float|null $max_amount
 *
 * @method static \Database\Factories\GrantProgramFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereApplicationUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereClosesAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereCurrency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereDecisionAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereEligibilityRequirements($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereLocationRestriction($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereMatchScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereMaxAmountCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereMissingCriteria($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereOpensAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereProviderName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereProviderType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereRequiredDocuments($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereStates($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereTags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantProgram whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class GrantProgram extends Model
{
    use HasFactory;

    protected $fillable = [
        'slug',
        'name',
        'provider_name',
        'provider_type',
        'location_restriction',
        'max_amount_cents',
        'currency',
        'opens_at',
        'closes_at',
        'decision_at',
        'application_url',
        'description',
        'required_documents',
        'eligibility_requirements',
        'tags',
        'match_score',
        'missing_criteria',
        'states',
    ];

    protected $casts = [
        'opens_at' => 'date',
        'closes_at' => 'date',
        'decision_at' => 'date',
        'required_documents' => 'array',
        'eligibility_requirements' => 'array',
        'tags' => 'array',
        'missing_criteria' => 'array',
        'states' => 'array',
    ];

    #[\Override]
    protected static function booted(): void
    {
        self::creating(function (self $program): void {
            if (blank($program->slug)) {
                $program->slug = Str::slug($program->name);
            }
        });
    }

    public function applications(): HasMany
    {
        return $this->hasMany(GrantApplication::class);
    }

    /**
     * @psalm-return 'slug'
     */
    #[\Override]
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function getMaxAmountAttribute(): ?float
    {
        return $this->max_amount_cents !== null ? $this->max_amount_cents / 100 : null;
    }
}
