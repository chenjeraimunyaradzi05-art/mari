<?php

namespace Database\Factories;

use App\Models\JobType;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<JobType>
 */
final class JobTypeFactory extends Factory
{
	protected $model = JobType::class;

	#[\Override]
	/**
	 * @return string[]
	 *
	 * @psalm-return array{name: string, slug: string}
	 */
	public function definition(): array
	{
		$name = $this->faker->randomElement(['Full-time', 'Part-time', 'Contract', 'Internship']).' '.Str::upper(Str::random(3));
		return [
			'name' => $name,
			'slug' => Str::slug($name.'-'.Str::random(5)),
		];
	}
}

