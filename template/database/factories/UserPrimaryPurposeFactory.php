<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\UserPrimaryPurpose;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UserPrimaryPurpose>
 */
final class UserPrimaryPurposeFactory extends Factory
{
    protected $model = UserPrimaryPurpose::class;

    #[\Override]
    /**
     * @return (UserFactory|\Closure|\Illuminate\Support\Carbon|array|int|mixed|null|string)[]
     *
     * @psalm-return array{user_id: UserFactory, primary_purpose: mixed, secondary_intents: array, feature_flags: \Closure(array):mixed, identity_alignment: 'woman_identifying', purpose_story: string, male_signal_notes: null, completion_step: 2, completed_at: \Illuminate\Support\Carbon}
     */
    public function definition(): array
    {
        $purpose = $this->faker->randomElement(array_keys(config('signup.primary_purposes')));
        $intents = array_keys(config('signup.secondary_intents'));

        return [
            'user_id' => User::factory(),
            'primary_purpose' => $purpose,
            'secondary_intents' => $this->faker->randomElements($intents, 2),
            'feature_flags' => function (array $attributes) use ($purpose) {
                $resolvedPurpose = $attributes['primary_purpose'] ?? $purpose;

                return config("signup.primary_purposes.{$resolvedPurpose}.feature_flags", []);
            },
            'identity_alignment' => 'woman_identifying',
            'purpose_story' => $this->faker->sentence(12),
            'male_signal_notes' => null,
            'completion_step' => 2,
            'completed_at' => now(),
        ];
    }
}

