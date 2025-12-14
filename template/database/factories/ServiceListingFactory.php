<?php

namespace Database\Factories;

use App\Models\ServiceListing;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

final class ServiceListingFactory extends Factory
{
    protected $model = ServiceListing::class;

    #[\Override]
    /**
     * @return (\Illuminate\Support\Carbon|array|mixed|scalar)[]
     *
     * @psalm-return array{uuid: string, name: string, slug: string, category: mixed, city: string, state: string, country: 'AU', location_slug: string, description: string, modalities: array, availability_options: array, perks: list{string}, tags: array|string, hero_image: string, price_tier: mixed, price_copy: string, booking_cta: mixed, rating: float, review_count: int, is_sponsored: bool, published_at: \Illuminate\Support\Carbon, metadata: array{seeded: true}}
     */
    public function definition(): array
    {
        $city = $this->faker->city();
        $state = strtoupper($this->faker->lexify('??'));

        return [
            'uuid' => (string) Str::uuid(),
            'name' => $this->faker->company(),
            'slug' => Str::slug($this->faker->unique()->company()),
            'category' => $this->faker->randomElement(['fitness', 'beauty', 'pets']),
            'city' => $city,
            'state' => $state,
            'country' => 'AU',
            'location_slug' => Str::slug($city . '_' . strtolower($state)),
            'description' => $this->faker->sentence(12),
            'modalities' => $this->faker->randomElements(['in-person', 'virtual', 'mobile'], 2),
            'availability_options' => $this->faker->randomElements(['childcare', 'after-hours', 'ndis', 'weekend'], 2),
            'perks' => [$this->faker->sentence(6)],
            'tags' => $this->faker->words(3),
            'hero_image' => $this->faker->imageUrl(900, 600, 'business'),
            'price_tier' => $this->faker->randomElement(['accessible', 'standard', 'premium']),
            'price_copy' => '$' . $this->faker->numberBetween(40, 190) . ' per session',
            'booking_cta' => $this->faker->randomElement(['Request intro', 'Book intro call', 'Reserve a spot']),
            'rating' => $this->faker->randomFloat(2, 4, 5),
            'review_count' => $this->faker->numberBetween(12, 250),
            'is_sponsored' => $this->faker->boolean(20),
            'published_at' => now()->subDays($this->faker->numberBetween(1, 90)),
            'metadata' => ['seeded' => true],
        ];
    }
}

