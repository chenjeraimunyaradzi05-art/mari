<?php

namespace Database\Factories;

use App\Models\JobRole;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<JobRole>
 */
final class JobRoleFactory extends Factory
{
	protected $model = JobRole::class;

	#[\Override]
	/**
	 * @return string[]
	 *
	 * @psalm-return array{name: string, slug: string}
	 */
	public function definition(): array
	{
		$name = $this->faker->unique()->jobTitle();
		return [
			'name' => $name,
			'slug' => Str::slug($name.'-'.Str::random(5)),
		];
	}
}

