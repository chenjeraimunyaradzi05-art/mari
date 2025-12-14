<?php

namespace Database\Factories;
use App\Enums\CompanyVerificationStatus;
use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * @extends Factory<Company>
 */
final class CompanyFactory extends Factory
{
	protected $model = Company::class;

	#[\Override]
	/**
	 * @return (UserFactory|false|null|string)[]
	 *
	 * @psalm-return array{user_id: UserFactory, name: string, slug: string, logo: null, banner: null, bio: string, vision: string, website: string, email: string, phone: string, country: null, state: null, city: null, address: string, map_link: null, is_profile_verified?: false, verification_status?: 'pending', verification_source?: 'dashboard', abn?: string, asic_number?: string, domain?: string, foundation_status?: 'inactive'}
	 */
	public function definition(): array
	{
		$name = $this->faker->company();

		$data = [
			'user_id' => User::factory(),
			'name' => $name,
			'slug' => Str::slug($name) . '-' . $this->faker->unique()->numberBetween(1000, 9999),
			'logo' => null,
			'banner' => null,
			'bio' => $this->faker->sentence(10),
			'vision' => $this->faker->sentence(12),
			'website' => $this->faker->url(),
			'email' => $this->faker->companyEmail(),
			'phone' => $this->faker->phoneNumber(),
			'country' => null,
			'state' => null,
			'city' => null,
			'address' => $this->faker->address(),
			'map_link' => null,
		];

		if (Schema::hasColumn('companies', 'is_profile_verified')) {
			$data['is_profile_verified'] = false;
		}

		if (Schema::hasColumn('companies', 'verification_status')) {
			$data['verification_status'] = CompanyVerificationStatus::Pending->value;
		}

		if (Schema::hasColumn('companies', 'verification_source')) {
			$data['verification_source'] = 'dashboard';
		}

		if (Schema::hasColumn('companies', 'abn')) {
			$data['abn'] = $this->faker->numerify('###########');
		}

		if (Schema::hasColumn('companies', 'asic_number')) {
			$data['asic_number'] = 'ACN' . $this->faker->numerify('#######');
		}

		if (Schema::hasColumn('companies', 'domain')) {
			$data['domain'] = $this->faker->domainName();
		}

		if (Schema::hasColumn('companies', 'foundation_status')) {
			$data['foundation_status'] = 'inactive';
		}

		return $data;
	}
}
