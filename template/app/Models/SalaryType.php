<?php

/**
 * SalaryType Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Cviebrock\EloquentSluggable\Sluggable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Database\Factories\SalaryTypeFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SalaryType findSimilarSlugs(string $attribute, array $config, string $slug)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SalaryType newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SalaryType newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SalaryType query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SalaryType whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SalaryType whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SalaryType whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SalaryType whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SalaryType final whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SalaryType withUniqueSlugConstraints(\Illuminate\Database\Eloquent\Model $model, string $attribute, array $config, string $slug)
 *
 * @mixin \Eloquent
 */
final class SalaryType extends Model
{
    use HasFactory, Sluggable;

    /**
     * @return string[][]
     *
     * @psalm-return array{slug: array{source: 'name'}}
     */
    #[\Override]
    public function sluggable(): array
    {
        return [
            'slug' => [
                'source' => 'name',
            ],
        ];
    }
}
