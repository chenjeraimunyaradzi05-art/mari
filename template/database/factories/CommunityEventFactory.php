<?php

namespace Database\Factories;

use App\Models\CommunityEvent;
use App\Models\CommunityGroup;
use App\Models\SocialProfile;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<CommunityEvent>
 */
final class CommunityEventFactory extends Factory
{
    protected $model = CommunityEvent::class;

    #[\Override]
    /**
     * @return (CommunityGroupFactory|SocialProfileFactory|\Illuminate\Support\Carbon|bool[]|int|mixed|null|string)[]
     *
     * @psalm-return array{community_group_id: CommunityGroupFactory, community_chapter_id: null, mentorship_cohort_id: null, created_by_profile_id: SocialProfileFactory, title: string, slug: string, event_type: mixed, format: mixed, starts_at: \Illuminate\Support\Carbon, ends_at: \Illuminate\Support\Carbon, timezone: 'Australia/Sydney', capacity: int, location: string, stream_url: string, metadata: array{featured: bool}, visibility: 'public', status: 'published'}
     */
    public function definition(): array
    {
        $title = $this->faker->sentence(3);

        return [
            'community_group_id' => CommunityGroup::factory(),
            'community_chapter_id' => null,
            'mentorship_cohort_id' => null,
            'created_by_profile_id' => SocialProfile::factory(),
            'title' => $title,
            'slug' => Str::slug($title).'-'.$this->faker->unique()->numberBetween(10, 99),
            'event_type' => $this->faker->randomElement(['networking', 'workshop', 'webinar']),
            'format' => $this->faker->randomElement(['in_person', 'virtual']),
            'starts_at' => now()->addDays($this->faker->numberBetween(3, 30)),
            'ends_at' => now()->addDays($this->faker->numberBetween(3, 30))->addHours(2),
            'timezone' => 'Australia/Sydney',
            'capacity' => $this->faker->numberBetween(20, 250),
            'location' => $this->faker->address(),
            'stream_url' => $this->faker->url(),
            'metadata' => ['featured' => $this->faker->boolean()],
            'visibility' => 'public',
            'status' => 'published',
        ];
    }
}

