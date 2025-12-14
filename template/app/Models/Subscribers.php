<?php
/**
 * Subscribers Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $email
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Subscribers newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Subscribers newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Subscribers query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Subscribers whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Subscribers whereEmail($value)
 * @method static \\Illuminate\Database\Eloquent\Builder<static>|Subscribers whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Subscribers whereUpdatedAt($value)
 * @mixin \Eloquent
 */
final class Subscribers extends Model
{
    use HasFactory;
}

