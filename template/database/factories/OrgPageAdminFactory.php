<?php

namespace Database\Factories;

use App\Models\OrgPageAdmin;
use App\Models\OrganizationPage;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrgPageAdmin>
 */
final class OrgPageAdminFactory extends Factory
{
    protected $model = OrgPageAdmin::class;

    /**
     * @return (OrganizationPageFactory|UserFactory|array|string)[]
     */
    #[\Override]
    public function definition(): array
    {
        return [
            'org_page_id' => OrganizationPage::factory(),
            'user_id' => User::factory(),
            'role' => $this->faker->randomElement(['owner', 'admin', 'editor', 'analyst']),
        ];
    }
}
