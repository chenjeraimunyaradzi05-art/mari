<?php

namespace Database\Factories;

use App\Models\OrgMediaAsset;
use App\Models\OrganizationPage;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrgMediaAsset>
 */
final class OrgMediaAssetFactory extends Factory
{
    protected $model = OrgMediaAsset::class;

    /**
     * @return (OrganizationPageFactory|UserFactory|array|string)[]
     */
    #[\Override]
    public function definition(): array
    {
        return [
            'org_page_id' => OrganizationPage::factory(),
            'uploaded_by' => User::factory(),
            'type' => $this->faker->randomElement(['image','video']),
            'disk' => 'org_media',
            'original_filename' => $this->faker->word().'.jpg',
            'storage_path' => 'org_media/'.$this->faker->uuid().'.jpg',
            'processed_path' => null,
            'thumbnail_path' => null,
            'duration' => null,
            'captions_path' => null,
            'safety_labels' => [],
            'meta' => [],
            'status' => 'ready',
        ];
    }
}
