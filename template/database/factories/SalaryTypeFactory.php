<?php

namespace Database\Factories;

use App\Models\SalaryType;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<SalaryType>
 */
final class SalaryTypeFactory extends Factory
{
	protected $model = SalaryType::class;

	#[\Override]
	/**
	 * @return string[]
	 *
	 * @psalm-return array{name: string, slug: string}
	 */
	public function definition(): array
	{
		$name = $this->faker->randomElement(['Monthly', 'Yearly', 'Hourly']).' '.Str::upper(Str::random(3));
		return [
			'name' => $name,
			'slug' => Str::slug($name.'-'.Str::random(5)),
		];
	}
}


