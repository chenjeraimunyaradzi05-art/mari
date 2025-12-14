<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\WomenHousingListing;
use App\Models\WomenListingPhoto;
use Illuminate\Database\Eloquent\Factories\Factory;

final class WomenListingPhotoFactory extends Factory
{
    protected $model = WomenListingPhoto::class;

    #[\Override]
    /**
     * @return ((int|string)[]|WomenHousingListingFactory|false|int|null|string)[]
     *
     * @psalm-return array{women_housing_listing_id: WomenHousingListingFactory, storage_path: string, cdn_url: null, caption: string, position: int, is_primary: false, meta: array{original_name: string, mime_type: 'image/jpeg', size_bytes: int}}
     */
    public function definition(): array
    {
        return [
            'women_housing_listing_id' => WomenHousingListing::factory(),
            'storage_path' => 'women-listings/' . $this->faker->uuid . '.jpg',
            'cdn_url' => null,
            'caption' => $this->faker->optional()->sentence(),
            'position' => $this->faker->numberBetween(1, 5),
            'is_primary' => false,
            'meta' => [
                'original_name' => $this->faker->lexify('photo??.jpg'),
                'mime_type' => 'image/jpeg',
                'size_bytes' => $this->faker->numberBetween(50000, 2000000),
            ],
        ];
    }
}

