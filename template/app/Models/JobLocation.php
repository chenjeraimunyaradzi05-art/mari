<?php

/**
 * JobLocation Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property string $image
 * @property int $country_id
 * @property string|null $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Country|null $country
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobLocation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobLocation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobLocation query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobLocation whereCountryId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobLocation whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobLocation whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>final |JobLocation whereImage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobLocation whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|JobLocation whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class JobLocation extends Model
{
    use HasFactory;

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }
}
