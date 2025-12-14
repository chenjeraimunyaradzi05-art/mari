<?php

namespace App\Http\Requests\Advertising;

use App\Models\AdvertisingCampaign;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

/**
 * @property \Illuminate\Support\Carbon|null|null $name
 * @property \Illuminate\Support\Carbon|null|null $objective
 * @property array<int, mixed>|null $starts_at
 * @property array<int, mixed>|null $ends_at
 * @property array<int, mixed>|null $daily_budget
 * @property array<int, mixed>|null $lifetime_budget
 * @property array<int, mixed>|null $creative_brief
 * @property array<int, mixed>|null $targeting
 * @property array<int, mixed>|null $targeting.locations
 * @property array<int, mixed>|null $targeting.keywords
 * @property array<int, mixed>|null $targeting.seniority_levels
 * @property array<int, mixed>|null $targeting.notes
 * @property array<int, mixed>|null $tracking_parameters
 * @property string|null $tracking_parameters.utm_source
 * @property string|null $tracking_parameters.utm_medium
 * @property array<int, mixed>|null $tracking_parameters.utm_campaign
 * @property int|null $tracking_parameters.utm_term
 * @property int|null $tracking_parameters.utm_content
 * @property int|null $audience_segments
 * @property int|null $audience_segments.*
 */
class StoreCampaignRequest extends FormRequest
{


	/**
	 * @return (\Illuminate\Validation\Rules\In|string)[][]
	 *
	 * @psalm-return array{name: list{'required', 'string', 'max:150'}, objective: list{'required', \Illuminate\Validation\Rules\In}, starts_at: list{'nullable', 'date'}, ends_at: list{'nullable', 'date', 'after_or_equal:starts_at'}, daily_budget: list{'nullable', 'numeric', 'min:0'}, lifetime_budget: list{'nullable', 'numeric', 'min:0'}, creative_brief: list{'nullable', 'string'}, targeting: list{'nullable', 'array'}, 'targeting.locations': list{'nullable', 'string', 'max:300'}, 'targeting.keywords': list{'nullable', 'string', 'max:300'}, 'targeting.seniority_levels': list{'nullable', 'string', 'max:200'}, 'targeting.notes': list{'nullable', 'string', 'max:1000'}, tracking_parameters: list{'nullable', 'array'}, 'tracking_parameters.utm_source': list{'nullable', 'string', 'max:120'}, 'tracking_parameters.utm_medium': list{'nullable', 'string', 'max:120'}, 'tracking_parameters.utm_campaign': list{'nullable', 'string', 'max:120'}, 'tracking_parameters.utm_term': list{'nullable', 'string', 'max:120'}, 'tracking_parameters.utm_content': list{'nullable', 'string', 'max:120'}, audience_segments: list{'nullable', 'array'}, 'audience_segments.*': list{'integer'}}
	 */
	public function rules(): array
	{
		return [
			'name' => ['required', 'string', 'max:150'],
			'objective' => ['required', Rule::in(['awareness', 'lead_generation', 'hiring', 'event_promotion'])],
			'starts_at' => ['nullable', 'date'],
			'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
			'daily_budget' => ['nullable', 'numeric', 'min:0'],
			'lifetime_budget' => ['nullable', 'numeric', 'min:0'],
			'creative_brief' => ['nullable', 'string'],
			'targeting' => ['nullable', 'array'],
			'targeting.locations' => ['nullable', 'string', 'max:300'],
			'targeting.keywords' => ['nullable', 'string', 'max:300'],
			'targeting.seniority_levels' => ['nullable', 'string', 'max:200'],
			'targeting.notes' => ['nullable', 'string', 'max:1000'],
			'tracking_parameters' => ['nullable', 'array'],
			'tracking_parameters.utm_source' => ['nullable', 'string', 'max:120'],
			'tracking_parameters.utm_medium' => ['nullable', 'string', 'max:120'],
			'tracking_parameters.utm_campaign' => ['nullable', 'string', 'max:120'],
			'tracking_parameters.utm_term' => ['nullable', 'string', 'max:120'],
			'tracking_parameters.utm_content' => ['nullable', 'string', 'max:120'],
			'audience_segments' => ['nullable', 'array'],
			'audience_segments.*' => ['integer'],
		];
	}

	#[\Override]
	protected function prepareForValidation(): void
	{
		$this->merge([
			'daily_budget' => $this->normalizeCurrency($this->input('daily_budget')),
			'lifetime_budget' => $this->normalizeCurrency($this->input('lifetime_budget')),
		]);
	}

	/**
	 * @return (\Illuminate\Support\Stringable|array|mixed|null|string)[]
	 *
	 * @psalm-return array{name: \Illuminate\Support\Stringable, status: 'draft', objective: mixed, starts_at: mixed, ends_at: mixed, daily_budget: mixed, lifetime_budget: mixed, creative_brief: mixed|null, targeting: array|null, tracking_parameters: array|null}
	 */
	public function campaignData(): array
	{
		$targeting = $this->formatTargeting();
		$tracking = $this->formatTrackingParameters();

		return [
			'name' => $this->string('name')->trim(),
			'status' => AdvertisingCampaign::STATUS_DRAFT,
			'objective' => $this->input('objective'),
			'starts_at' => $this->input('starts_at'),
			'ends_at' => $this->input('ends_at'),
			'daily_budget' => $this->input('daily_budget'),
			'lifetime_budget' => $this->input('lifetime_budget'),
			'creative_brief' => $this->filled('creative_brief') ? $this->input('creative_brief') : null,
			'targeting' => $targeting ?: null,
			'tracking_parameters' => $tracking ?: null,
		];
	}

	protected function normalizeCurrency($value): string|null
	{
		if ($value === null || $value === '') {
			return null;
		}

		if (is_numeric($value)) {
			return (string) $value;
		}

		$normalized = preg_replace('/[^0-9.\-]/', '', (string) $value);

		return $normalized === '' ? null : $normalized;
	}

	/**
	 * @return (array|mixed)[]
	 *
	 * @psalm-return array{locations?: array, keywords?: array, seniority_levels?: array, notes?: mixed}
	 */
	protected function formatTargeting(): array
	{
		$targeting = $this->input('targeting', []);

		$locations = $this->splitToArray(Arr::get($targeting, 'locations'));
		$keywords = $this->splitToArray(Arr::get($targeting, 'keywords'));
		$seniority = $this->splitToArray(Arr::get($targeting, 'seniority_levels'));
		$notes = Arr::get($targeting, 'notes');

		$formatted = [];

		if (! empty($locations)) {
			$formatted['locations'] = $locations;
		}

		if (! empty($keywords)) {
			$formatted['keywords'] = $keywords;
		}

		if (! empty($seniority)) {
			$formatted['seniority_levels'] = $seniority;
		}

		if ($notes) {
			$formatted['notes'] = $notes;
		}

		return $formatted;
	}

	protected function formatTrackingParameters(): array
	{
		$tracking = array_filter((array) $this->input('tracking_parameters', []), static function ($value) {
			return $value !== null && $value !== '';
		});

		return $tracking;
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
