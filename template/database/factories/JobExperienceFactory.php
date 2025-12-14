<?php

namespace Database\Factories;

use App\Models\JobExperience;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<JobExperience>
 */
final class JobExperienceFactory extends Factory
{
	protected $model = JobExperience::class;

	#[\Override]
	/**
	 * @return string[]
	 *
	 * @psalm-return array{name: string, slug: string}
	 */
	public function definition(): array
	{
		$name = $this->faker->randomElement(['Entry Level', 'Mid Level', 'Senior', 'Lead']).' '.Str::upper(Str::random(3));
		return [
			'name' => $name,
			'slug' => Str::slug($name.'-'.Str::random(5)),
		];
	}
}

