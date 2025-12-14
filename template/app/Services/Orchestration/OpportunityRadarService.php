<?php

namespace App\Services\Orchestration;

use App\DataTransferObjects\OpportunityRadar\OpportunitySignal;
use App\Models\ApprenticeshipProgram;
use App\Models\CommunityEvent;
use App\Models\GrantProgram;
use App\Models\HousingListing;
use App\Models\Job;
use App\Models\OpportunityRadarEntry;
use App\Models\User;
use App\Notifications\OpportunityRadarDigestNotification;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Throwable;

final class OpportunityRadarService
{
    private const CACHE_TTL_SECONDS = 900;

    public function __construct(private readonly CacheRepository $cache)
    {
    }

    public function refresh(User $user, array $filters = []): Collection
    {
        $cacheKey = sprintf('opportunity-radar:%d', $user->id);
        if (($filters['force'] ?? false) !== true) {
            $cached = $this->cache->get($cacheKey);
            if ($cached instanceof Collection) {
                return $cached;
            }
        }

        $signals = $this->collectSignals($user, $filters)
            ->sortByDesc(fn (OpportunitySignal $signal) => $signal->score)
            ->values();

        $newEntryIds = $this->persistSignals($user, $signals);
        $this->maybeNotify($user, $signals, $newEntryIds);

        $this->cache->put($cacheKey, $signals, self::CACHE_TTL_SECONDS);

        return $signals;
    }

    /**
     * @psalm-return Collection<never, never>
     */
    private function collectSignals(User $user, array $filters): Collection
    {
        $keywords = $user->careerInterests
            ? $user->careerInterests->pluck('title')->filter()->map(fn ($title) => Str::lower($title))->values()->all()
            : [];

        return collect()
            ->merge($this->jobSignals($keywords))
            ->merge($this->grantSignals($keywords))
            ->merge($this->housingSignals($filters))
            ->merge($this->courseSignals())
            ->merge($this->eventSignals());
    }

    /**
     * @psalm-return Collection<int, OpportunitySignal>|EloquentCollection<int, OpportunitySignal>
     */
    private function jobSignals(array $keywords): Collection|EloquentCollection
    {
        return Job::query()
            ->where('status', 'active')
            ->latest('created_at')
            ->limit(10)
            ->get()
            ->map(function (Job $job) use ($keywords) {
                $score = $this->scoreMatch($job->title, $keywords, 60);
                $urgency = $job->deadline && now()->diffInDays($job->deadline, false) <= 7 ? 'urgent' : 'accelerate';

                return new OpportunitySignal(
                    type: 'job',
                    opportunityId: $job->id,
                    title: $job->title,
                    subtitle: optional($job->company)->company_name ?? $job->company_name,
                    summary: Str::limit(strip_tags($job->description), 140),
                    score: $score,
                    urgency: $urgency,
                    fitReasons: $this->fitReasons($job->title, $keywords),
                    actionUrl: $this->routeOrUrl('jobs.show', $job->slug ?? $job->id, '/jobs/'.$job->id),
                    expiresAt: optional($job->deadline)?->toDateString(),
                );
            });
    }

    /**
     * @psalm-return Collection<int, OpportunitySignal>|EloquentCollection<int, OpportunitySignal>
     */
    private function grantSignals(array $keywords): Collection|EloquentCollection
    {
        return GrantProgram::query()
            ->whereDate('closes_at', '>=', now())
            ->orderByDesc('match_score')
            ->limit(5)
            ->get()
            ->map(function (GrantProgram $grant) use ($keywords) {
                $score = $this->scoreMatch($grant->name, $keywords, (int) ($grant->match_score ?? 65));
                $urgency = optional($grant->closes_at)?->diffInDays(now(), false) === 0 ? 'urgent' : 'steady';

                return new OpportunitySignal(
                    type: 'grant',
                    opportunityId: $grant->id,
                    title: $grant->name,
                    subtitle: $grant->provider_name,
                    summary: Str::limit($grant->description ?? '', 160),
                    score: min(100, $score),
                    urgency: $urgency,
                    fitReasons: array_filter([
                        $grant->provider_type ? 'Provider: '.$grant->provider_type : null,
                        $grant->max_amount_cents ? 'Up to $'.number_format($grant->max_amount_cents / 100).' AUD' : null,
                    ]),
                    actionUrl: $grant->application_url,
                    expiresAt: optional($grant->closes_at)?->toDateString(),
                );
            });
    }

    /**
     * @psalm-return Collection<int, OpportunitySignal>|EloquentCollection<int, OpportunitySignal>
     */
    private function housingSignals(array $filters): Collection|EloquentCollection
    {
        return HousingListing::query()
            ->where('status', 'published')
            ->latest('created_at')
            ->limit(5)
            ->get()
            ->map(function (HousingListing $listing) use ($filters) {
                $targetRegion = Str::lower($filters['region'] ?? '');
                $regionMatch = $targetRegion && $listing->region ? Str::contains(Str::lower($listing->region), $targetRegion) : true;
                $baseScore = $regionMatch ? 75 : 60;
                $rent = $listing->rent_cents ? $listing->rent_cents / 100 : null;

                return new OpportunitySignal(
                    type: 'housing',
                    opportunityId: $listing->id,
                    title: $listing->title,
                    subtitle: sprintf('%s, %s', $listing->suburb, $listing->region),
                    summary: sprintf('%d bed · %s · %s', $listing->bedrooms, $listing->property_type, $listing->occupancy_preference),
                    score: (int) min(100, $baseScore + ($listing->safety_level === 'vetted' ? 10 : 0)),
                    urgency: 'steady',
                    fitReasons: array_filter([
                        $rent ? '$'.number_format($rent).' per month' : null,
                        $listing->furnished ? 'Furnished' : null,
                        $listing->safety_level ? Str::headline($listing->safety_level).' safety' : null,
                    ]),
                    actionUrl: $this->routeOrUrl('women.real-estate.listings.show', $listing->slug ?? $listing->id, '/women/real-estate/listings/'.$listing->id),
                    expiresAt: optional($listing->available_from)?->toDateString(),
                );
            });
    }

