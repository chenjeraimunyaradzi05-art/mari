<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $tafe_program_id
 * @property string $intake_name
 * @property \Illuminate\Support\Carbon|null $start_date
 * @property \Illuminate\Support\Carbon|null $end_date
 * @property \Illuminate\Support\Carbon|null $application_deadline
 * @property bool $is_virtual
 * @property int|null $seats_available
 * @property array<array-key, mixed>|null $location
 * @property float $ai_demand_index
 * @property string|null $notes
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\TafeProgram $program
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeProgramIntake newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeProgramIntake newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeProgramIntake query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeProgramIntake whereAiDemandIndex($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeProgramIntake whereApplicationDeadline($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeProgramIntake whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeProgramIntake whereEndDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeProgramIntake whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeProgramIntake whereIntakeName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeProgramIntake whereIsVirtual($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeProgramIntake whereLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeProgramIntake whereNotes($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeProgramIntake whereSeatsAvailable($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeProgramIntake whereStartDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeProgramIntake whereTafeProgramId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TafeProgramIntake whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class TafeProgramIntake extends Model
{
    use HasFactory;

    protected $fillable = [
        'tafe_program_id',
        'intake_name',
        'start_date',
        'end_date',
        'application_deadline',
        'is_virtual',
        'seats_available',
        'location',
        'ai_demand_index',
        'notes',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'application_deadline' => 'date',
        'is_virtual' => 'boolean',
        'location' => 'array',
        'ai_demand_index' => 'float',
    ];

    public function program(): BelongsTo
    {
        return $this->belongsTo(TafeProgram::class, 'tafe_program_id');
    }
}

