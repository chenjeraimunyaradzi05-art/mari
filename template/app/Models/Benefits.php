<?php

/**
 * Benefits Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $company_id
 * @property string $name
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Benefits newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Benefits newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Benefits query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Benefits whereCompanyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Benefits whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Benefits whereId($value)
 * @method static\\Illuminate\Database\Eloquent\Builder<static>|Benefits whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Benefits whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class Benefits extends Model
{
    use HasFactory;
}
