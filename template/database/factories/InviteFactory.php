<?php

namespace Database\Factories;

use App\Models\Invite;
use App\Models\Profile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<\App\Models\Invite>
 */
final class InviteFactory extends Factory
{
    protected $model = Invite::class;

    #[\Override]
    /**
     * @return (ProfileFactory|UserFactory|null|string|string[][])[]
     *
     * @psalm-return array{sender_id: UserFactory, sender_profile_id: ProfileFactory, recipient_email: string, recipient_phone: null, channel: 'email', status: 'pending', token: string, referral_code: string, cohort_slug: string, type: 'social', message: string, payload: array{tags: list{'beta'}}}
     */
    public function definition(): array
    {
        return [
            'sender_id' => User::factory(),
            'sender_profile_id' => Profile::factory(),
            'recipient_email' => $this->faker->unique()->safeEmail(),
            'recipient_phone' => null,
            'channel' => 'email',
            'status' => 'pending',
            'token' => Str::uuid()->toString(),
            'referral_code' => Str::random(10),
            'cohort_slug' => $this->faker->slug(2),
            'type' => 'social',
            'message' => $this->faker->sentence(),
            'payload' => ['tags' => ['beta']],
        ];
    }
}
