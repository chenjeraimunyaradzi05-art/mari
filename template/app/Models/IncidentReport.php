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
 * @property int $reporter_user_id
 * @property int|null $subject_user_id
 * @property int|null $org_page_id
 * @property string $category
 * @property string $severity
 * @property string $description
 * @property string $status
 * @property array<array-key, mixed>|null $metadata
 * @property \Illuminate\Support\Carbon|null $occurred_at
 * @property \Illuminate\Support\Carbon|null $resolved_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\IncidentEvent> $events
 * @property int|null events_count
 * @property-read \App\Models\OrganizationPage|null $organizationPage
 * @property-read \App\Models\User $reporter
 * @property-read \App\Models\User|null $subject
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport onlyTrashed()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport whereMetadata($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport whereOccurredAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport whereOrgPageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport whereReporterUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport whereResolvedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport whereSeverity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport whereSubjectUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport whereUuid($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport withTrashed(bool $withTrashed = true)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IncidentReport withoutTrashed()
 *
 * @mixin \Eloquent
 */
final class IncidentReport extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'uuid',
        'reporter_user_id',
        'subject_user_id',
        'org_page_id',
        'category',
        'severity',
        'description',
        'status',
        'metadata',
        'occurred_at',
        'resolved_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'occurred_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    #[\Override]
    protected static function booted(): void
    {
        self::creating(function (IncidentReport $incident): void {
            if (blank($incident->uuid)) {
                $incident->uuid = (string) Str::uuid();
            }
        });
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_user_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(User::class, 'subject_user_id');
    }

    public function organizationPage(): BelongsTo
    {
        return $this->belongsTo(OrganizationPage::class, 'org_page_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(IncidentEvent::class, 'incident_id');
    }
}
