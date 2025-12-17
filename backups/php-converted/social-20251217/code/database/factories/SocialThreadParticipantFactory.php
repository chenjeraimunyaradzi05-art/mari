<?php

namespace Database\Factories;

use App\Enums\SocialThreadParticipantRole;
use App\Enums\SocialThreadParticipantStatus;
use App\Models\SocialProfile;
use App\Models\SocialThread;
use App\Models\SocialThreadParticipant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SocialThreadParticipant>
 */
final class SocialThreadParticipantFactory extends Factory
{
    protected $model = SocialThreadParticipant::class;

    #[\Override]
    /**
     * @return (App\Enums\SocialThreadParticipantRole::Member|App\Enums\SocialThreadParticipantStatus::Active|SocialProfileFactory|SocialThreadFactory|\Illuminate\Support\Carbon|true)[]
     *
     * @psalm-return array{social_thread_id: SocialThreadFactory, social_profile_id: SocialProfileFactory, role: App\Enums\SocialThreadParticipantRole::Member, status: App\Enums\SocialThreadParticipantStatus::Active, joined_at: \Illuminate\Support\Carbon, notifications_enabled: true}
     */
    public function definition(): array
    {
        return [
            'social_thread_id' => SocialThread::factory(),
            'social_profile_id' => SocialProfile::factory(),
            'role' => SocialThreadParticipantRole::Member,
            'status' => SocialThreadParticipantStatus::Active,
            'joined_at' => now(),
            'notifications_enabled' => true,
        ];
    }
}

