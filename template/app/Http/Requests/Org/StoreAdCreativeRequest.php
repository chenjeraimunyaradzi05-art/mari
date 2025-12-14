<?php

namespace App\Http\Requests\Org;

use App\Models\AdCampaign;
use App\Models\AdCreative;
use App\Models\OrgMediaAsset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * @property int|null $campaign_id
 * @property int|null $media_id
 * @property array<int, mixed>|null $format
 * @property array<int, mixed>|null $caption
 * @property array<int, mixed>|null $cta
 * @property array<int, mixed>|null $deeplink
 * @property array<int, mixed>|null $meta
 * @property string|null $meta.*
 */
final class StoreAdCreativeRequest extends FormRequest
{
    protected ?AdCampaign $campaign = null;
    protected ?OrgMediaAsset $media = null;

    public function campaign(): AdCampaign
    {
        return $this->campaign ?? AdCampaign::findOrFail($this->input('campaign_id'));
    }

    public function creativeData(): array
    {
        $data = $this->validated();
        $data['status'] = AdCreative::STATUS_DRAFT;

        return $data;
    }

    public function media(): OrgMediaAsset
    {
        if (! $this->media) {
            $this->media = OrgMediaAsset::findOrFail($this->input('media_id'));
        }

        return $this->media;
    }

    public function authorize(): bool
    {
        $user = $this->user();
        if (! $user) {
            return false;
        }

        try {
            $campaign = $this->campaign();
        } catch (\Throwable $e) {
            return false;
        }

        $page = $campaign->page ?? $campaign->page()->first();
        if (! $page) {
            return false;
        }

        // allow company owner or page admins
        if ($page->company && $page->company->user_id === $user->id) {
            return true;
        }

        return $page->admins->contains('user_id', $user->id);
    }

    public function rules(): array
    {
        return [
            'campaign_id' => ['required', 'integer', 'exists:ad_campaigns,id'],
            'media_id' => ['required', 'integer', 'exists:org_media_assets,id'],
            'format' => ['nullable', Rule::in(['image', 'video', 'embed'])],
            'caption' => ['nullable', 'string', 'max:1200'],
            'cta' => ['nullable', 'string', 'max:50'],
            'deeplink' => ['nullable', 'url'],
            'meta' => ['nullable', 'array'],
        ];
    }
}

