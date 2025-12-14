<?php

namespace App\Livewire\Admin;

use App\Models\AnalyticsEvent;
use App\Models\SocialBlockListEntry;
use App\Models\SocialLiveStream;
use App\Models\SocialPost;
use App\Models\SocialPostPoll;
use App\Models\SocialPostReport;
use App\Support\Livewire\FallbackComponent;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\StreamedResponse;

trait TrustSafetyDashboardBehavior
{
    use AuthorizesRequests;

    public int $liveFlags = 0;

    public int $openPolls = 0;

    public int $flaggedStreams = 0;

    public int $escalationsDue = 0;

    public int $reportsToday = 0;

    public int $blockEntries = 0;

    public int $expiredBlocks = 0;

    public int $jobsMissingLocationToday = 0;

    public int $jobsMissingLocationAllTime = 0;

    /** @var array<string, int> */
    public array $queues = [];

    /** @var array<int, array<string, mixed>> */
    public array $flaggedPosts = [];

    /** @var array<int, array<string, mixed>> */
    public array $blockActivity = [];

    public ?string $flashMessage = null;

    public string $flashType = 'info';

    public function mount(): void
    {
        $this->authorize('operations.trust-safety');
        $this->queues = [
            'social-feed' => 0,
            'analytics' => 0,
            'revenue' => 0,
        ];
    }

    public function load(): void
    {
        $this->authorize('operations.trust-safety');
        $this->openPolls = SocialPostPoll::query()->where('status', 'open')->count();

        $this->flaggedStreams = SocialLiveStream::query()
            ->where('status', '!=', 'ended')
            ->where(function (Builder $builder): void {
                $builder
                    ->where('ai_moderation_meta->status', 'flagged')
                    ->orWhere('ai_moderation_meta->risk', 'high');
            })
            ->count();

        $this->escalationsDue = SocialPostReport::query()
            ->whereNull('reviewed_at')
            ->where('created_at', '<', CarbonImmutable::now()->subHours(12))
            ->count();

        $this->reportsToday = SocialPostReport::query()
            ->whereDate('created_at', CarbonImmutable::now()->toDateString())
            ->count();

        $this->blockEntries = SocialBlockListEntry::query()->count();
        $this->expiredBlocks = SocialBlockListEntry::query()
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', CarbonImmutable::now())
            ->count();

        $this->jobsMissingLocationToday = AnalyticsEvent::query()
            ->where('event', 'jobs.location_missing')
            ->whereDate('created_at', CarbonImmutable::now()->toDateString())
            ->count();

        $this->jobsMissingLocationAllTime = AnalyticsEvent::query()
            ->where('event', 'jobs.location_missing')
            ->count();

        $this->flaggedPosts = SocialPost::query()
            ->whereIn('post_type', ['poll', 'live_stream', 'community_alert'])
            ->where('moderation_status', '!=', 'approved')
            ->latest('updated_at')
            ->limit(6)
            ->get(['id', 'post_type', 'moderation_status', 'ai_moderation_meta'])
            ->map(function (SocialPost $post): array {
                $flags = Collection::make($post->ai_moderation_meta)->get('flags', []);

                if (! is_array($flags)) {
                    $flags = array_filter([$flags]);
                }

                return [
                    'post_id' => $post->id,
                    'type' => $post->post_type,
                    'reason' => $post->moderation_status,
                    'flags' => array_values($flags),
                ];
            })
            ->all();

        $this->blockActivity = SocialBlockListEntry::query()
            ->with(['list.owner'])
            ->latest()
            ->limit(5)
            ->get()
            ->map(function (SocialBlockListEntry $entry): array {
                $owner = $entry->list?->owner;

                return [
                    'list' => $entry->list?->name ?? 'Block List #'.$entry->social_block_list_id,
                    'added_by' => optional($entry->addedByProfile)->display_name ?? 'System',
                    'reason' => $entry->reason ?? 'policy',
                    'timestamp' => optional($entry->created_at)?->diffForHumans(),
                    'owner' => $owner ? class_basename($owner) : null,
                ];
            })
            ->all();

        $this->queues = [
            'social-feed' => $this->queueSize('social-feed'),
            'analytics' => $this->queueSize('analytics'),
            'revenue' => $this->queueSize('revenue'),
        ];

        $this->liveFlags = $this->flaggedStreams + count($this->flaggedPosts);
    }

    public function review(int $postId): void
    {
        $this->authorize('operations.trust-safety');
        $this->dispatch('open-post-review', postId: $postId);
    }

    public function approvePost(int $postId): void
    {
        $this->authorize('operations.trust-safety');
        $post = SocialPost::findOrFail($postId);

        $meta = $post->ai_moderation_meta ?? [];
        $meta['last_action'] = 'approved';
        $meta['reviewed_by'] = auth('admin')->id();
        $meta['reviewed_at'] = CarbonImmutable::now()->toISOString();

        $post->forceFill([
            'moderation_status' => 'approved',
            'ai_moderation_meta' => $meta,
        ])->save();

        $this->flash('success', "Post {$post->id} approved.");
        $this->load();
    }

    public function rejectPost(int $postId): void
    {
        $this->authorize('operations.trust-safety');
        $post = SocialPost::findOrFail($postId);

        $meta = $post->ai_moderation_meta ?? [];
        $meta['last_action'] = 'rejected';
        $meta['reviewed_by'] = auth('admin')->id();
        $meta['reviewed_at'] = CarbonImmutable::now()->toISOString();

        $post->forceFill([
            'moderation_status' => 'rejected',
            'ai_moderation_meta' => $meta,
        ])->save();

        $this->flash('warning', "Post {$post->id} rejected and removed from feed.");
        $this->load();
    }

    public function exportFlagged(): StreamedResponse
    {
        $this->authorize('operations.trust-safety');

        $rows = SocialPost::query()
            ->where('moderation_status', '!=', 'approved')
            ->orderByDesc('updated_at')
            ->limit(200)
            ->get(['id', 'post_type', 'moderation_status', 'ai_moderation_meta']);

        $filename = 'trust-safety-flags-'.CarbonImmutable::now()->format('Ymd_His').'.csv';

        return response()->streamDownload(function () use ($rows): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Post ID', 'Type', 'Status', 'Flags']);

            foreach ($rows as $row) {
                $flags = collect($row->ai_moderation_meta)->get('flags', []);
                if (! is_array($flags)) {
                    $flags = array_filter([$flags]);
                }

                fputcsv($handle, [
                    $row->id,
                    $row->post_type,
                    $row->moderation_status,
                    implode('|', $flags),
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

    protected function queueSize(string $queue): int
    {
        if (! Schema::hasTable('jobs')) {
            return 0;
        }

        return (int) DB::table('jobs')->where('queue', $queue)->count();
    }

    public function render()
    {
        return view('livewire.admin.trust-safety-dashboard');
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

final class TrustSafetyDashboard extends LivewireComponent
{
    use TrustSafetyDashboardBehavior;
}

