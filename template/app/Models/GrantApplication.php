<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $grant_program_id
 * @property int|null $user_id
 * @property string $status
 * @property int $progress_percent
 * @property int $funding_requested_cents
 * @property string|null $funding_use
 * @property string|null $project_summary
 * @property string|null $impact_statement
 * @property array|null $documents
 * @property bool $ready_for_review
 * @property \Illuminate\Support\Carbon|null $submitted_at
 * @property-read \App\Models\GrantProgram $program
 * @property-read \App\Models\User|null $user
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read float $funding_requested
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantApplication newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantApplication newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantApplication query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantApplication whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantApplication whereDocuments($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantApplication whereFundingRequestedCents($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantApplication whereFundingUse($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantApplication whereGrantProgramId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantApplication whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantApplication whereImpactStatement($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantApplication whereProgressPercent($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantApplication whereProjectSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantApplication whereReadyForReview($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantApplication whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantApplication whereSubmittedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantApplication whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|GrantApplication whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class GrantApplication extends Model
{
    use HasFactory;

    protected $fillable = [
        'grant_program_id',
        'user_id',
        'status',
        'progress_percent',
        'funding_requested_cents',
        'funding_use',
        'project_summary',
        'impact_statement',
        'documents',
        'ready_for_review',
        'submitted_at',
    ];

    protected $casts = [
        'documents' => 'array',
        'ready_for_review' => 'bool',
        'submitted_at' => 'datetime',
    ];

    public function program(): BelongsTo
    {
        return $this->belongsTo(GrantProgram::class, 'grant_program_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getFundingRequestedAttribute(): float
    {
        return $this->funding_requested_cents / 100;
    }

    public function updateProgress(): void
    {
        $fields = collect([
            $this->project_summary,
            $this->funding_use,
            $this->impact_statement,
            $this->funding_requested_cents > 0 ? 'amount' : null,
        ])->filter();

        $this->progress_percent = (int) round(($fields->count() / 4) * 100);
    }
}
