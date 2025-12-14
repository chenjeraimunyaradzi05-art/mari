<?php

namespace Database\Factories;

use App\Models\JobCategory;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<JobCategory>
 */
final class JobCategoryFactory extends Factory
{
	protected $model = JobCategory::class;

	#[\Override]
	/**
	 * @return (array|false|string)[]
	 *
	 * @psalm-return array{icon: 'fa-briefcase', name: array|string, slug: string, show_at_popular: false, show_at_featured: false}
	 */
	public function definition(): array
	{
		$name = $this->faker->unique()->words(2, true);
		return [
			'icon' => 'fa-briefcase',
			'name' => $name,
			'slug' => Str::slug($name.'-'.Str::random(5)),
			'show_at_popular' => false,
			'show_at_featured' => false,
		];
	}
}

