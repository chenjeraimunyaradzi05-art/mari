<?php

namespace App\Livewire\Admin;

use App\Models\CommerceCollection;
use App\Models\CommerceProduct;
use App\Models\SocialPost;
use App\Models\SocialThreadBinding;
use App\Support\Livewire\FallbackComponent;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Support\Arr;
use Symfony\Component\HttpFoundation\StreamedResponse;

trait AdReviewConsoleBehavior
{
    use AuthorizesRequests;

    /** @var array<string, int|float> */
    public array $metrics = [];

    /** @var array<int, array<string, mixed>> */
    public array $reviewQueue = [];

    /** @var array<int, array<string, mixed>> */
    public array $sponsoredInventory = [];

    /** @var array<string, int> */
    public array $riskBreakdown = [];

    /** @var array<int, array<string, string>> */
    public array $jobStatus = [];

    public ?string $flashMessage = null;

    public string $flashType = 'info';

    public function mount(): void
    {
        $this->authorize('operations.ad-review');
        $this->metrics = [
            'pending_creatives' => 0,
            'flagged_risk' => 0,
            'qa_hold_collections' => 0,
            'live_campaigns' => 0,
        ];

        $this->riskBreakdown = [
            'low' => 0,
            'medium' => 0,
            'high' => 0,
            'unknown' => 0,
        ];
    }

    public function load(): void
    {
        $this->authorize('operations.ad-review');
        $baseQuery = SocialPost::query()->where('is_sponsored', true);

        $pendingCreatives = (clone $baseQuery)->where('moderation_status', 'pending')->count();
        $flaggedRisk = (clone $baseQuery)->where('moderation_status', 'flagged')->count();
        $liveCampaigns = (clone $baseQuery)
            ->where('moderation_status', 'approved')
            ->where(function ($query): void {
                $query
                    ->whereNull('expires_at')
                    ->orWhere('expires_at', '>', CarbonImmutable::now());
            })
            ->count();

        $qaHoldCollections = CommerceCollection::query()
            ->whereNull('published_at')
            ->count();

        $this->metrics = [
            'pending_creatives' => $pendingCreatives,
            'flagged_risk' => $flaggedRisk,
            'qa_hold_collections' => $qaHoldCollections,
            'live_campaigns' => $liveCampaigns,
        ];

        $sponsoredInventoryQuery = clone $baseQuery;

        $this->sponsoredInventory = $sponsoredInventoryQuery
            ->latest('published_at')
            ->limit(6)
            ->get(['id', 'caption', 'moderation_status', 'post_type', 'published_at', 'ai_moderation_meta'])
            ->map(function (SocialPost $post): array {
                $aiTags = Arr::wrap(data_get($post->ai_moderation_meta, 'tags', []));

                return [
                    'post_id' => $post->id,
                    'post_type' => $post->post_type,
                    'status' => $post->moderation_status,
                    'published_at' => optional($post->published_at)?->diffForHumans() ?? 'draft',
                    'tags' => array_values($aiTags),
                    'risk' => data_get($post->ai_moderation_meta, 'risk', 'unknown'),
                ];
            })
            ->all();

        $productQueue = CommerceProduct::query()
            ->whereIn('status', ['draft', 'pending_review', 'hold'])
            ->latest('updated_at')
            ->limit(5)
            ->get(['id', 'name', 'status', 'updated_at'])
            ->map(function (CommerceProduct $product): array {
                $updatedAt = $product->updated_at;

                return [
                    'entity' => 'product',
                    'id' => $product->id,
                    'type' => 'Product',
                    'reference' => $product->name,
                    'status' => $product->status,
                    'submitted_at' => optional($updatedAt)?->diffForHumans() ?? 'n/a',
                    'submitted_order' => optional($updatedAt)?->timestamp ?? 0,
                ];
            });

        $postQueueQuery = clone $baseQuery;

        $postQueue = $postQueueQuery
            ->whereIn('moderation_status', ['pending', 'flagged'])
            ->latest('updated_at')
            ->limit(5)
            ->get(['id', 'caption', 'moderation_status', 'updated_at'])
            ->map(function (SocialPost $post): array {
                $updatedAt = $post->updated_at;

                return [
                    'entity' => 'post',
                    'id' => $post->id,
                    'type' => 'Post',
                    'reference' => 'Post #'.$post->id,
                    'status' => $post->moderation_status,
                    'submitted_at' => optional($updatedAt)?->diffForHumans() ?? 'n/a',
                    'submitted_order' => optional($updatedAt)?->timestamp ?? 0,
                ];
            });

        $this->reviewQueue = $postQueue
            ->merge($productQueue)
            ->sortByDesc('submitted_order')
            ->values()
            ->map(function (array $row): array {
                unset($row['submitted_order']);

                return $row;
            })
            ->all();

        $riskAggregation = $this->riskBreakdown;

        $riskAggregationQuery = clone $baseQuery;

        $riskAggregationQuery
            ->select(['id', 'ai_moderation_meta'])
            ->orderByDesc('id')
            ->lazy()
            ->each(function (SocialPost $post) use (&$riskAggregation): void {
                $risk = data_get($post->ai_moderation_meta, 'risk', 'unknown');
                $riskAggregation[$risk] = ($riskAggregation[$risk] ?? 0) + 1;
            });

        $this->riskBreakdown = $riskAggregation;

        $threadBindings = SocialThreadBinding::query()
            ->where('bindable_type', CommerceProduct::class)
            ->count();

        $this->jobStatus = [
            [
                'name' => 'AIContentService Observer',
                'status' => $flaggedRisk > 0 ? 'attention' : 'ok',
                'details' => 'Monitoring '.$flaggedRisk.' flagged creatives via observers.',
            ],
            [
                'name' => 'Commerce Thread Bindings',
                'status' => $threadBindings > 0 ? 'ok' : 'pending',
                'details' => $threadBindings.' sponsored conversations linked to commerce threads.',
            ],
        ];
    }

