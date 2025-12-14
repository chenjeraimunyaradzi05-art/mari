<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $name
 * @property string|null $display_name
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Candidate> $candidates
 * @property int|null candidates_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Pronoun newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Pronoun newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Pronoun query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Pronoun whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Pronoun whereDisplayName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Pronoun whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Pronoun whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Pronoun whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class Pronoun extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'display_name',
    ];

    /**
     * Get candidates using this pronoun
     */
    public function candidates()
    {
        return $this->hasMany(Candidate::class);
    }
}
