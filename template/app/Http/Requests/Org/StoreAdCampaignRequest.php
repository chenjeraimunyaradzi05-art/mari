<?php

namespace App\Http\Requests\Org;

use App\Models\AdCampaign;
use App\Models\OrganizationPage;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property int|null $org_page_id
 * @property int|null $name
 * @property int|null $objective
 * @property int|null $billing_model
 * @property int|null $budget_cents
 * @property array<int, mixed>|null $start_on
 * @property array<int, mixed>|null $end_on
 * @property array<int, mixed>|null $targeting
 * @property array<int, mixed>|null $targeting.*
 * @property array<int, mixed>|null $status
 * @property array<int, mixed>|null $optimisation
 * @property string|null $optimisation.*
 */
final class StoreAdCampaignRequest extends FormRequest
{
    protected ?OrganizationPage $page = null;

    public function authorize(): bool
    {
        $user = $this->user();

        if (! $user) {
            return false;
        }

        $pageId = $this->input('org_page_id');

        if (! $pageId) {
            return false;
        }

        $page = OrganizationPage::query()->find($pageId);

        if (! $page) {
            return false;
        }

        // Only a company owner may create campaigns for a page in tests.
        return (bool) ($page->company && $page->company->user_id === $user->id);
    }

    #[\Override]
    /**
     * @return string[]
     *
     * @psalm-return array{'org_page_id.exists': 'The selected organization page could not be found.'}
     */
    public function messages(): array
    {
        return [
            'org_page_id.exists' => 'The selected organization page could not be found.',
        ];
    }

    public function campaignData(): array
    {
        $data = $this->validated();
        $data['status'] = $data['status'] ?? AdCampaign::STATUS_DRAFT;
        $data['spent_cents'] = 0;

        return $data;
    }

    public function rules(): array
    {
        return [
            'org_page_id' => ['required', 'integer', 'exists:organization_pages,id'],
            'name' => ['nullable', 'string', 'max:255'],
            'objective' => ['required', Rule::in(AdCampaign::OBJECTIVES)],
            'billing_model' => ['required', Rule::in(AdCampaign::BILLING_MODELS)],
            'budget_cents' => ['required', 'integer', 'min:1'],
            'spent_cents' => ['nullable', 'integer', 'min:0'],
            'start_on' => ['required', 'date'],
            'end_on' => ['nullable', 'date'],
            'targeting' => ['nullable', 'array'],
            'status' => ['nullable', Rule::in(AdCampaign::STATUSES)],
        ];
    }
}

