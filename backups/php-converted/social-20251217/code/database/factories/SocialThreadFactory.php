<?php

namespace Database\Factories;

use App\Enums\SocialThreadRequestMode;
use App\Enums\SocialThreadStatus;
use App\Enums\SocialThreadType;
use App\Models\SocialProfile;
use App\Models\SocialThread;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SocialThread>
 */
final class SocialThreadFactory extends Factory
{
    protected $model = SocialThread::class;

    #[\Override]
    /**
     * @return (App\Enums\SocialThreadRequestMode::Followers|App\Enums\SocialThreadStatus::Active|App\Enums\SocialThreadType::Direct|SocialProfileFactory|\Illuminate\Support\Carbon|false|int|string|string[])[]
     *
     * @psalm-return array{created_by_social_profile_id: SocialProfileFactory, thread_type: App\Enums\SocialThreadType::Direct, status: App\Enums\SocialThreadStatus::Active, message_request_mode: App\Enums\SocialThreadRequestMode::Followers, subject: string, is_system: false, spam_score: 0, metadata: array{seed: string}, last_message_at: \Illuminate\Support\Carbon}
     */
    public function definition(): array
    {
        return [
            'created_by_social_profile_id' => SocialProfile::factory(),
            'thread_type' => SocialThreadType::Direct,
            'status' => SocialThreadStatus::Active,
            'message_request_mode' => SocialThreadRequestMode::Followers,
            'subject' => $this->faker->optional()->sentence(5),
            'is_system' => false,
            'spam_score' => 0,
            'metadata' => ['seed' => $this->faker->uuid()],
            'last_message_at' => now(),
        ];
    }
}
