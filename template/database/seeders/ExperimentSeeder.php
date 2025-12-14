<?php

namespace Database\Seeders;

use App\Models\Growth\Experiment;
use Illuminate\Database\Seeder;

final class ExperimentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Experiment::updateOrCreate(
            ['name' => 'landing_page_headline'],
            [
                'description' => 'Testing different headlines on the main landing page to improve signup conversion.',
                'status' => 'active',
                'variants' => ['control', 'empowerment_focus', 'career_focus'],
                'weights' => [
                    'control' => 34,
                    'empowerment_focus' => 33,
                    'career_focus' => 33,
                ],
                'started_at' => now(),
            ]
        );

        Experiment::updateOrCreate(
            ['name' => 'signup_button_color'],
            [
                'description' => 'Testing button colors for the primary signup CTA.',
                'status' => 'active',
                'variants' => ['blue', 'purple', 'green'],
                'weights' => [
                    'blue' => 34,
                    'purple' => 33,
                    'green' => 33,
                ],
                'started_at' => now(),
            ]
        );
    }
}

