<?php

namespace Database\Factories;
use App\Models\Country;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Country>
 */
final class CountryFactory extends Factory
{
	protected $model = Country::class;

	#[\Override]
	/**
	 * @return string[]
	 *
	 * @psalm-return array{name: string}
	 */
	public function definition(): array
	{
		return [
			'name' => $this->faker->unique()->country(),
		];
	}
}

