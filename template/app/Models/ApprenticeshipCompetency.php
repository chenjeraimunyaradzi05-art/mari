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
 * @property int $apprenticeship_program_id
 * @property string $title
 * @property string|null $slug
 * @property string|null $category
 * @property int $sequence
 * @property int $weight
 * @property string|null $description
 * @property string|null $expected_outcomes
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Illuminate\Support\Carbon|null $deleted_at
 * @property-read \App\Models\ApprenticeshipProgram $program
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ApprenticeshipProgressRecord> $progressRecords
 * @property int|null progress_records_count
 *
 * @method static Builder<static>|ApprenticeshipCompetency newModelQuery()
 * @method static Builder<static>|ApprenticeshipCompetency newQuery()
 * @method static Builder<static>|ApprenticeshipCompetency onlyTrashed()
 * @method static Builder<static>|ApprenticeshipCompetency query()
 * @method static Builder<static>|ApprenticeshipCompetency whereApprenticeshipProgramId($value)
 * @method static Builder<static>|ApprenticeshipCompetency whereCategory($value)
 * @method static Builder<static>|ApprenticeshipCompetency whereCreatedAt($value)
 * @method static Builder<static>|ApprenticeshipCompetency whereDeletedAt($value)
 * @method static Builder<static>|ApprenticeshipCompetency whereDescription($value)
 * @method static Builder<static>|ApprenticeshipCompetency whereExpectedOutcomes($value)
 * @method static Builder<static>|ApprenticeshipCompetency whereId($value)
 * @method static Builder<static>|ApprenticeshipCompetency whereMeta($value)
 * @method static Builder<static>|ApprenticeshipCompetency whereSequence($value)
 * @method static Builder<static>|ApprenticeshipCompetency whereSlug($value)
 * @method static Builder<static>|ApprenticeshipCompetency whereTitle($value)
 *
 * @final method static Builder<static>|ApprenticeshipCompetency whereUpdatedAt($value)
 *
 * @method static Builder<static>|ApprenticeshipCompetency whereWeight($value)
 * @method static Builder<static>|ApprenticeshipCompetency withTrashed(bool $withTrashed = true)
 * @method static Builder<static>|ApprenticeshipCompetency withoutTrashed()
 *
 * @mixin \Eloquent
 */
class ApprenticeshipCompetency extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'apprenticeship_program_id',
        'title',
        'slug',
        'category',
        'sequence',
        'weight',
        'description',
        'expected_outcomes',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    #[\Override]
    protected static function booted(): void
    {
        static::saving(function (ApprenticeshipCompetency $competency): void {
            if (blank($competency->slug) && filled($competency->title)) {
                $competency->slug = Str::slug($competency->title);
            }

            if (filled($competency->apprenticeship_program_id) && $competency->isDirty('slug') && filled($competency->slug)) {
                $competency->slug = static::uniqueSlug(
                    $competency->slug,
                    $competency->apprenticeship_program_id,
                    $competency->id
                );
            }

            if (blank($competency->sequence) && filled($competency->apprenticeship_program_id)) {
                $nextSequence = static::where('apprenticeship_program_id', $competency->apprenticeship_program_id)
                    ->max('sequence');

                $competency->sequence = (int) $nextSequence + 1;
            }
        });
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(ApprenticeshipProgram::class, 'apprenticeship_program_id');
    }

    public function progressRecords(): HasMany
    {
        return $this->hasMany(ApprenticeshipProgressRecord::class, 'apprenticeship_competency_id');
    }

    private static function uniqueSlug(string $slug, int $programId, ?int $ignoreId = null): string
    {
        $base = Str::slug($slug) ?: 'competency';
        $unique = $base;
        $counter = 1;

        while (static::where('apprenticeship_program_id', $programId)
            ->where('slug', $unique)
            ->when($ignoreId, fn (Builder $builder) => $builder->where('id', '!=', $ignoreId))
            ->exists()) {
            $unique = $base.'-'.$counter++;
        }

        return $unique;
    }
}
