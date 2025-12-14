<?php

declare(strict_types=1);

namespace Database\Factories\WomenRealEstate;

use App\Enums\WomenRealEstate\ListingAudience;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenListingAudiencePivot;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\WomenRealEstate\WomenListingAudiencePivot>
 */
final class WomenListingAudiencePivotFactory extends Factory
{
    protected $model = WomenListingAudiencePivot::class;

    #[\Override]
    /**
     * @return (WomenListingFactory|mixed)[]
     *
     * @psalm-return array{listing_id: WomenListingFactory, audience: mixed}
     */
    public function definition(): array
    {
        return [
            'listing_id' => WomenListing::factory(),
            'audience' => $this->faker->randomElement(ListingAudience::cases())->value,
        ];
    }
}

