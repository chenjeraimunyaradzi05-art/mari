<?php

/**
 * Counter Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $counter_one
 * @property string $title_one
 * @property int $counter_two
 * @property string $title_two
 * @property int $counter_three
 * @property string $title_three
 * @property int $counter_four
 * @property string $title_four
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Counter newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Counter newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Counter query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Counter whereCounterFour($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Counter whereCounterOne($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Counter whereCounterThree($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Counter whereCounterTwo($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Counter whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Counter whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Counter whereTitleFour($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Counter whereTitleOne($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Counter whereTitleThree($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Counter whereTitleTwo($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Counter whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class Counter extends Model
{
    use HasFactory;

    protected $fillable = [
        'id',
        'counter_one',
        'title_one',
        'counter_two',
        'title_two',
        'counter_three',
        'title_three',
        'counter_four',
        'title_four',
    ];
}
