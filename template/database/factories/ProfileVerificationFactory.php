<?php

namespace Database\Factories;

use App\Enums\ProfileVerificationStatus;
use App\Models\Profile;
use App\Models\ProfileVerification;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\ProfileVerification>
 */
final class ProfileVerificationFactory extends Factory
{
    protected $model = ProfileVerification::class;

    #[\Override]
    /**
     * @return ((int|string|string[])[]|App\Enums\ProfileVerificationStatus::Pending|ProfileFactory|UserFactory|\Illuminate\Support\Carbon|float|string)[]
     *
     * @psalm-return array{profile_id: ProfileFactory, user_id: UserFactory, request_type: 'document_upload', status: App\Enums\ProfileVerificationStatus::Pending, submitted_data: array{notes: string, evidence_urls: list{string}}, attachment_manifest: array{count: 0, disk: 'local', documents: array<never, never>}, risk_score: float, fraud_flags: array<never, never>, submitted_at: \Illuminate\Support\Carbon}
     */
    public function definition(): array
    {
        return [
            'profile_id' => Profile::factory(),
            'user_id' => User::factory(),
            'request_type' => 'document_upload',
            'status' => ProfileVerificationStatus::Pending,
            'submitted_data' => [
                'notes' => $this->faker->sentence(),
                'evidence_urls' => [$this->faker->url()],
            ],
            'attachment_manifest' => [
                'count' => 0,
                'disk' => 'local',
                'documents' => [],
            ],
            'risk_score' => 0.35,
            'fraud_flags' => [],
            'submitted_at' => now(),
        ];
    }
}