    public function approveCreative(int $postId): void
    {
        $this->authorize('operations.ad-review');
        $post = SocialPost::query()->where('is_sponsored', true)->findOrFail($postId);

        $meta = $post->ai_moderation_meta ?? [];
        $meta['last_action'] = 'approved';
        $meta['reviewed_by'] = auth('admin')->id();
        $meta['reviewed_at'] = CarbonImmutable::now()->toISOString();

        $post->forceFill([
            'moderation_status' => 'approved',
            'ai_moderation_meta' => $meta,
        ])->save();

        $this->flash('success', 'Creative #'.$post->id.' approved.');
        $this->load();
    }

    public function rejectCreative(int $postId): void
    {
        $this->authorize('operations.ad-review');
        $post = SocialPost::query()->where('is_sponsored', true)->findOrFail($postId);

        $meta = $post->ai_moderation_meta ?? [];
        $meta['last_action'] = 'rejected';
        $meta['reviewed_by'] = auth('admin')->id();
        $meta['reviewed_at'] = CarbonImmutable::now()->toISOString();

        $post->forceFill([
            'moderation_status' => 'rejected',
            'ai_moderation_meta' => $meta,
        ])->save();

        $this->flash('warning', 'Creative #'.$post->id.' rejected.');
        $this->load();
    }

    public function publishProduct(int $productId): void
    {
        $this->authorize('operations.ad-review');
        $product = CommerceProduct::findOrFail($productId);

        $product->forceFill(['status' => 'active'])->save();

        $this->flash('success', 'Product '.$product->name.' moved live.');
        $this->load();
    }

    public function holdProduct(int $productId): void
    {
        $this->authorize('operations.ad-review');
        $product = CommerceProduct::findOrFail($productId);

        $product->forceFill(['status' => 'hold'])->save();

        $this->flash('info', 'Product '.$product->name.' set to hold.');
        $this->load();
    }

    public function openPost(int $postId): void
    {
        $this->authorize('operations.ad-review');
        $this->dispatch('open-sponsored-post', postId: $postId);
    }

    public function openProduct(int $productId): void
    {
        $this->authorize('operations.ad-review');
        $this->dispatch('open-commerce-product', productId: $productId);
    }

    public function exportSponsored(): StreamedResponse
    {
        $this->authorize('operations.ad-review');

        $rows = SocialPost::query()
            ->where('is_sponsored', true)
            ->orderByDesc('updated_at')
            ->limit(200)
            ->get(['id', 'post_type', 'moderation_status', 'ai_moderation_meta', 'updated_at']);

        $filename = 'ad-review-sponsored-'.CarbonImmutable::now()->format('Ymd_His').'.csv';

        return response()->streamDownload(function () use ($rows): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Post ID', 'Type', 'Status', 'Risk', 'Tags', 'Updated']);

            foreach ($rows as $row) {
                $risk = data_get($row->ai_moderation_meta, 'risk', 'unknown');
                $tags = implode('|', Arr::wrap(data_get($row->ai_moderation_meta, 'tags', [])));

                fputcsv($handle, [
                    $row->id,
                    $row->post_type,
                    $row->moderation_status,
                    $risk,
                    $tags,
                    optional($row->updated_at)?->toDateTimeString() ?? 'n/a',
                ]);
            }

            fclose($handle);
        }, $filename);
    }

    protected function flash(string $type, string $message): void
    {
        $this->flashType = $type;
        $this->flashMessage = $message;
    }

    public function render()
    {
        return view('livewire.admin.ad-review-console');
    }
}

if (! class_exists(__NAMESPACE__.'\\LivewireComponent', false)) {
    if (class_exists('Livewire\\Component')) {
        class_alias('Livewire\\Component', __NAMESPACE__.'\\LivewireComponent');
    } else {
        class LivewireComponent extends FallbackComponent
        {
        }
    }
}

final class AdReviewConsole extends LivewireComponent
{
    use AdReviewConsoleBehavior;
}

