<?php

namespace Database\Factories;

use App\Enums\SocialMessageRequestStatus;
use App\Models\SocialMessageRequest;
use App\Models\SocialProfile;
use App\Models\SocialThread;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SocialMessageRequest>
 */
final class SocialMessageRequestFactory extends Factory
{
    protected $model = SocialMessageRequest::class;

    #[\Override]
    /**
     * @return (App\Enums\SocialMessageRequestStatus::Pending|SocialProfileFactory|SocialThreadFactory|\Illuminate\Support\Carbon|string[])[]
     *
     * @psalm-return array{social_thread_id: SocialThreadFactory, requester_social_profile_id: SocialProfileFactory, target_social_profile_id: SocialProfileFactory, status: App\Enums\SocialMessageRequestStatus::Pending, expires_at: \Illuminate\Support\Carbon, context: array{subject: string}}
     */
    public function definition(): array
    {
        return [
            'social_thread_id' => SocialThread::factory(),
            'requester_social_profile_id' => SocialProfile::factory(),
            'target_social_profile_id' => SocialProfile::factory(),
            'status' => SocialMessageRequestStatus::Pending,
            'expires_at' => now()->addDays(14),
            'context' => ['subject' => $this->faker->sentence(4)],
        ];
    }
}

