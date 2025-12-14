<?php

declare(strict_types=1);

namespace Database\Factories\WomenRealEstate;

use App\Models\WomenRealEstate\WomenListingLocation;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<\App\Models\WomenRealEstate\WomenListingLocation>
 */
final class WomenListingLocationFactory extends Factory
{
    protected $model = WomenListingLocation::class;

    #[\Override]
    /**
     * @return (float|mixed|null|string)[]
     *
     * @psalm-return array{parent_id: null, name: string, slug: string, type: mixed, latitude: float, longitude: float}
     */
    public function definition(): array
    {
        $name = $this->faker->unique()->city();

        return [
            'parent_id' => null,
            'name' => $name,
            'slug' => Str::slug($name . '-' . $this->faker->unique()->postcode()),
            'type' => $this->faker->randomElement(['suburb', 'city', 'region']),
            'latitude' => round($this->faker->latitude(min: -43, max: -10), 7),
            'longitude' => round($this->faker->longitude(min: 113, max: 154), 7),
        ];
    }
}
