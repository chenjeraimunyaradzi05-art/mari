<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Education;
use App\Models\Job;
use App\Models\JobCategory;
use App\Models\JobExperience;
use App\Models\JobRole;
use App\Models\JobType;
use App\Models\SalaryType;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Job>
 */
final class JobFactory extends Factory
{
	protected $model = Job::class;

	public function definition(): array
	{
		$title = $this->faker->jobTitle();
		$min = $this->faker->numberBetween(40000, 90000);
		$max = $min + $this->faker->numberBetween(5000, 50000);

		return [
			'company_id' => Company::factory(),
			'job_category_id' => JobCategory::factory(),
			'job_role_id' => JobRole::factory(),
			'job_experience_id' => JobExperience::factory(),
			'education_id' => Education::factory(),
			'job_type_id' => JobType::factory(),
			'salary_type_id' => SalaryType::factory(),
			'title' => $title,
			'slug' => Str::slug($title . '-' . Str::random(6)),
			'vacancies' => (string) $this->faker->numberBetween(1, 5),
			'min_salary' => $min,
			'max_salary' => $max,
			'deadline' => $this->faker->dateTimeBetween('+1 week', '+2 months')->format('Y-m-d'),
			'description' => $this->faker->paragraphs(3, true),
			'status' => 'active',
			'workflow_stage' => 'new',
			'workflow_status' => 'approved',
			'workflow_priority' => 'normal',
			'workflow_source' => 'factory',
			// column is enum('app','email','custom_url') - use valid options
			'apply_on' => $this->faker->randomElement(['email', 'custom_url']),
			'apply_email' => $this->faker->safeEmail(),
			'apply_url' => $this->faker->url(),
			'total_views' => 0,
			// database enum expects one of: 'range', 'custom'
			'salary_mode' => 'range',
			'company_name' => null,
		];
	}
}