    /**
     * @psalm-return Collection<int, OpportunitySignal>|EloquentCollection<int, OpportunitySignal>
     */
    private function courseSignals(): Collection|EloquentCollection
    {
        return ApprenticeshipProgram::query()
            ->where('status', 'published')
            ->latest('created_at')
            ->limit(5)
            ->get()
            ->map(function (ApprenticeshipProgram $program) {
                $score = 65;
                if ($program->duration_weeks && $program->duration_weeks <= 26) {
                    $score += 10;
                }

                return new OpportunitySignal(
                    type: 'course',
                    opportunityId: $program->id,
                    title: $program->title,
                    subtitle: optional($program->page)->name,
                    summary: Str::limit($program->summary ?? '', 140),
                    score: min(100, $score),
                    urgency: 'accelerate',
                    fitReasons: array_filter([
                        $program->location,
                        $program->duration_weeks ? $program->duration_weeks.' weeks' : null,
                    ]),
                    actionUrl: $program->application_url,
                    expiresAt: null,
                );
            });
    }

    /**
     * @psalm-return Collection<int, OpportunitySignal>|EloquentCollection<int, OpportunitySignal>
     */
    private function eventSignals(): Collection|EloquentCollection
    {
        return CommunityEvent::query()
            ->where('status', 'published')
            ->where('starts_at', '>=', now())
            ->orderBy('starts_at')
            ->limit(4)
            ->get()
            ->map(function (CommunityEvent $event) {
                $urgency = $event->starts_at->diffInDays(now()) <= 3 ? 'urgent' : 'steady';

                return new OpportunitySignal(
                    type: 'event',
                    opportunityId: $event->id,
                    title: $event->title,
                    subtitle: $event->format === 'virtual' ? 'Virtual session' : $event->location,
                    summary: Str::limit(optional($event->group)->tagline ?? '', 120),
                    score: $urgency === 'urgent' ? 80 : 65,
                    urgency: $urgency,
                    fitReasons: array_filter([
                        $event->event_type ? Str::headline($event->event_type) : null,
                        $event->format === 'virtual' ? 'Join online' : 'On-site',
                    ]),
                    actionUrl: $this->routeOrUrl('community.groups.show', optional($event->group)->slug ?? $event->community_group_id, '/community/groups/'.$event->community_group_id),
                    expiresAt: $event->starts_at->toDateString(),
                );
            });
    }

    /**
     * @psalm-return Collection<never, never>
     */
    private function persistSignals(User $user, Collection $signals): Collection
    {
        $existing = OpportunityRadarEntry::query()
            ->where('user_id', $user->id)
            ->get()
            ->keyBy(fn (OpportunityRadarEntry $entry) => sprintf('%s:%s', $entry->opportunity_type, $entry->opportunity_id));

        $newEntries = collect();

        foreach ($signals as $signal) {
            $key = $signal->key();
            $payload = [
                'title' => $signal->title,
                'subtitle' => $signal->subtitle,
                'summary' => $signal->summary,
                'score' => $signal->score,
                'urgency_level' => $signal->urgency,
                'fit_reasons' => $signal->fitReasons,
                'action_url' => $signal->actionUrl,
                'expires_at' => $signal->expiresAt,
            ];

            if ($existing->has($key)) {
                $existing[$key]->fill($payload)->save();
            } else {
                $entry = OpportunityRadarEntry::create($payload + [
                    'user_id' => $user->id,
                    'opportunity_type' => $signal->type,
                    'opportunity_id' => $signal->opportunityId,
                ]);
                $newEntries->push($entry->id);
            }
        }

        return $newEntries;
    }

    private function maybeNotify(User $user, Collection $signals, Collection $newEntryIds): void
    {
        if ($signals->isEmpty() || $newEntryIds->isEmpty()) {
            return;
        }

        $notifiableSignals = $signals
            ->filter(fn (OpportunitySignal $signal) => $signal->score >= 80)
            ->take(3);

        if ($notifiableSignals->isEmpty()) {
            return;
        }

        try {
            $user->notify(new OpportunityRadarDigestNotification($notifiableSignals));
            OpportunityRadarEntry::whereIn('id', $newEntryIds)->update(['notified_at' => now()]);
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    private function scoreMatch(string $title, array $keywords, int $base): int
    {
        if (empty($keywords)) {
            return $base;
        }

        $title = Str::lower($title);
        $match = 0;

        foreach ($keywords as $keyword) {
            similar_text($title, Str::lower($keyword), $percent);
            $match = max($match, (int) round($percent));
        }

        return min(100, $base + (int) round($match / 3));
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function fitReasons(string $title, array $keywords): array
    {
        return collect($keywords)
            ->filter(fn ($keyword) => Str::contains(Str::lower($title), Str::lower($keyword)))
            ->map(fn ($keyword) => 'Matches “'.$keyword.'”')
            ->take(3)
            ->values()
            ->all();
    }

    /**
     * @param int|string $parameters
     */
    private function routeOrUrl(string $name, string|int $parameters, string $fallback): string
    {
        try {
            return route($name, $parameters);
        } catch (Throwable) {
            return url($fallback);
        }
    }
}

