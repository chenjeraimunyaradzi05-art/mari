<?php

/**
 * IndustryType Model
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Models;

use Cviebrock\EloquentSluggable\Sluggable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property string|null $slug
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Company> $companies
 * @property int|null companies_count
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IndustryType findSimilarSlugs(string $attribute, array $config, string $slug)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IndustryType newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IndustryType newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IndustryType query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IndustryType whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IndustryType whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IndustryType whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IndustryType whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IndustryType whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|IndustryType withUniqueSlugConstraints(\Illuminate\Database\Eloquent\Model $model, string $attribute, array $config, string $slug)
 *
 * @mixin \Eloquent
 */
final class IndustryType extends Model
{
    use HasFactory, Sluggable;

    protected $fillable = ['name'];

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

    public function companies(): HasMany
    {
        return $this->hasMany(Company::class, 'industry_type_id', 'id');
    }
}
