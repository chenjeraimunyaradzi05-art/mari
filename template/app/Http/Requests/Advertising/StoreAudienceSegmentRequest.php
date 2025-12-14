<?php

namespace App\Http\Requests\Advertising;

use Illuminate\Foundation\Http\FormRequest;

/**
 * @property array<int, mixed>|null $name
 * @property array<int, mixed>|null $description
 * @property array<int, mixed>|null $filters
 * @property int|null $filters.locations
 * @property int|null $filters.industries
 * @property int|null $filters.skills
 * @property int|null $filters.keywords
 * @property int|null $filters.experience_final min
 * @property int|null $filters.experience_max
 * @property string|null $filters.notes
 */
final class StoreAudienceSegmentRequest extends FormRequest
{


	/**
	 * @return (\Illuminate\Support\Stringable|array|mixed|null)[]
	 *
	 * @psalm-return array{name: \Illuminate\Support\Stringable, description: mixed|null, filters: array|null}
	 */
	public function segmentData(): array
	{
		$filters = $this->normalizeFilters();

		return [
			'name' => $this->string('name')->trim(),
			'description' => $this->filled('description') ? $this->input('description') : null,
			'filters' => $filters ?: null,
		];
	}

	/**
	 * @return (array|mixed)[]
	 *
	 * @psalm-return array{locations?: array, industries?: array, skills?: array, keywords?: array, experience?: array{min: int|null, max: int|null}, notes?: mixed}
	 */
	protected function normalizeFilters(): array
	{
		$filters = (array) $this->input('filters', []);

		$formatted = [];

		$locations = $this->splitToArray($filters['locations'] ?? null);
		if (! empty($locations)) {
			$formatted['locations'] = $locations;
		}

		$industries = $this->splitToArray($filters['industries'] ?? null);
		if (! empty($industries)) {
			$formatted['industries'] = $industries;
		}

		$skills = $this->splitToArray($filters['skills'] ?? null);
		if (! empty($skills)) {
			$formatted['skills'] = $skills;
		}

		$keywords = $this->splitToArray($filters['keywords'] ?? null);
		if (! empty($keywords)) {
			$formatted['keywords'] = $keywords;
		}

		$experienceMin = $filters['experience_min'] ?? null;
		$experienceMax = $filters['experience_max'] ?? null;

		if ($experienceMin !== null || $experienceMax !== null) {
			$formatted['experience'] = [
				'min' => $experienceMin !== null ? (int) $experienceMin : null,
				'max' => $experienceMax !== null ? (int) $experienceMax : null,
			];
		}

		if (! empty($filters['notes'])) {
			$formatted['notes'] = $filters['notes'];
		}

		return $formatted;
	}

	/**
	 * @return string[]
	 *
	 * @psalm-return array<int, string>
	 */
	protected function splitToArray($value): array
	{
		if ($value === null || $value === '') {
			return [];
		}

		if (is_array($value)) {
			return collect($value)
				->map(static fn ($item) => is_string($item) ? trim($item) : (string) $item)
				->filter()
				->values()
				->all();
		}

		return collect(preg_split('/[,\n]+/', (string) $value))
			->map(static fn ($item) => trim((string) $item))
			->filter()
			->values()
			->all();
	}
}
