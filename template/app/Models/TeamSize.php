<?php
/**
 * TeamSize Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TeamSize newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TeamSize newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TeamSize query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TeamSize whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TeamSize whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TeamSize whereName($value)
 * @method static\\Illuminate\Database\Eloquent\Builder<static>|TeamSize whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|TeamSize whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class TeamSize extends Model
{
    use HasFactory;
}

