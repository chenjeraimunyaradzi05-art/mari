<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $name
 * @property string $code
 * @property string|null $description
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Candidate> $candidates
 * @property int|null candidates_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DriverLicenseType newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DriverLicenseType newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DriverLicenseType query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DriverLicenseType whereCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DriverLicenseType whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DriverLicenseType whereDescription($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DriverLicenseType whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DriverLicenseType whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|DriverLicenseType whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
final class DriverLicenseType extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'description',
    ];

    /**
     * Get candidates with this license type
     */
    public function candidates()
    {
        return $this->hasMany(Candidate::class);
    }
}
