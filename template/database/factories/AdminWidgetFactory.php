<?php

namespace Database\Factories;

use App\Models\Admin\Widget;
use Illuminate\Database\Eloquent\Factories\Factory;

class AdminWidgetFactory extends Factory
{
    protected $model = Widget::class;

    public function definition(): array
    {
        $name = $this->faker->words(2, true);

        return [
            'name' => $name,
            'slug' => str_replace(' ', '-', strtolower($name)),
            'settings' => [
                'visible' => true,
                'position' => 'sidebar',
            ],
        ];
    }
}
