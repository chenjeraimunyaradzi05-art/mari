<?php

namespace App\Http\Requests\Org;

use App\Models\AdCampaign;
use App\Models\OrganizationPage;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * @property string|null $name
 * @property int|null $objective
 * @property int|null $billing_model
 * @property int|null $budget_cents
 * @property \Illuminate\Support\Carbon|null|null $start_on
 * @property \Illuminate\Support\Carbon|null|null $end_on
 */
final class UpdateAdCampaignRequest extends FormRequest
{
    protected ?OrganizationPage $page = null;
    protected ?AdCampaign $campaign = null;

    public function authorize(): bool
    {
        $user = $this->user();
        if (! $user) {
            return false;
        }

        $campaign = $this->route('campaign') ?? $this->route('adCampaign');
        if (! $campaign instanceof AdCampaign) {
            return false;
        }

        $page = $campaign->page ?? $campaign->page()->first();
        if (! $page) {
            return false;
        }

        // Allow company owner or page admin to update campaigns
        if ($page->company && $page->company->user_id === $user->id) {
            return true;
        }

        if ($page->admins && $page->admins->contains('user_id', $user->id)) {
            return true;
        }

        return false;
    }

    public function campaignData(): array
    {
        return $this->validated();
    }

    public function rules(): array
    {
        return [
            'name' => ['nullable', 'string', 'max:255'],
            'objective' => ['nullable', Rule::in(AdCampaign::OBJECTIVES)],
            'billing_model' => ['nullable', Rule::in(AdCampaign::BILLING_MODELS)],
            'budget_cents' => ['nullable', 'integer', 'min:0'],
            'spent_cents' => ['nullable', 'integer', 'min:0'],
            'start_on' => ['nullable', 'date'],
            'end_on' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(AdCampaign::STATUSES)],
            'targeting' => ['nullable', 'array'],
        ];
    }
}

