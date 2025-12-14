<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $apprenticeship_competency_id
 * @property int $candidate_id
 * @property int|null $assessed_by
 * @property string $status
 * @property int|null $proficiency
 * @property string|null $evidence
 * @property string|null $coach_notes
 * @property \Illuminate\Support\Carbon|null $started_at
 * @property \Illuminate\Support\Carbon|null $completed_at
 * @property \Illuminate\Support\Carbon|null $assessed_at
 * @property array<array-key, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\User|null $assessor
 * @property-read \App\Models\Candidate $candidate
 * @property-read \App\Models\ApprenticeshipCompetency $competency
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgressRecord newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgressRecord newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgressRecord query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgressRecord whereApprenticeshipCompetencyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgressRecord whereAssessedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgressRecord whereAssessedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgressRecord whereCandidateId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgressRecord whereCoachNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgressRecord whereCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgressRecord whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgressRecord whereEvidence($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgressRecord whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgressRecord whereMeta($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgressRecord whereProficiency($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgressRecord whereStartedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgressRecord whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|ApprenticeshipProgressRecord whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class ApprenticeshipProgressRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'apprenticeship_competency_id',
        'candidate_id',
        'assessed_by',
        'status',
        'proficiency',
        'evidence',
        'coach_notes',
        'started_at',
        'completed_at',
        'assessed_at',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'assessed_at' => 'datetime',
    ];

    public function competency(): BelongsTo
    {
        return $this->belongsTo(ApprenticeshipCompetency::class, 'apprenticeship_competency_id');
    }

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class, 'candidate_id');
    }

    public function assessor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assessed_by');
    }
}
