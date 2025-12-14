<?php

namespace Database\Factories;

use App\Models\Admin;
use App\Models\AdminLoginAudit;
use Illuminate\Database\Eloquent\Factories\Factory;

final class AdminLoginAuditFactory extends Factory
{
    protected $model = AdminLoginAudit::class;

    public function definition(): array
    {
        return [
            'admin_id' => Admin::factory(),
            'source' => 'admin',
            'timezone' => $this->faker->timezone(),
            'offset_minutes' => $this->faker->numberBetween(-720, 720),
            'ip_address' => $this->faker->ipv4(),
            'user_agent' => $this->faker->userAgent(),
            'logged_in_at' => now(),
            'meta' => [],
        ];
    }
}
