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
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Religion newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Religion newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Religion query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Religion whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Religion whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Religion whereNamefinal ($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Religion whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class Religion extends Model
{
    use HasFactory;

    protected $fillable = ['name'];

    /**
     * Get candidates of this religion
     */
    public function candidates()
    {
        return $this->hasMany(Candidate::class);
    }
}
