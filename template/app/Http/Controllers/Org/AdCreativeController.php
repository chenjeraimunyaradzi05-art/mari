<?php

namespace App\Http\Controllers\Org;

use App\Http\Controllers\Controller;
use App\Http\Requests\Org\StoreAdCreativeRequest;
use App\Http\Requests\Org\UpdateAdCreativeRequest;
use App\Http\Resources\Org\AdCreativeResource;
use App\Models\AdCreative;
use App\Support\OrgPageAccess;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class AdCreativeController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        abort_unless($user, 401, 'Authentication required.');

        $validated = $request->validate([
            'org_page_id' => ['nullable', 'integer', 'exists:organization_pages,id'],
            'campaign_id' => ['nullable', 'integer', 'exists:ad_campaigns,id'],
            'status' => ['nullable', Rule::in(AdCreative::STATUSES)],
            'q' => ['nullable', 'string', 'max:120'],
            'order_by' => ['nullable', Rule::in(['created_at', 'updated_at'])],
            'order_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'between:5,100'],
        ]);

        $pageIds = OrgPageAccess::idsFor($user);
        abort_if($pageIds->isEmpty(), 403, 'You are not assigned to any organization pages.');

        if (! empty($validated['org_page_id']) && ! $pageIds->contains((int) $validated['org_page_id'])) {
            abort(403, 'You are not allowed to view this organization page.');
        }

        $query = AdCreative::query()
            ->with(['media', 'campaign:id,name,status,org_page_id'])
            ->whereHas('campaign', fn (Builder $builder) => $builder->whereIn('org_page_id', $pageIds));

        if (! empty($validated['org_page_id'])) {
            $query->whereHas('campaign', fn (Builder $builder) => $builder->where('org_page_id', $validated['org_page_id']));
        }

        if (! empty($validated['campaign_id'])) {
            $query->where('campaign_id', (int) $validated['campaign_id']);
        }

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (! empty($validated['q'])) {
            $search = Str::lower($validated['q']);
            $query->where(function (Builder $builder) use ($search) {
                $builder->whereRaw('LOWER(caption) like ?', ['%' . $search . '%']);
            });
        }

        $orderBy = $validated['order_by'] ?? 'created_at';
        $orderDir = $validated['order_dir'] ?? 'desc';

        $creatives = $query->orderBy($orderBy, $orderDir)
            ->paginate($validated['per_page'] ?? 15);

        return AdCreativeResource::collection($creatives);
    }

    public function store(StoreAdCreativeRequest $request): JsonResponse
    {
        $campaign = $request->campaign();
        $media = $request->media();

        $data = $request->creativeData();
        $data['format'] = $data['format'] ?? $media->type;

        abort_unless(
            $campaign->org_page_id === $media->org_page_id,
            422,
            'Media asset must belong to the same organization page as the campaign.'
        );

        $creative = AdCreative::create($data);
        $creative->load('media', 'campaign');

        return response()->json(
            (new AdCreativeResource($creative))->resolve($request),
            201
        );
    }

    public function update(UpdateAdCreativeRequest $request, AdCreative $creative): JsonResponse
    {
        $data = $request->creativeData();
        $newMedia = $request->newMedia();

        if ($newMedia) {
            $data['format'] = $data['format'] ?? $newMedia->type;
        }

        $creative->fill($data);
        $creative->save();
        $creative->load('media', 'campaign');

        return response()->json((new AdCreativeResource($creative))->resolve($request));
    }
}

