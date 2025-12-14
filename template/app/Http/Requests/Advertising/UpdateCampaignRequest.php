<?php

namespace App\Http\Requests\Advertising;

use App\Models\AdvertisingCampaign;
use Illuminate\Validation\Rule;

final class UpdateCampaignRequest extends StoreCampaignRequest
{
	/**
	 * @return (\Illuminate\Validation\Rules\In|string)[][]
	 *
	 * @psalm-return array{name: list{'required', 'string', 'max:150'}, objective: list{'required', \Illuminate\Validation\Rules\In}, starts_at: list{'nullable', 'date'}, ends_at: list{'nullable', 'date', 'after_or_equal:starts_at'}, daily_budget: list{'nullable', 'numeric', 'min:0'}, lifetime_budget: list{'nullable', 'numeric', 'min:0'}, creative_brief: list{'nullable', 'string'}, targeting: list{'nullable', 'array'}, 'targeting.locations': list{'nullable', 'string', 'max:300'}, 'targeting.keywords': list{'nullable', 'string', 'max:300'}, 'targeting.seniority_levels': list{'nullable', 'string', 'max:200'}, 'targeting.notes': list{'nullable', 'string', 'max:1000'}, tracking_parameters: list{'nullable', 'array'}, 'tracking_parameters.utm_source': list{'nullable', 'string', 'max:120'}, 'tracking_parameters.utm_medium': list{'nullable', 'string', 'max:120'}, 'tracking_parameters.utm_campaign': list{'nullable', 'string', 'max:120'}, 'tracking_parameters.utm_term': list{'nullable', 'string', 'max:120'}, 'tracking_parameters.utm_content': list{'nullable', 'string', 'max:120'}, audience_segments: list{'nullable', 'array'}, 'audience_segments.*': list{'integer'}, status: list{'required', \Illuminate\Validation\Rules\In}}
	 */
	#[\Override]
	/**
	 * @return ((\Illuminate\Validation\Rules\In|string)[]|array)[]
	 *
	 * @psalm-return array{status: list{'required', \Illuminate\Validation\Rules\In},...}
	 */
	public function rules(): array
	{
		$rules = parent::rules();

		$rules['status'] = ['required', Rule::in(AdvertisingCampaign::STATUSES)];

		return $rules;
	}

	#[\Override]
	/**
	 * @return array
	 *
	 * @psalm-return array{status: mixed,...}
	 */
	public function campaignData(): array
	{
		$data = parent::campaignData();
		$data['status'] = $this->input('status');

		return $data;
	}
}

