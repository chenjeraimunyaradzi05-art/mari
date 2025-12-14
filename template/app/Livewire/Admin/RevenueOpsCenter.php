<?php

namespace App\Livewire\Admin;

use App\Models\CommerceChannel;
use App\Models\CommerceOrder;
use App\Models\CommerceOrderEvent;
use App\Models\CommercePayoutBatch;
use App\Models\SocialLiveStreamGift;
use App\Support\Livewire\FallbackComponent;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Symfony\Component\HttpFoundation\StreamedResponse;

trait RevenueOpsCenterBehavior
{
    use AuthorizesRequests;

    /** @var array<string, int|float> */
    public array $kpis = [];

    /** @var array<int, array<string, mixed>> */
    public array $payouts = [];

    /** @var array<int, array<string, mixed>> */
    public array $orderTimeline = [];

    /** @var array<int, array<string, string>> */
    public array $jobStatus = [];

    /** @var array<int, array<string, mixed>> */
    public array $topChannels = [];

    public ?string $flashMessage = null;

    public string $flashType = 'info';

    public function mount(): void
    {
        $this->authorize('operations.revenue-ops');
        $this->kpis = [
            'orders_24h' => 0,
            'gmv_24h' => 0.0,
            'tips_24h' => 0.0,
            'active_channels' => 0,
        ];
    }

    public function load(): void
    {
        $this->authorize('operations.revenue-ops');
        $now = CarbonImmutable::now();
        $dayAgo = $now->subDay();
        $weekAgo = $now->subDays(7);

        $orders24h = CommerceOrder::query()->where('created_at', '>=', $dayAgo)->count();
        $gmv24h = (float) CommerceOrder::query()->where('created_at', '>=', $dayAgo)->sum('total');
        $tips24h = (float) SocialLiveStreamGift::query()->where('recorded_at', '>=', $dayAgo)->sum('amount');
        $activeChannels = CommerceChannel::query()->whereHas('orders', function ($query) use ($weekAgo): void {
            $query->where('created_at', '>=', $weekAgo);
        })->count();

        $this->kpis = [
            'orders_24h' => $orders24h,
            'gmv_24h' => round($gmv24h, 2),
            'tips_24h' => round($tips24h, 2),
            'active_channels' => $activeChannels,
        ];

        $this->payouts = CommercePayoutBatch::query()
            ->with('channel')
            ->latest('updated_at')
            ->limit(5)
            ->get()
            ->map(function (CommercePayoutBatch $batch): array {
                return [
                    'id' => $batch->id,
                    'channel' => optional($batch->channel)->name ?? 'Channel #'.$batch->commerce_channel_id,
                    'status' => $batch->status,
                    'amount' => round((float) $batch->amount, 2).' '.$batch->currency,
                    'payout_date' => optional($batch->payout_date)?->toDateString() ?? 'scheduled',
                ];
            })
            ->all();

        $this->orderTimeline = CommerceOrder::query()
            ->selectRaw('DATE(created_at) as day')
            ->selectRaw('COUNT(*) as orders')
            ->selectRaw('SUM(total) as total')
            ->where('created_at', '>=', $weekAgo)
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->map(function ($row) {
                return [
                    'day' => $row->day,
                    'orders' => (int) $row->orders,
                    'total' => round((float) $row->total, 2),
                ];
            })
            ->all();

        $lastOrderExport = CommerceOrderEvent::query()->latest('recorded_at')->first();
        $lastPayoutBatch = CommercePayoutBatch::query()->latest('updated_at')->first();

        $this->jobStatus = [
            [
                'name' => 'WarehouseAnalyticsExportJob',
                'status' => $lastOrderExport ? 'ok' : 'pending',
                'details' => $lastOrderExport
                    ? 'Last event captured '.$lastOrderExport->recorded_at?->diffForHumans()
                    : 'No order events exported yet.',
            ],
            [
                'name' => 'DisburseCreatorPayoutsJob',
                'status' => $lastPayoutBatch ? $lastPayoutBatch->status : 'pending',
                'details' => $lastPayoutBatch
                    ? 'Batch '.$lastPayoutBatch->id.' touched '.$lastPayoutBatch->updated_at?->diffForHumans()
                    : 'Awaiting first payout batch.',
            ],
        ];

        $this->topChannels = CommerceChannel::query()
            ->with(['owner'])
            ->withSum([
                'orders as week_total' => function ($query) use ($weekAgo): void {
                    $query->where('created_at', '>=', $weekAgo);
                },
            ], 'total')
            ->orderByDesc('week_total')
            ->limit(5)
            ->get()
            ->map(function (CommerceChannel $channel): array {
                $owner = $channel->owner;

                return [
                    'channel_id' => $channel->id,
                    'channel' => $channel->name,
                    'owner' => $owner ? class_basename($owner).' #'.$owner->getKey() : 'Unassigned',
                    'week_total' => round((float) ($channel->week_total ?? 0), 2),
                ];
            })
            ->all();
    }

    public function markPayoutSent(int $batchId): void
    {
        $this->authorize('operations.revenue-ops');
        $batch = CommercePayoutBatch::findOrFail($batchId);

        $batch->forceFill([
            'status' => 'sent',
            'payout_date' => $batch->payout_date ?? CarbonImmutable::now(),
        ])->save();

        $this->flash('success', 'Payout batch #'.$batch->id.' marked sent.');
        $this->load();
    }

    public function retryPayout(int $batchId): void
    {
        $this->authorize('operations.revenue-ops');
        $batch = CommercePayoutBatch::findOrFail($batchId);

        $batch->forceFill(['status' => 'pending'])->save();

        $this->flash('info', 'Payout batch #'.$batch->id.' returned to pending.');
        $this->load();
    }

    public function openChannel(int $channelId): void
    {
        $this->authorize('operations.revenue-ops');
        $this->dispatch('open-commerce-channel', channelId: $channelId);
    }

    public function exportOrders(): StreamedResponse
    {
        $this->authorize('operations.revenue-ops');

        $rows = CommerceOrder::query()
            ->orderByDesc('created_at')
            ->limit(300)
            ->get(['id', 'commerce_channel_id', 'status', 'total', 'currency', 'created_at']);

        $filename = 'revenue-ops-orders-'.CarbonImmutable::now()->format('Ymd_His').'.csv';

        return response()->streamDownload(function () use ($rows): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Order ID', 'Channel', 'Status', 'Total', 'Currency', 'Created']);

            foreach ($rows as $row) {
                fputcsv($handle, [
                    $row->id,
                    $row->commerce_channel_id,
                    $row->status,
                    number_format((float) $row->total, 2, '.', ''),
                    $row->currency,
                    optional($row->created_at)?->toDateTimeString() ?? 'n/a',
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
        return view('livewire.admin.revenue-ops-center');
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

final class RevenueOpsCenter extends LivewireComponent
{
    use RevenueOpsCenterBehavior;
}

