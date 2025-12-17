<?php

namespace Database\Factories;

use App\Models\OrgMediaAsset;
use App\Models\OrgPost;
use App\Models\OrganizationPage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrgPost>
 */
final class OrgPostFactory extends Factory
{
    protected $model = OrgPost::class;

    /**
     * @return (OrganizationPageFactory|OrgMediaAssetFactory|array|string)[]
     */
    #[\Override]
    public function definition(): array
    {
        return [
            'org_page_id' => OrganizationPage::factory(),
            'title' => $this->faker->sentence(6),
            'content' => $this->faker->paragraph(3),
            'media_id' => OrgMediaAsset::factory(),
            'visibility' => $this->faker->randomElement(['public','followers']),
            'tags' => [],
            'likes' => 0,
            'comments' => 0,
            'shares' => 0,
            'watch_time' => 0,
            'scheduled_at' => null,
            'published_at' => now(),
            'meta' => [],
        ];
    }
}
