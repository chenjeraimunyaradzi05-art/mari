<?php

/**
 * OrganizationType Model
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
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrganizationType findSimilarSlugs(string $attribute, array $config, string $slug)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrganizationType newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrganizationType newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrganizationType query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrganizationType whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrganizationType whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrganizationType whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrganizationType whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrganizationType whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|OrganizationType withUniqueSlugConstraints(\Illuminate\Database\Eloquent\Model $model, string $attribute, array $config, string $slug)
 *
 * @mixin \Eloquent
 */
final class OrganizationType extends Model
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

    public function companies(): HasMany
    {
        return $this->hasMany(Company::class, 'organization_type_id', 'id');
    }
}
