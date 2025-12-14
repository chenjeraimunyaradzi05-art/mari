<?php

namespace App\Http\Requests\Org;

use App\Models\AdCampaign;
use App\Models\AdCreative;
use App\Models\OrgMediaAsset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property int|null $media_id
 * @property string|null $format
 * @property array<int, mixed>|null $caption
 * @property array<int, mixed>|null $cta
 * @property array<int, mixed>|null $deeplink
 * @property array<int, mixed>|null $meta
 * @property string|null $meta.*
 * @property string|null $status
 */
final class UpdateAdCreativeRequest extends FormRequest
{
    protected ?AdCreative $creative = null;
    protected ?AdCampaign $campaign = null;

    public function authorize(): bool
    {
        $user = $this->user();
        if (! $user) {
            return false;
        }

        $creative = $this->route('creative') ?? $this->route('adCreative');
        if (! $creative instanceof AdCreative) {
            return false;
        }

        $campaign = $creative->campaign ?? $creative->campaign()->first();
        if (! $campaign) {
            return false;
        }

        $page = $campaign->page ?? $campaign->page()->first();
        if (! $page) {
            return false;
        }

        if ($page->company && $page->company->user_id === $user->id) {
            return true;
        }

        return $page->admins->contains('user_id', $user->id);
    }

    public function creativeData(): array
    {
        return $this->validated();
    }

    public function newMedia(): ?OrgMediaAsset
    {
        if (! $this->filled('media_id')) {
            return null;
        }

        return OrgMediaAsset::findOrFail($this->input('media_id'));
    }

    public function rules(): array
    {
        return [
            'media_id' => ['nullable', 'integer', 'exists:org_media_assets,id'],
            'format' => ['nullable', Rule::in(['image', 'video', 'embed'])],
            'caption' => ['nullable', 'string', 'max:1200'],
            'cta' => ['nullable', 'string', 'max:50'],
            'deeplink' => ['nullable', 'url'],
            'meta' => ['nullable', 'array'],
            'status' => ['nullable', Rule::in(AdCreative::STATUSES)],
        ];
    }
}

