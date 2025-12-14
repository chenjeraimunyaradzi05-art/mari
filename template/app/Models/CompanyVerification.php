<?php

namespace App\Models;

use App\Enums\CompanyVerificationStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $company_id
 * @property CompanyVerificationStatus $status
 * @property int|null $reviewer_id
 * @property array<array-key, mixed>|null $documents
 * @property string|null $notes
 * @property \Illuminate\Support\Carbon|null $submitted_at
 * @property \Illuminate\Support\Carbon|null $reviewed_at
 * @property string|null $evidence_path
 * @property string $source
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Company $company
 * @property-read \App\Models\Admin|null $reviewer
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CompanyVerification newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CompanyVerification newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CompanyVerification query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CompanyVerification whereCompanyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CompanyVerification whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CompanyVerification whereDocuments($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CompanyVerification whereEvidencePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CompanyVerification whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CompanyVerification whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CompanyVerification whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CompanyVerification whereReviewedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CompanyVerification whereReviewerId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CompanyVerification whereSource($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CompanyVerification whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CompanyVerification whereSubmittedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|CompanyVerification whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class CompanyVerification extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'status',
        'reviewer_id',
        'documents',
        'notes',
        'submitted_at',
        'reviewed_at',
        'evidence_path',
        'source',
        'metadata',
    ];

    protected $casts = [
        'status' => CompanyVerificationStatus::class,
        'documents' => 'array',
        'metadata' => 'array',
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(Admin::class, 'reviewer_id');
    }
}
