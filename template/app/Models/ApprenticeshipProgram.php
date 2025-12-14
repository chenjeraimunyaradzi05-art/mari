<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

/**
 * @property int $id
 * @property int $org_page_id
 * @property string $title
 * @property string|null $summary
 * @property array<array-key, mixed>|null $requirements
 * @property string|null $location
 * @property int|null $duration_weeks
 * @property string|null $application_url
 * @property string $status
 * @property array<array-key, mixed>|null $meta
 * @property string|null $published_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property string|null $deleted_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ApprenticeshipCompetency> $competencies
 * @property int|null competencies_count
 * @property-read \App\Models\OrganizationPage $page
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgram newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgram newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgram query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgram whereApplicationUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgram whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgram whereDeletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgram whereDurationWeeks($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgram whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgram whereLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgram whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgram whereOrgPageId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgram wherePublishedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgram whereRequirements($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgram whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgram whereSummary($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgram whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgram whereUpdatedAt($value)
 *
 * @property-read string|null $description
 * @property-read int $duration_months
 * @property-read string $provider_name
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ApprenticeshipProgressRecord> $progressRecords
 * @property int|null progress_records_count
 *
 * @method static \Database\Factories\ApprenticeshipProgramFactory factory($count = null, $state = [])
 *
 * @mixin \Eloquent
 */
final class ApprenticeshipProgram extends Model
{
    use HasFactory;

    protected $fillable = [
        'org_page_id',
        'title',
        'summary',
        'requirements',
        'location',
        'duration_weeks',
        'application_url',
        'status',
        'meta',
    ];

    protected $casts = [
        'requirements' => 'array',
        'meta' => 'array',
    ];

    public function page(): BelongsTo
    {
        return $this->belongsTo(OrganizationPage::class, 'org_page_id');
    }

    public function competencies(): HasMany
    {
        return $this->hasMany(ApprenticeshipCompetency::class);
    }

    public function progressRecords(): HasManyThrough
    {
        return $this->hasManyThrough(ApprenticeshipProgressRecord::class, ApprenticeshipCompetency::class);
    }

    public function getProviderNameAttribute(): string
    {
        return $this->page->name ?? 'Unknown Provider';
    }

    public function getDescriptionAttribute(): ?string
    {
        return $this->summary;
    }

    public function getDurationMonthsAttribute(): int
    {
        return $this->duration_weeks ? (int) round($this->duration_weeks / 4) : 0;
    }
}
