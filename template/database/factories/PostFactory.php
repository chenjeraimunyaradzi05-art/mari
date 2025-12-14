<?php

namespace Database\Factories;

use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

final class PostFactory extends Factory
{
    protected $model = Post::class;

    #[\Override]
    /**
     * @return (UserFactory|mixed|null|string)[]
     *
     * @psalm-return array{user_id: UserFactory, content: string, media: null, type: mixed, visibility: mixed}
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'content' => $this->faker->paragraph(),
            'media' => null,
            'type' => $this->faker->randomElement(['status', 'insight', 'share']),
            'visibility' => $this->faker->randomElement(['public', 'private']),
        ];
    }

    public function public(): static
    {
        return $this->state(fn () => ['visibility' => 'public']);
    }

    public function withMedia(): static
    {
        return $this->state(function () {
            // simple media payload that will satisfy 'media not null' tests
            return [
                // store as JSON string to avoid DB insertion errors on non-JSON column types
                'media' => json_encode([
                    [
                        'type' => 'image',
                        'url' => $this->faker->imageUrl(640, 480, 'nature'),
                    ],
                ]),
            ];
        });
    }
}

