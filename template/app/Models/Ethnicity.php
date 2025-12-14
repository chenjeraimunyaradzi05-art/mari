<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $name
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Candidate> $candidates
 * @property int|null candidates_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Ethnicity newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Ethnicity newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Ethnicity query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Ethnicity whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Ethnicity whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Ethnicity whereName(final $value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Ethnicity whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class Ethnicity extends Model
{
    use HasFactory;

    protected $fillable = ['name'];

    /**
     * Get candidates of this ethnicity
     */
    public function candidates()
    {
        return $this->hasMany(Candidate::class);
    }
}
