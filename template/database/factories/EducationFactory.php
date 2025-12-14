<?php

namespace Database\Factories;

use App\Models\Education;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Education>
 */
final class EducationFactory extends Factory
{
	protected $model = Education::class;

	#[\Override]
	/**
	 * @return string[]
	 *
	 * @psalm-return array{name: string, slug: string}
	 */
	public function definition(): array
	{
		$nameRoot = $this->faker->randomElement([
			'High School', 'Diploma', 'Bachelor', 'Master', 'PhD'
		]);
		$name = $nameRoot.' '.Str::upper(Str::random(3));
		return [
			'name' => $name,
			'slug' => Str::slug($name.'-'.Str::random(5)),
		];
	}
}

