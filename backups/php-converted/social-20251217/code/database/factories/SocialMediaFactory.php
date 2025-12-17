<?php

namespace Database\Factories;

use App\Models\SocialMedia;
use App\Models\SocialPost;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\SocialMedia>
 */
final class SocialMediaFactory extends Factory
{
    protected $model = SocialMedia::class;

    #[\Override]
    /**
     * @return ((array|float|mixed|string)[]|SocialPostFactory|int|mixed|null|string)[]
     *
     * @psalm-return array{social_post_id: SocialPostFactory, media_type: mixed, file_path: string, thumbnail_path: null|string, mime_type: 'image/jpeg'|'video/mp4', file_size: int, width: int, height: int, duration: int|null, order: 0, ai_analysis: array{objects: array|string, score: float}, filters: array{name: mixed}|null}
     */
    public function definition(): array
    {
        $type = $this->faker->randomElement(['image', 'video']);

        return [
            'social_post_id' => SocialPost::factory(),
            'media_type' => $type,
            'file_path' => 'social/'.$this->faker->uuid().($type === 'video' ? '.mp4' : '.jpg'),
            'thumbnail_path' => $type === 'video' ? 'social/thumbs/'.$this->faker->uuid().'.jpg' : null,
            'mime_type' => $type === 'video' ? 'video/mp4' : 'image/jpeg',
            'file_size' => $this->faker->numberBetween(50_000, 2_000_000),
            'width' => $this->faker->numberBetween(640, 1920),
            'height' => $this->faker->numberBetween(640, 1920),
            'duration' => $type === 'video' ? $this->faker->numberBetween(5, 60) : null,
            'order' => 0,
            'ai_analysis' => [
                'objects' => $this->faker->words(2),
                'score' => $this->faker->randomFloat(2, 0, 1),
            ],
            'filters' => $this->faker->boolean(30) ? ['name' => $this->faker->randomElement(['clarendon', 'lark', 'moon'])] : null,
        ];
    }
}

