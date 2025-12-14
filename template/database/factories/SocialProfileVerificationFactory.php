<?php

namespace Database\Factories;

use App\Enums\SocialVerificationStatus;
use App\Models\SocialProfile;
use App\Models\SocialProfileVerification;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SocialProfileVerification>
 */
final class SocialProfileVerificationFactory extends Factory
{
    protected $model = SocialProfileVerification::class;

    #[\Override]
    /**
     * @return (App\Enums\SocialVerificationStatus::Pending|SocialProfileFactory|UserFactory|\Illuminate\Support\Carbon|mixed|null|string)[]
     *
     * @psalm-return array{social_profile_id: SocialProfileFactory, user_id: UserFactory, request_type: mixed, status: App\Enums\SocialVerificationStatus::Pending, evidence_urls: null, attachments: null, notes: string, review_notes: null, submitted_at: \Illuminate\Support\Carbon}
     */
    public function definition(): array
    {
        return [
            'social_profile_id' => SocialProfile::factory(),
            'user_id' => User::factory(),
            'request_type' => $this->faker->randomElement(['government_id', 'organization_email', 'document_upload']),
            'status' => SocialVerificationStatus::Pending,
            'evidence_urls' => null,
            'attachments' => null,
            'notes' => $this->faker->sentence(6),
            'review_notes' => null,
            'submitted_at' => now()->subDay(),
        ];
    }
}

