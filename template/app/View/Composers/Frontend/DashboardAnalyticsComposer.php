<?php

namespace App\View\Composers\Frontend;

use App\Models\CreatorPayout;
use App\Services\CareerIntelligencePulseService;
use App\Services\OpportunityStreamService;
use App\Services\PersonaNudgeService;
use App\Support\Analytics\Repositories\CareerIntelligenceRepository;
use App\Support\Analytics\Repositories\CreatorPayoutRepository;
use Illuminate\Contracts\Auth\Guard;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\View\View;
use Throwable;

class DashboardAnalyticsComposer
{

    public function __construct(
        private readonly \Illuminate\Contracts\Auth\Guard $guard,
        private readonly \App\Services\CareerIntelligencePulseService $pulseService,
        private readonly \App\Support\Analytics\Repositories\CareerIntelligenceRepository $careerRepository,
        private readonly \App\Support\Analytics\Repositories\CreatorPayoutRepository $payoutRepository,
        private readonly \App\Services\OpportunityStreamService $opportunityStreamService,
        private readonly \App\Services\PersonaNudgeService $personaNudgeService
    ) {
    }

    /**
     * Compose view data for the frontend dashboard.
     *
     * We intentionally keep this implementation lightweight for tests and
     * default to an empty payload when analytics features are disabled or
     * no authenticated user is present.
     */
    public function compose(View $view): void
    {
        // If we don't have any features enabled, do nothing and avoid hitting
        // the auth guard or binding to the view — tests expect no interaction
        // when features are disabled.
        if (! $this->shouldHydrate()) {
            return;
        }

        $user = $this->guard->user();

        if (! $user) {
            return;
        }

        try {
            $userId = $user->id;

            $payload = [
                'dashboardPulse' => $this->resolvePulse($userId),
                'dashboardOpportunityStreams' => $this->resolveOpportunityStreams($userId),
                'dashboardPersonaEchoes' => $this->resolvePersonaEchoes($userId),
                'dashboardPulseHistory' => $this->resolvePulseHistory($userId),
                'dashboardLatestPayout' => $this->resolveLatestPayout($userId),
            ];

            // Historically this composer attached an associative payload directly
            // to the view (single-argument `with()`), and unit tests mock that
            // behaviour — so pass the payload as the single argument.
            $view->with($payload);
        } catch (Throwable $e) {
            // don't let view composer failures bubble up during tests
            Log::warning('dashboard.composer.failed', ['exception' => $e->getMessage()]);
        }
    }


    private function shouldHydrate(): bool
    {
        return Config::get('features.candidate_dashboard.welcome_pulse')
            || Config::get('features.candidate_dashboard.opportunity_streams')
            || Config::get('features.candidate_dashboard.persona_echo');
    }

    private function resolvePulse(int $userId): array
    {
        return Cache::remember(
            \App\Support\Analytics\DashboardCache::key('pulse', $userId),
            $this->cacheTtl('pulse_ttl'),
            function () use ($userId) {
                try {
                    return $this->pulseService->getPulse($userId);
                } catch (Throwable $exception) {
                    Log::warning('Dashboard pulse fallback triggered', [
                        'user_id' => $userId,
                        'exception' => $exception->getMessage(),
                    ]);

                    return [
                        'user_id' => $userId,
                        'trajectory_score' => null,
                        'target_role' => null,
                        'summary' => null,
                        'metrics' => [
                            'learning_hours' => null,
                            'network_reach' => null,
                            'content_influence' => null,
                        ],
                        'forecast_updated_at' => null,
                    ];
                }
            }
        );
    }

    private function resolvePulseHistory(int $userId)
    {
        return Cache::remember(
            \App\Support\Analytics\DashboardCache::key('pulse_history', $userId),
            $this->cacheTtl('pulse_history_ttl'),
            fn () => $this->careerRepository->historyForUser($userId, 6)
        );
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private function resolveOpportunityStreams(int $userId): array
    {
        return Cache::remember(
            \App\Support\Analytics\DashboardCache::key('streams', $userId),
            $this->cacheTtl('streams_ttl'),
            function () use ($userId) {
                try {
                    return $this->opportunityStreamService->fetchStreams($userId);
                } catch (Throwable $exception) {
                    Log::warning('Dashboard opportunity streams fallback triggered', [
                        'user_id' => $userId,
                        'exception' => $exception->getMessage(),
                    ]);

                    return [];
                }
            }
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function resolvePersonaEchoes(int $userId): array
    {
        return Cache::remember(
            \App\Support\Analytics\DashboardCache::key('personas', $userId),
            $this->cacheTtl('persona_ttl'),
            function () use ($userId) {
                try {
                    $payload = $this->personaNudgeService->fetchNudges($userId);

                    return $payload['personas'] ?? [];
                } catch (Throwable $exception) {
                    Log::warning('Dashboard persona echo fallback triggered', [
                        'user_id' => $userId,
                        'exception' => $exception->getMessage(),
                    ]);

                    return [];
                }
            }
        );
    }

    private function resolveLatestPayout(int $userId): ?CreatorPayout
    {
        return Cache::remember(
            \App\Support\Analytics\DashboardCache::key('payout', $userId),
            $this->cacheTtl('payout_ttl'),
            function () use ($userId) {
                try {
                    return $this->payoutRepository->latestForUser($userId);
                } catch (Throwable $exception) {
                    Log::warning('Dashboard payout fallback triggered', [
                        'user_id' => $userId,
                        'exception' => $exception->getMessage(),
                    ]);

                    return null;
                }
            }
        );
    }

    /**
     * @psalm-return int<60, max>
     */
    private function cacheTtl(string $key): int
    {
        $seconds = (int) Config::get("analytics.dashboard_cache.{$key}", 600);

        return max($seconds, 60);
    }
}

