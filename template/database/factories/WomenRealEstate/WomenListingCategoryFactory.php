<?php

declare(strict_types=1);

namespace Database\Factories\WomenRealEstate;

use App\Models\WomenRealEstate\WomenListingCategory;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<\App\Models\WomenRealEstate\WomenListingCategory>
 */
final class WomenListingCategoryFactory extends Factory
{
    protected $model = WomenListingCategory::class;

    #[\Override]
    /**
     * @return (mixed|string)[]
     *
     * @psalm-return array{name: string, slug: string, description: string, icon: mixed}
     */
    public function definition(): array
    {
        $name = $this->faker->unique()->words(nb: 3, asText: true);

        return [
            'name' => Str::title($name),
            'slug' => Str::slug($name),
            'description' => $this->faker->optional()->sentence(),
            'icon' => $this->faker->optional()->randomElement([
                'heroicons-outline-home-modern',
                'heroicons-outline-building-office',
                'heroicons-outline-users',
                'heroicons-outline-chart-bar',
            ]),
        ];
    }
}
