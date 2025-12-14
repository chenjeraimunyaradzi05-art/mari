<?php

namespace Database\Factories;

use App\Models\OrganizationPage;
use App\Models\OrgInviteLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\OrgInviteLog>
 */
final class OrgInviteLogFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = OrgInviteLog::class;

    /**
     * Define the model's default state.
     *
     * @return (OrganizationPageFactory|UserFactory|array|mixed|null|string)[]
     *
     * @psalm-return array{org_page_id: OrganizationPageFactory, email: string, invited_by: UserFactory, channel: mixed, status: 'pending', meta: array<never, never>, sent_at: null}
     */
    #[\Override]
    public function definition(): array
    {
        return [
            'org_page_id' => OrganizationPage::factory(),
            'email' => $this->faker->unique()->safeEmail(),
            'invited_by' => User::factory(),
            'channel' => $this->faker->randomElement(['email', 'sms']),
            'status' => 'pending',
            'meta' => [],
            'sent_at' => null,
        ];
    }
}
