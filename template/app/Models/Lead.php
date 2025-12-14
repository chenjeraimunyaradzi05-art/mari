<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $org_page_id
 * @property string $type
 * @property string|null $contact_name
 * @property string|null $contact_email
 * @property string|null $contact_phone
 * @property array<array-key, mixed> $payload
 * @property string|null $source
 * @property string $status
 * @property int|null $qualification_score
 * @property string|null $qualification_grade
 * @property string|null $qualification_priority
 * @property array<array-key, mixed>|null $qualification_factors
 * @property string|null $ai_summary
 * @property string|null $ai_recommendations
 * @property int|null $assigned_to
 * @property array<array-key, mixed>|null $utm
 * @property \Illuminate\Support\Carbon|null $submitted_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User|null $assignedUser
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\LeadNote> $notes
 * @property int|null notes_count
 * @property-read \App\Models\OrganizationPage $page
 *
 * @method static Builder<static>|Lead forCompany(int $companyId)
 * @method static Builder<static>|Lead newModelQuery()
 * @method static Builder<static>|Lead newQuery()
 * @method static Builder<static>|Lead query()
 * @method static Builder<static>|Lead whereAiRecommendations($value)
 * @method static Builder<static>|Lead whereAiSummary($value)
 * @method static Builder<static>|Lead whereAssignedTo($value)
 * @method static Builder<static>|Lead whereContactEmail($value)
 * @method static Builder<static>|Lead whereContactName($value)
 * @method static Builder<static>|Lead whereContactPhone($value)
 * @method static Builder<static>|Lead whereCreatedAt($value)
 * @method static Builder<static>|Lead whereId($value)
 * @method static Builder<static>|Lead whereOrgPageId($value)
 * @method static Builder<static>|Lead wherePayload($value)
 * @method static Builder<static>|Lead whereQualificationFactors($value)
 * @method static Builder<static>|Lead whereQualificationGrade($value)
 * @method static Builder<static>|Lead whereQualificationPriority($value)
 * @method static Builder<static>|Lead whereQualificationScore($value)
 * @method static Builder<static>|Lead whereSource($value)
 * @method static Builder<static>|Lead whereStatus($value)
 * @method static Builder<static>|Lead whereSubmittedAt($value)
 * @method static Builder<static>|Lead whereType($value)
 * @method static Builder<static>|Lead whereUpdatedAt($value)
 * @method static Builder<static>|Lead whereUtm($value)
 *
 * @mixin \Eloquent
 */
final class Lead extends Model
{
    use HasFactory;

    protected $fillable = [
        'org_page_id',
        'type',
        'contact_name',
        'contact_email',
        'contact_phone',
        'payload',
        'source',
        'status',
        'assigned_to',
        'utm',
        'submitted_at',
        'qualification_score',
        'qualification_grade',
        'qualification_priority',
        'qualification_factors',
        'ai_summary',
        'ai_recommendations',
    ];

    protected $casts = [
        'payload' => 'array',
        'utm' => 'array',
        'submitted_at' => 'datetime',
        'qualification_factors' => 'array',
    ];

    public function page(): BelongsTo
    {
        return $this->belongsTo(OrganizationPage::class, 'org_page_id');
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(LeadNote::class)->latest();
    }

    /**
     * @psalm-return Builder<Model>
     */
    public function scopeForCompany(Builder $query, int $companyId): Builder
    {
        return $query->whereHas('page', function (Builder $builder) use ($companyId) {
            $builder->where('company_id', $companyId);
        });
    }
}
