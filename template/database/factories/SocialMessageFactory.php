<?php

namespace Database\Factories;

use App\Enums\SocialMessageStatus;
use App\Enums\SocialMessageType;
use App\Models\SocialMessage;
use App\Models\SocialProfile;
use App\Models\SocialThread;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SocialMessage>
 */
final class SocialMessageFactory extends Factory
{
    protected $model = SocialMessage::class;

    #[\Override]
    /**
     * @return (App\Enums\SocialMessageStatus::Sent|App\Enums\SocialMessageType::Text|SocialProfileFactory|SocialThreadFactory|\Illuminate\Support\Carbon|array|int|null|string)[]
     *
     * @psalm-return array{social_thread_id: SocialThreadFactory, sender_social_profile_id: SocialProfileFactory, message_type: App\Enums\SocialMessageType::Text, status: App\Enums\SocialMessageStatus::Sent, body: string, structured_body: null, sent_at: \Illuminate\Support\Carbon, spam_score: 0, moderation_flags: array<never, never>}
     */
    public function definition(): array
    {
        return [
            'social_thread_id' => SocialThread::factory(),
            'sender_social_profile_id' => SocialProfile::factory(),
            'message_type' => SocialMessageType::Text,
            'status' => SocialMessageStatus::Sent,
            'body' => $this->faker->sentence(12),
            'structured_body' => null,
            'sent_at' => now(),
            'spam_score' => 0,
            'moderation_flags' => [],
        ];
    }
}

