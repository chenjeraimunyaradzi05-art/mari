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
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MaritalStatus newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MaritalStatus newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MaritalStatus query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MaritalStatus whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MaritalStatus whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MaritalStatus whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MaritalStatus whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class MaritalStatus extends Model
{
    use HasFactory;

    protected $fillable = ['name'];

    /**
     * Get candidates with this marital status
     */
    public function candidates()
    {
        return $this->hasMany(Candidate::class);
    }
}
