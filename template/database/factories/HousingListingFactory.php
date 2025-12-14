<?php

namespace Database\Factories;

use App\Models\HousingListing;
use App\Models\OrganizationPage;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<HousingListing>
 */
final class HousingListingFactory extends Factory
{
    protected $model = HousingListing::class;

    #[\Override]
    /**
     * @return (OrganizationPageFactory|\Illuminate\Support\Carbon|mixed|null|scalar|string[])[]
     *
     * @psalm-return array{uuid: string, org_page_id: OrganizationPageFactory, landlord_user_id: null, title: string, slug: string, listing_type: 'rent', property_type: mixed, furnished: bool, bedrooms: int, bathrooms: int, parking_spaces: int, rent_cents: int, rent_frequency: 'monthly', bond_cents: int, currency: 'AUD', available_from: \Illuminate\Support\Carbon, occupancy_preference: 'women_only', safety_level: 'vetted', amenities: list{'secure_entry', 'public_transport'}, house_rules: list{'no_smoking'}, safety_features: list{'cctv'}, address_line1: string, suburb: string, region: mixed, postcode: string, country: 'Australia', latitude: float, longitude: float, status: 'published', verification_status: 'verified'}
     */
    public function definition(): array
    {
        $title = $this->faker->sentence(3);

        return [
            'uuid' => (string) Str::uuid(),
            'org_page_id' => OrganizationPage::factory(),
            'landlord_user_id' => null,
            'title' => $title,
            'slug' => Str::slug($title.'-'.$this->faker->unique()->numberBetween(10, 99)),
            'listing_type' => 'rent',
            'property_type' => $this->faker->randomElement(['apartment', 'townhouse']),
            'furnished' => $this->faker->boolean(),
            'bedrooms' => $this->faker->numberBetween(1, 4),
            'bathrooms' => $this->faker->numberBetween(1, 2),
            'parking_spaces' => $this->faker->numberBetween(0, 2),
            'rent_cents' => $this->faker->numberBetween(40000, 120000),
            'rent_frequency' => 'monthly',
            'bond_cents' => $this->faker->numberBetween(80000, 160000),
            'currency' => 'AUD',
            'available_from' => now()->addWeeks(2),
            'occupancy_preference' => 'women_only',
            'safety_level' => 'vetted',
            'amenities' => ['secure_entry', 'public_transport'],
            'house_rules' => ['no_smoking'],
            'safety_features' => ['cctv'],
            'address_line1' => $this->faker->streetAddress(),
            'suburb' => $this->faker->city(),
            'region' => $this->faker->stateAbbr(),
            'postcode' => $this->faker->postcode(),
            'country' => 'Australia',
            'latitude' => $this->faker->latitude(-44, -10),
            'longitude' => $this->faker->longitude(112, 154),
            'status' => 'published',
            'verification_status' => 'verified',
        ];
    }
}
