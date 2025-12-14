<?php

namespace App\Services\Dashboards;

use App\DataTransferObjects\Dashboards\DashboardWidgetData;
use App\DataTransferObjects\Dashboards\KeyedDashboardWidgetData;
use App\DataTransferObjects\Dashboards\Widgets\CandidateCareerPulseData;
use App\DataTransferObjects\Dashboards\Widgets\CandidateOpportunityStreamData;
use App\DataTransferObjects\Dashboards\Widgets\CandidatePathwayProgressData;
use App\DataTransferObjects\Dashboards\Widgets\CandidatePersonaEchoData;
use App\DataTransferObjects\Dashboards\Widgets\CandidateWellbeingSnapshotData;
use App\DataTransferObjects\Dashboards\Widgets\CompanyEquityComplianceData;
use App\DataTransferObjects\Dashboards\Widgets\CompanyRequisitionHealthData;
use App\Models\AppliedJob;
use App\Models\ApprenticeshipProgram;
use App\Models\BankTransaction;
use App\Models\Budget;
use App\Models\Company;
use App\Models\Debt;
use App\Models\InterviewSession;
use App\Models\Job;
use App\Models\JobBookmark;
use App\Models\LearningPathEnrolment;
use App\Models\MentorshipProgram;
use App\Models\MentorshipSession;
use App\Models\PublicSectorAgency;
use App\Models\PublicSectorEngagement;
use App\Models\PublicSectorInsight;
use App\Models\PublicSectorOpportunity;
use App\Models\RealEstateLearningPath;
use App\Models\TafeCareerProfile;
use App\Models\TafeProgram;
use App\Models\User;
use App\Models\UserPrimaryPurpose;
use App\Models\WomenHousingListing;
use App\Services\Business\BusinessInsightsService;
use App\Services\CareerIntelligencePulseService;
use App\Services\Education\TafeUniversityInsightService;
use App\Services\PersonaNudgeService;
use App\Services\PublicSector\PublicSectorInsightService;
use App\Services\RealTimeAnalyticsEngine;
use App\Services\SecurityAuditService;
use App\ViewModels\Dashboards\RoleDashboardViewModel;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use InvalidArgumentException;

final class RoleDashboardService
{
    private array $businessSnapshotCache = [];

    public function __construct(
        private readonly CacheRepository $cache,
        private readonly CareerIntelligencePulseService $careerIntelligencePulseService,
        private readonly PersonaNudgeService $personaNudgeService,
        private readonly BusinessInsightsService $businessInsightsService,
        private readonly PublicSectorInsightService $publicSectorInsightService,
        private readonly TafeUniversityInsightService $tafeUniversityInsightService,
        private readonly RealTimeAnalyticsEngine $analytics,
        private readonly SecurityAuditService $securityAudit,
    ) {
    }

    public function build(User $user, string $role): RoleDashboardViewModel
    {
        $roleConfig = $this->roleConfig($role);

        $widgets = collect($roleConfig['widgets'] ?? [])
            ->map(fn (string $widgetKey) => $this->resolveWidget($widgetKey, $user, $role, $roleConfig))
            ->filter()
            ->values()
            ->all();

        $payload = new RoleDashboardViewModel(
            role: $role,
            title: $roleConfig['title'] ?? ucfirst(str_replace('_', ' ', $role)),
            description: $roleConfig['description'] ?? null,
            featureFlag: $roleConfig['feature_flag'] ?? null,
            cacheTtl: (int) ($roleConfig['cache_ttl'] ?? config('dashboard_roles.cache.default_ttl', 300)),
            widgets: $widgets,
            meta: [
                'design_reference' => $roleConfig['design_reference'] ?? null,
                'feature_flag_enabled' => $this->featureFlagEnabled($user, $roleConfig['feature_flag'] ?? null),
            ],
        );

        $this->recordDashboardViewTelemetry($user, $role, $roleConfig, $payload);

        return $payload;
    }

    private function roleConfig(string $role): array
    {
        $config = config("dashboard_roles.roles.{$role}");

        if (! $config) {
            throw new InvalidArgumentException("Unknown dashboard role [{$role}]");
        }

        return $config;
    }

    private function resolveWidget(string $widgetKey, User $user, string $role, array $roleConfig): ?DashboardWidgetData
    {
        $definition = config("dashboard_roles.widgets.{$widgetKey}");

        if (! $definition) {
            return null;
        }

        $resolver = $definition['resolver'] ?? null;

        if (! $resolver || ! method_exists($this, $resolver)) {
            return null;
        }

        $cacheDuration = (int) ($definition['cache_ttl']
            ?? $roleConfig['cache_ttl']
            ?? config('dashboard_roles.cache.default_ttl', 300));

        $cacheKey = $this->cacheKey($user->getKey(), $role, $widgetKey);
        $cacheHit = $this->cache->has($cacheKey);

        $widget = $this->cache->remember(
            $cacheKey,
            now()->addSeconds($cacheDuration),
            fn () => $this->renderWidgetWithTelemetry($user, $role, $widgetKey, $resolver, $definition)
        );

        if ($widget instanceof DashboardWidgetData) {
            $this->recordWidgetDeliveryTelemetry($user, $role, $widgetKey, $definition, $cacheHit);
        }

        return $widget;
    }

    private function renderWidgetWithTelemetry(User $user, string $role, string $widgetKey, string $resolver, array $definition): ?DashboardWidgetData
    {
        $startedAt = microtime(true);

        $widget = $this->{$resolver}($user, $definition);

        $this->recordWidgetRenderTelemetry(
            user: $user,
            role: $role,
            widgetKey: $widgetKey,
            definition: $definition,
            durationMs: (microtime(true) - $startedAt) * 1000,
        );

        return $widget;
    }

    private function cacheKey(int|string $userId, string $role, string $widgetKey): string
    {
        $prefix = config('dashboard_roles.cache.key_prefix', 'role-dashboard');

        return sprintf('%s:%s:%s:%s', $prefix, $userId, $role, $widgetKey);
    }

    private function featureFlagEnabled(User $user, ?string $flag): bool
    {
        if (! $flag) {
            return true;
        }

        $profile = $this->primaryPurpose($user);

        return in_array($flag, $profile?->feature_flags ?? [], true);
    }

    private function primaryPurpose(User $user): ?UserPrimaryPurpose
    {
        return $user->primaryPurposeProfile;
    }

    private function recordDashboardViewTelemetry(User $user, string $role, array $roleConfig, RoleDashboardViewModel $payload): void
    {
        try {
            $this->analytics->record('role_dashboard.viewed', [
                'properties' => [
                    'user_id' => $user->getKey(),
                    'role' => $role,
                    'widget_count' => count($payload->widgets),
                    'feature_flag' => $roleConfig['feature_flag'] ?? null,
                    'cache_ttl' => $payload->cacheTtl,
                ],
                'metadata' => [
                    'account_classification' => $user->account_classification,
                    'source' => 'role_dashboard',
                ],
                'source' => 'role_dashboard',
            ]);
        } catch (\Throwable $exception) {
            report($exception);
        }

        try {
            $this->securityAudit->log('dashboard.viewed', [
                'user' => $user,
                'resource_type' => 'role_dashboard',
                'metadata' => [
                    'role' => $role,
                    'widget_count' => count($payload->widgets),
                    'feature_flag' => $roleConfig['feature_flag'] ?? null,
                ],
            ]);
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    private function recordWidgetDeliveryTelemetry(
        User $user,
        string $role,
        string $widgetKey,
        array $definition,
        bool $cacheHit
    ): void {
        $payload = [
            'properties' => [
                'user_id' => $user->getKey(),
                'role' => $role,
                'widget_key' => $widgetKey,
                'cache_hit' => $cacheHit,
            ],
            'metadata' => [
                'dto' => $definition['dto'] ?? null,
                'resolver' => $definition['resolver'] ?? null,
                'source' => 'role_dashboard',
            ],
            'source' => 'role_dashboard',
        ];

        $this->emitTelemetryEvents(['role_dashboard.widget.requested'], $payload);
    }

    private function recordWidgetRenderTelemetry(
        User $user,
        string $role,
        string $widgetKey,
        array $definition,
        float $durationMs
    ): void {
        $payload = [
            'properties' => [
                'user_id' => $user->getKey(),
                'role' => $role,
                'widget_key' => $widgetKey,
                'duration_ms' => round($durationMs, 3),
            ],
            'metadata' => [
                'dto' => $definition['dto'] ?? null,
                'resolver' => $definition['resolver'] ?? null,
                'source' => 'role_dashboard',
            ],
            'source' => 'role_dashboard',
        ];

        $events = array_filter([
            'role_dashboard.widget.rendered',
            $definition['telemetry_event'] ?? null,
        ]);

        $this->emitTelemetryEvents($events, $payload);
    }

    private function emitTelemetryEvents(array $events, array $payload): void
    {
        foreach ($events as $event) {
            try {
                $this->analytics->record($event, $payload);
            } catch (\Throwable $exception) {
                report($exception);
            }
        }
    }

    private function buildCandidateCareerPulse(User $user, array $definition): CandidateCareerPulseData
    {
        $pulse = $this->careerIntelligencePulseService->getPulse($user->getKey());

        $metrics = collect($pulse['metrics'] ?? [])
            ->map(function ($value, $key) {
                if ($value === null) {
                    return null;
                }

                return [
                    'label' => Str::headline(str_replace('_', ' ', (string) $key)),
                    'value' => $value,
                    'trend' => $this->describePulseMetric((string) $key, $value),
                ];
            })
            ->filter()
            ->values()
            ->all();

        if (empty($metrics)) {
            $metrics[] = [
                'label' => 'Momentum',
                'value' => 0,
                'trend' => 'Connect your resume and recent wins to unlock AI projections.',
            ];
        }

        return new CandidateCareerPulseData(
            trajectoryScore: isset($pulse['trajectory_score']) ? (int) round($pulse['trajectory_score']) : null,
            targetRole: $pulse['target_role'] ?? null,
            summary: $pulse['summary'] ?? 'Bring in your past roles so the pulse can personalise recommendations.',
            metrics: $metrics,
            updatedAt: $pulse['forecast_updated_at'] ?? null,
        );
    }

    private function buildCandidatePersonaEcho(User $user, array $definition): CandidatePersonaEchoData
    {
        $nudges = $this->personaNudgeService->fetchNudges($user->getKey());

        $personas = collect($nudges['personas'] ?? [])
            ->map(function ($persona) {
                $nudges = array_values(array_filter(Arr::get($persona, 'nudges', [])));

                return [
                    'id' => Arr::get($persona, 'id'),
                    'label' => Arr::get($persona, 'label'),
                    'icon' => Arr::get($persona, 'icon', 'heroicons.sparkles'),
                    'nudges' => array_slice($nudges, 0, 2),
                    'cta' => [
                        'label' => Arr::get($persona, 'cta.label', 'Take next step'),
                        'url' => Arr::get(
                            $persona,
                            'cta.url',
                            url('/personas/'.$this->normaliseSlug((string) Arr::get($persona, 'id')))
                        ),
                    ],
                ];
            })
            ->filter(fn ($persona) => ! empty($persona['id']))
            ->values();

        if ($personas->isEmpty()) {
            $personas = collect($user->persona_flags ?? [])
                ->take(3)
                ->map(fn (string $flag) => [
                    'id' => $flag,
                    'label' => Str::headline(str_replace('-', ' ', $flag)),
                    'icon' => 'heroicons.sparkles',
                    'nudges' => ['Add a short note so mentors understand what support unlocks momentum.'],
                    'cta' => [
                        'label' => 'Update persona',
                        'url' => url('/profile/personas'),
                    ],
                ]);
        }

        return new CandidatePersonaEchoData(
            personas: $personas->values()->all(),
            primaryCtaLabel: 'Manage personas',
            primaryCtaUrl: url('/profile/personas'),
        );
    }

    private function buildCandidatePathwayProgress(User $user, array $definition): CandidatePathwayProgressData
    {
        $record = $this->primaryPurpose($user);

        $milestones = collect([
            [
                'label' => 'Purpose confirmed',
                'complete' => (bool) $record,
            ],
            [
                'label' => 'Identity alignment set',
                'complete' => (bool) ($record && $record->identity_alignment),
            ],
            [
                'label' => 'Purpose story shared',
                'complete' => (bool) ($record && $record->purpose_story),
            ],
        ])->map(function (array $milestone) {
            $milestone['complete'] = (bool) $milestone['complete'];

            return $milestone + [
                'status' => $milestone['complete'] ? 'done' : 'pending',
            ];
        })->values();

        $completionPercent = (int) round(
            ($milestones->where('complete', true)->count() / max($milestones->count(), 1)) * 100
        );

        $nextAction = optional($milestones->firstWhere('complete', false))['label']
            ?? 'Share a weekly win so mentors can amplify you.';

        return new CandidatePathwayProgressData(
            completionPercent: $completionPercent,
            milestones: $milestones->all(),
            nextAction: $nextAction,
            pathwayName: Str::headline($record?->primary_purpose ?? 'Momentum Pathway'),
        );
    }

    private function buildCandidateOpportunityStream(User $user, array $definition): CandidateOpportunityStreamData
    {
        $bookmarkedJobs = JobBookmark::query()
            ->where('candidate_id', $user->getKey())
            ->latest('created_at')
            ->limit(4)
            ->with('job')
            ->get()
            ->map(fn (JobBookmark $bookmark) => $bookmark->job)
            ->filter()
            ->values();

        if ($bookmarkedJobs->isEmpty()) {
            $bookmarkedJobs = Job::query()
                ->where('status', 'open')
                ->orderByDesc('created_at')
                ->limit(4)
                ->get();
        }

        $jobStreams = $bookmarkedJobs->map(fn (Job $job) => [
            'type' => 'job',
            'title' => $job->title,
            'subtitle' => $job->organisation ?? $job->company_name,
            'meta' => array_filter([
                'location' => $job->location,
                'salary' => $job->salary_band,
                'posted_at' => optional($job->published_at)->diffForHumans(),
            ]),
            'url' => url('/jobs/'.$job->getKey()),
        ]);

        $mentorships = MentorshipSession::query()
            ->where('mentee_user_id', $user->getKey())
            ->whereIn('status', ['pending', 'scheduled', 'confirmed'])
            ->orderBy('scheduled_for')
            ->limit(2)
            ->with('mentor')
            ->get()
            ->map(fn (MentorshipSession $session) => [
                'type' => 'mentorship',
                'title' => optional($session->mentor)->name ?? 'Mentor session',
                'subtitle' => Arr::get($session->notes, 'focus', 'Momentum check-in'),
                'meta' => array_filter([
                    'scheduled_at' => optional($session->scheduled_for)->toDateTimeString(),
                    'status' => $session->status,
                    'duration' => $session->duration_minutes ? $session->duration_minutes.' mins' : null,
                ]),
                'url' => url('/mentorship/sessions/'.$session->getKey()),
            ]);

        $interviews = InterviewSession::query()
            ->where('candidate_id', $user->getKey())
            ->orderByDesc('created_at')
            ->limit(2)
            ->get()
            ->map(fn (InterviewSession $interview) => [
                'type' => 'interview',
                'title' => $interview->title,
                'subtitle' => Str::headline($interview->session_type ?? 'interview session'),
                'meta' => array_filter([
                    'scheduled_at' => optional($interview->started_at)->toDateTimeString(),
                    'status' => $interview->status,
                    'score' => $interview->overall_score,
                ]),
                'url' => url('/interviews/'.$interview->getKey()),
            ]);

        $streams = $jobStreams
            ->merge($mentorships)
            ->merge($interviews)
            ->values();

        return new CandidateOpportunityStreamData(
            streams: $streams->all(),
            spotlight: array_filter([
                'mentorship' => $mentorships->first(),
                'interview' => $interviews->first(),
            ]),
            pendingApplications: AppliedJob::query()->where('candidate_id', $user->getKey())->count(),
            interviewsScheduled: $interviews->count(),
            savedOpportunities: JobBookmark::query()->where('candidate_id', $user->getKey())->count(),
            mentorshipPrompts: $mentorships->count(),
        );
    }

    private function buildCandidateWellbeingSnapshot(User $user, array $definition): CandidateWellbeingSnapshotData
    {
        $transactions = BankTransaction::query()
            ->where('user_id', $user->getKey())
            ->orderByDesc('posted_at')
            ->limit(12)
            ->get();

        $budgets = Budget::query()
            ->where('user_id', $user->getKey())
            ->with('items')
            ->latest('updated_at')
            ->limit(6)
            ->get();

        $debts = Debt::query()
            ->where('user_id', $user->getKey())
            ->limit(5)
            ->get();

        $housing = WomenHousingListing::query()
            ->where('moderation_status', 'approved')
            ->where('visibility', 'public')
            ->orderByDesc('ai_recommendation_score')
            ->limit(3)
            ->get();

        $incomePulse = round((float) $transactions->sum('amount'), 2);

        $averageSavingsGoal = (float) ($budgets->avg('savings_goal_monthly') ?? 0);
        $budgetHealthScore = $budgets->isNotEmpty()
            ? min(100, max(45, 60 + ($averageSavingsGoal / 1000)))
            : 62.5;

        $averageDebtBalance = (float) ($debts->avg('balance') ?? 0);
        $debtCoverageScore = $averageDebtBalance > 0
            ? min(95, max(40, 88 - ($averageDebtBalance / 1500)))
            : 78.0;

        $alerts = [];
        if ($incomePulse < 0) {
            $alerts[] = 'Spending outpaced income this month—tag expenses for clarity.';
        }

        if ($budgetHealthScore < 65) {
            $alerts[] = 'Budget health fell under 65—review envelopes with your navigator.';
        }

        if ($debtCoverageScore < 55) {
            $alerts[] = 'Debt coverage is tight. Schedule a repayment plan tune-up.';
        }

        $financialSnapshot = [
            'income_pulse' => round((float) $incomePulse, 2),
            'budget_health_score' => round((float) $budgetHealthScore, 1),
            'debt_coverage_score' => round((float) $debtCoverageScore, 1),
            'housing_options' => $housing->map(fn (WomenHousingListing $listing) => [
                'title' => $listing->title,
                'rent' => $listing->price_cents ? round($listing->price_cents / 100, 2).' '.$listing->currency : null,
                'suburb' => Arr::get($listing->location, 'suburb') ?? Arr::get($listing->location, 'locality'),
                'availability' => optional($listing->availability_date)->toDateString(),
                'url' => url('/housing/'.$listing->slug),
            ])->values()->all(),
        ];

        return new CandidateWellbeingSnapshotData(
            stressLevel: $incomePulse >= 0 ? 'Steady' : 'Stretched',
            budgetHealth: $budgetHealthScore >= 70 ? 'On Track' : 'Needs Support',
            housingStatus: optional($housing->first())->title,
            alerts: $alerts,
            financialSnapshot: $financialSnapshot,
        );
    }

    private function buildCompanyRequisitionHealth(User $user, array $definition): CompanyRequisitionHealthData
    {
        $company = $this->resolveCompany($user);

        $jobs = Job::query()
            ->where('company_id', $company?->getKey())
            ->withCount('applications')
            ->latest('created_at')
            ->limit(25)
            ->get(['id', 'title', 'status', 'workflow_status', 'workflow_priority', 'created_at']);

        $health = $this->businessInsightsService->requisitionHealth($company?->getKey());

        $agingSummary = [
            ['label' => '0-14 days', 'value' => $jobs->filter(fn (Job $job) => optional($job->created_at)->diffInDays(now()) <= 14)->count()],
            ['label' => '15-30 days', 'value' => $jobs->filter(fn (Job $job) => ($days = optional($job->created_at)->diffInDays(now())) > 14 && $days <= 30)->count()],
            ['label' => '31+ days', 'value' => $jobs->filter(fn (Job $job) => optional($job->created_at)->diffInDays(now()) > 30)->count()],
        ];

        $spotlightJob = $jobs->sortByDesc('applications_count')->first();
        $spotlight = $spotlightJob ? [
            'title' => $spotlightJob->title,
            'status' => $spotlightJob->status,
            'applications' => $spotlightJob->applications_count,
            'aging_days' => optional($spotlightJob->created_at)->diffInDays(now()),
        ] : [];

        return new CompanyRequisitionHealthData(
            openRequisitions: $health['open_roles'] ?? $jobs->where('status', 'open')->count(),
            rolesAtRisk: $jobs->whereIn('workflow_status', ['stalled', 'on_hold'])->count(),
            avgPipelineVelocity: (float) ($health['avg_time_to_fill'] ?? 0),
            agingSummary: $agingSummary,
            spotlight: $spotlight,
        );
    }

    private function buildCompanyEquitySnapshot(User $user, array $definition): CompanyEquityComplianceData
    {
        $company = $this->resolveCompany($user);

        $insights = $this->businessInsightsService->equityCompliance($company?->getKey());

        $policyAcknowledged = (bool) ($company?->verified_at || ($company?->is_profile_verified ?? false));
        $lastAuditAt = $insights['last_audit_at'] ?? optional($company?->updated_at)->toDateString();

        $alerts = array_values(array_filter(array_merge(
            $policyAcknowledged
                ? []
                : ['Employer profile is awaiting policy acknowledgement.'],
            $insights['recommended_actions'] ?? []
        )));

        $nextActions = array_slice($insights['recommended_actions'] ?? [
            'Upload the latest DEI policy summary to your employer profile.',
            'Confirm pay transparency ranges across active requisitions.',
        ], 0, 3);

        $badges = array_values(array_filter([
            $policyAcknowledged ? 'Policy acknowledged' : null,
            ($company?->foundation_status === 'active') ? 'Foundation partner' : null,
            ($company?->is_profile_verified ?? false) ? 'Trusted employer' : null,
        ]));

        return new CompanyEquityComplianceData(
            policyAcknowledged: $policyAcknowledged,
            lastAuditAt: $lastAuditAt,
            alerts: $alerts,
            nextActions: $nextActions,
            badges: $badges,
        );
    }

    private function buildCompanyEquityCompliance(User $user, array $definition): CompanyEquityComplianceData
    {
        return $this->buildCompanyEquitySnapshot($user, $definition);
    }

    private function buildPublicSectorOpportunityRadar(User $user, array $definition): KeyedDashboardWidgetData
    {
        $opportunities = PublicSectorOpportunity::query()
            ->open()
            ->with('agency')
            ->orderByDesc('priority_score')
            ->limit(6)
            ->get();

        $signals = $this->publicSectorInsightService->opportunitySignals($opportunities);

        return new KeyedDashboardWidgetData(
            key: 'public-sector-opportunity-radar',
            data: [
                'opportunities' => $opportunities->map(fn (PublicSectorOpportunity $opportunity) => [
                    'id' => $opportunity->getKey(),
                    'title' => $opportunity->title,
                    'agency' => optional($opportunity->agency)->name,
                    'location' => $opportunity->location,
                    'work_arrangement' => $opportunity->work_arrangement,
                    'closing_window' => $opportunity->closing_window,
                    'link' => url('/public-sector/opportunities/'.$opportunity->slug),
                ])->values()->all(),
                'signals' => $signals,
                'cta' => [
                    'label' => 'Browse all tenders',
                    'url' => url('/public-sector/opportunities'),
                ],
            ],
        );
    }

    private function buildPublicSectorPlaybook(User $user, array $definition): KeyedDashboardWidgetData
    {
        $agencies = PublicSectorAgency::query()
            ->active()
            ->orderByDesc('impact_score')
            ->limit(3)
            ->get();

        $opportunities = PublicSectorOpportunity::query()
            ->open()
            ->orderByDesc('priority_score')
            ->limit(5)
            ->get();

        $insights = PublicSectorInsight::query()
            ->latest('published_at')
            ->limit(4)
            ->get();

        $playbook = $this->publicSectorInsightService->buildPlaybook($user, $agencies, $opportunities, $insights);
        $signals = $this->publicSectorInsightService->opportunitySignals($opportunities);

        return new KeyedDashboardWidgetData(
            key: 'public-sector-playbook',
            data: [
                'themes' => $playbook['themes'] ?? [],
                'actions' => $playbook['actions'] ?? [],
                'tone' => $playbook['tone'] ?? 'confident',
                'agencies' => $agencies->map(fn (PublicSectorAgency $agency) => [
                    'name' => $agency->name,
                    'category' => $agency->category,
                    'impact_score' => $agency->impact_score,
                    'tagline' => $agency->tagline,
                ])->values()->all(),
                'signals' => [
                    'closing_soon' => $signals['closing_soon'] ?? 0,
                    'hybrid_friendly' => $signals['hybrid_friendly'] ?? 0,
                    'executive_paths' => $signals['executive_paths'] ?? 0,
                    'insights_tracked' => $insights->count(),
                ],
                'cta' => [
                    'label' => 'Open public sector lab',
                    'url' => url('/public-sector'),
                ],
            ],
        );
    }

    private function buildPublicSectorEngagements(User $user, array $definition): KeyedDashboardWidgetData
    {
        $agency = PublicSectorAgency::query()
            ->where('owner_id', $user->getKey())
            ->first();

        $engagements = PublicSectorEngagement::query()
            ->whereHas('opportunity', fn ($query) => $query->where('public_sector_agency_id', $agency?->getKey()))
            ->with(['opportunity', 'user'])
            ->latest('created_at')
            ->limit(4)
            ->get()
            ->map(fn (PublicSectorEngagement $engagement) => [
                'id' => $engagement->getKey(),
                'title' => $engagement->opportunity->title,
                'stage' => Str::headline($engagement->engagement_type),
                'value' => $engagement->user->name,
                'updated_at' => optional($engagement->updated_at)->diffForHumans(),
            ])
            ->values()
            ->all();

        return new KeyedDashboardWidgetData(
            key: 'public-sector-engagements',
            data: [
                'engagements' => $engagements,
                'cta' => [
                    'label' => 'Manage engagements',
                    'url' => url('/public-sector/engagements'),
                ],
            ],
        );
    }

    private function buildEducationProgramHealth(User $user, array $definition): KeyedDashboardWidgetData
    {
        $programs = TafeProgram::query()
            ->published()
            ->with('institution')
            ->orderByDesc('ai_match_score')
            ->limit(5)
            ->get();

        $insights = $this->tafeUniversityInsightService->generateInsights($user, $programs);

        return new KeyedDashboardWidgetData(
            key: 'education-program-health',
            data: [
                'programs' => $programs->map(fn (TafeProgram $program) => [
                    'id' => $program->getKey(),
                    'title' => $program->title,
                    'provider' => optional($program->institution)->name,
                    'credential' => $program->credential_level,
                    'delivery_mode' => $program->delivery_mode,
                    'duration_weeks' => $program->duration_weeks,
                    'match_score' => $program->ai_match_score,
                    'link' => url('/education/pathways/'.$program->slug),
                ])->values()->all(),
                'focus' => $insights['focus'] ?? [],
                'actions' => $insights['actions'] ?? [],
                'tone' => $insights['tone'] ?? 'uplifting',
                'cta' => [
                    'label' => 'Explore learning',
                    'url' => url('/education'),
                ],
            ],
        );
    }

    private function buildEducationAiRecommendations(User $user, array $definition): KeyedDashboardWidgetData
    {
        $profile = TafeCareerProfile::query()
            ->where('user_id', $user->getKey())
            ->latest('updated_at')
            ->first();

        $recommendations = $this->tafeUniversityInsightService->suggestCareers($user, $profile);

        return new KeyedDashboardWidgetData(
            key: 'education-ai-recommendations',
            data: [
                'summary' => $recommendations['summary'] ?? null,
                'careers' => collect($recommendations['careers'] ?? [])->map(function ($career) {
                    return [
                        'title' => Arr::get($career, 'title'),
                        'growth_outlook' => Arr::get($career, 'growth_outlook'),
                        'median_salary' => Arr::get($career, 'median_salary'),
                        'next_step' => Arr::get($career, 'next_step'),
                        'tags' => Arr::wrap(Arr::get($career, 'tags', [])),
                    ];
                })->values()->all(),
                'cta' => [
                    'label' => 'Book pathway consult',
                    'url' => url('/education/consult'),
                ],
            ],
        );
    }

    private function buildMentorSessionPipeline(User $user, array $definition): KeyedDashboardWidgetData
    {
        $upcomingSessions = MentorshipSession::query()
            ->where('mentor_user_id', $user->getKey())
            ->whereIn('status', ['scheduled', 'pending', 'confirmed'])
            ->orderBy('scheduled_for')
            ->limit(5)
            ->with(['mentee'])
            ->get();

        $activeMentees = MentorshipSession::query()
            ->where('mentor_user_id', $user->getKey())
            ->whereNotNull('mentee_user_id')
            ->distinct('mentee_user_id')
            ->count('mentee_user_id');

        $pendingSessions = MentorshipSession::query()
            ->where('mentor_user_id', $user->getKey())
            ->where('status', 'pending')
            ->count();

        $sessionsThisWeek = MentorshipSession::query()
            ->where('mentor_user_id', $user->getKey())
            ->whereBetween('scheduled_for', [now()->startOfWeek(), now()->endOfWeek()])
            ->count();

        $completedThisMonth = MentorshipSession::query()
            ->where('mentor_user_id', $user->getKey())
            ->where('status', 'completed')
            ->whereBetween('scheduled_for', [now()->startOfMonth(), now()->endOfMonth()])
            ->count();

        return new KeyedDashboardWidgetData(
            key: 'mentor-session-pipeline',
            data: [
                'metrics' => [
                    'active_mentees' => $activeMentees,
                    'sessions_this_week' => $sessionsThisWeek,
                    'pending_requests' => $pendingSessions,
                    'completed_this_month' => $completedThisMonth,
                ],
                'upcoming' => $upcomingSessions->map(fn (MentorshipSession $session) => [
                    'id' => $session->getKey(),
                    'mentee' => optional($session->mentee)->name,
                    'scheduled_at' => optional($session->scheduled_for)->toDateTimeString(),
                    'status' => $session->status,
                    'duration' => $session->duration_minutes,
                ])->values()->all(),
                'cta' => [
                    'label' => 'Manage mentor sessions',
                    'url' => url('/mentorship/sessions'),
                ],
            ],
        );
    }

    private function buildMentorRelationshipHealth(User $user, array $definition): KeyedDashboardWidgetData
    {
        $programs = MentorshipProgram::query()
            ->where('mentor_user_id', $user->getKey())
            ->orderByDesc('created_at')
            ->limit(3)
            ->get();

        $totalSessions = MentorshipSession::query()
            ->where('mentor_user_id', $user->getKey())
            ->count();

        $completedSessions = MentorshipSession::query()
            ->where('mentor_user_id', $user->getKey())
            ->where('status', 'completed')
            ->count();

        $pendingSessions = MentorshipSession::query()
            ->where('mentor_user_id', $user->getKey())
            ->where('status', 'pending')
            ->count();

        $activeMentees = MentorshipSession::query()
            ->where('mentor_user_id', $user->getKey())
            ->whereNotNull('mentee_user_id')
            ->distinct('mentee_user_id')
            ->count('mentee_user_id');

        $healthScore = $totalSessions > 0
            ? (int) min(100, round((($completedSessions / $totalSessions) * 60) + min($activeMentees * 8, 30) + max(0, 10 - $pendingSessions * 2)))
            : 55;

        $alerts = [];
        if ($pendingSessions > 3) {
            $alerts[] = 'Approve mentee requests waiting in the queue.';
        }

        if ($healthScore < 60) {
            $alerts[] = 'Log wins or mark sessions complete to boost trust signal.';
        }

        return new KeyedDashboardWidgetData(
            key: 'mentor-relationship-health',
            data: [
                'health_score' => $healthScore,
                'active_mentees' => $activeMentees,
                'alerts' => $alerts,
                'programs' => $programs->map(fn (MentorshipProgram $program) => [
                    'title' => $program->title,
                    'status' => $program->status,
                    'capacity' => $program->capacity,
                    'focus_area' => $program->focus_area,
                    'mentees' => $program->mentees_count,
                ])->values()->all(),
                'cta' => [
                    'label' => 'Open mentor workspace',
                    'url' => url('/mentorship'),
                ],
            ],
        );
    }

    private function buildBusinessMomentumSnapshot(User $user, array $definition): KeyedDashboardWidgetData
    {
        $snapshot = $this->businessSnapshot($user);

        return new KeyedDashboardWidgetData(
            key: 'business-momentum-snapshot',
            data: [
                'venture' => $snapshot['venture'] ?? $user->name,
                'digest_summary' => $snapshot['digest_summary'] ?? 'Share a recent customer win to unlock AI insights.',
                'kpis' => array_map(static function ($metricKey, $metricValue) {
                    return [
                        'key' => $metricKey,
                        'label' => $metricValue['label'] ?? Str::headline($metricKey),
                        'value' => $metricValue['value'] ?? null,
                        'suffix' => $metricValue['suffix'] ?? null,
                        'helper' => $metricValue['helper'] ?? null,
                    ];
                }, array_keys($snapshot['kpis'] ?? []), $snapshot['kpis'] ?? []),
                'next_milestone' => $snapshot['next_milestone'] ?? null,
                'resource_spotlight' => $snapshot['resource_spotlight'] ?? null,
                'recommendations' => $snapshot['recommendations'] ?? ['Create your business profile to unlock the momentum dashboard.'],
                'cta' => [
                    'label' => 'Open business hub',
                    'url' => url('/business'),
                ],
            ],
        );
    }

    private function buildBusinessCommunityPulse(User $user, array $definition): KeyedDashboardWidgetData
    {
        $snapshot = $this->businessSnapshot($user);
        $pulse = $snapshot['community_pulse'] ?? [
            'weekly_posts' => 0,
            'avg_engagement' => 0,
            'trending_tags' => [],
            'last_posted' => null,
        ];

        return new KeyedDashboardWidgetData(
            key: 'business-community-pulse',
            data: [
                'weekly_posts' => $pulse['weekly_posts'] ?? 0,
                'avg_engagement' => $pulse['avg_engagement'] ?? 0,
                'trending_tags' => $pulse['trending_tags'] ?? [],
                'last_posted' => $pulse['last_posted'] ?? null,
                'recommendations' => $snapshot['recommendations'] ?? ['Post twice this week to stay visible inside the Business Network.'],
                'cta' => [
                    'label' => 'Share an update',
                    'url' => url('/business/community'),
                ],
            ],
        );
    }

    private function buildRealEstatePipelineOverview(User $user, array $definition): KeyedDashboardWidgetData
    {
        $listings = WomenHousingListing::query()
            ->where('owner_user_id', $user->getKey())
            ->latest('created_at')
            ->limit(6)
            ->get();

        $learningPaths = RealEstateLearningPath::query()
            ->where('ai_guided', true)
            ->orderBy('title')
            ->limit(3)
            ->get();

        $enrolments = LearningPathEnrolment::query()
            ->where('user_id', $user->getKey())
            ->latest('updated_at')
            ->limit(3)
            ->with('path')
            ->get();

        return new KeyedDashboardWidgetData(
            key: 'real-estate-pipeline-overview',
            data: [
                'listings' => $listings->map(fn (WomenHousingListing $listing) => [
                    'title' => $listing->title,
                    'status' => $listing->verification_status,
                    'audience' => $listing->audience,
                    'availability' => optional($listing->availability_date)->toDateString(),
                    'weekly_rent' => $listing->price_cents,
                    'link' => url('/housing/'.$listing->slug),
                ])->values()->all(),
                'learning_paths' => $learningPaths->map(fn (RealEstateLearningPath $path) => [
                    'title' => $path->title,
                    'difficulty' => $path->difficulty_level,
                    'duration_weeks' => $path->duration_weeks,
                    'ai_guided' => $path->ai_guided,
                ])->values()->all(),
                'enrolments' => $enrolments->map(fn (LearningPathEnrolment $enrolment) => [
                    'path' => optional($enrolment->path)->title,
                    'progress_percent' => $enrolment->progress_percent,
                    'status' => $enrolment->enrolment_status,
                ])->values()->all(),
                'metrics' => [
                    'active_listings' => $listings->count(),
                    'verified' => $listings->where('verification_status', 'verified')->count(),
                    'pending_matches' => $listings->where('moderation_status', 'pending')->count(),
                ],
                'cta' => [
                    'label' => 'Open housing pipeline',
                    'url' => url('/real-estate/pipeline'),
                ],
            ],
        );
    }

    private function buildRealEstateSafetyCompliance(User $user, array $definition): KeyedDashboardWidgetData
    {
        $listings = WomenHousingListing::query()
            ->where('owner_user_id', $user->getKey())
            ->latest('updated_at')
            ->limit(6)
            ->get();

        $audits = $listings->map(fn (WomenHousingListing $listing) => [
            'title' => $listing->title,
            'status' => $listing->verification_status,
            'moderation' => $listing->moderation_status,
            'mortgage_required' => $listing->mortgage_required,
            'updated_at' => optional($listing->updated_at)->diffForHumans(),
        ])->values()->all();

        $alerts = [];
        $pendingVerifications = $listings->where('verification_status', '!=', 'verified')->count();
        if ($pendingVerifications > 0) {
            $alerts[] = sprintf('%d listings awaiting verification review.', $pendingVerifications);
        }

        $mortgageRequired = $listings->where('mortgage_required', true)->count();
        if ($mortgageRequired > 0) {
            $alerts[] = 'Confirm DV-safe mortgage process for '.$mortgageRequired.' homes.';
        }

        return new KeyedDashboardWidgetData(
            key: 'real-estate-safety-compliance',
            data: [
                'audits' => $audits,
                'metrics' => [
                    'pending_verifications' => $pendingVerifications,
                    'safe_listings' => $listings->where('verification_status', 'verified')->count(),
                    'support_alerts' => count($alerts),
                ],
                'alerts' => $alerts,
                'cta' => [
                    'label' => 'Review compliance kit',
                    'url' => url('/real-estate/compliance'),
                ],
            ],
        );
    }

    private function buildFinancialSavingsMilestones(User $user, array $definition): KeyedDashboardWidgetData
    {
        $budgets = Budget::query()
            ->where('user_id', $user->getKey())
            ->latest('updated_at')
            ->limit(3)
            ->with('items')
            ->get();

        $transactions = BankTransaction::query()
            ->where('user_id', $user->getKey())
            ->whereBetween('posted_at', [now()->subDays(45), now()])
            ->get();

        $income = $transactions->where('direction', 'credit')->sum('amount');
        $expenses = $transactions->where('direction', 'debit')->sum('amount');
        $savingsRate = $income > 0 ? (int) round(max($income - $expenses, 0) / max($income, 1) * 100) : 0;

        return new KeyedDashboardWidgetData(
            key: 'financial-savings-milestones',
            data: [
                'milestones' => $budgets->map(function (Budget $budget) {
                    $goal = (int) max($budget->savings_goal_monthly ?? 0, 1);
                    $actual = (int) $budget->items->sum('amount');
                    $progress = $goal > 0 ? (int) min(100, round(($actual / $goal) * 100)) : 0;

                    return [
                        'label' => $budget->label ?? 'Savings sprint',
                        'goal' => $goal,
                        'progress_percent' => $progress,
                        'updated_at' => optional($budget->updated_at)->diffForHumans(),
                    ];
                })->values()->all(),
                'savings_rate' => $savingsRate,
                'recent_contributions' => $transactions
                    ->where('direction', 'credit')
                    ->sortByDesc('posted_at')
                    ->take(4)
                    ->map(fn (BankTransaction $transaction) => [
                        'description' => Str::limit($transaction->description, 60),
                        'amount' => $transaction->amount,
                        'posted_at' => optional($transaction->posted_at)->toDateString(),
                    ])->values()->all(),
                'cta' => [
                    'label' => 'Open savings plan',
                    'url' => url('/finance/savings'),
                ],
            ],
        );
    }

    private function buildFinancialWorkshopFlow(User $user, array $definition): KeyedDashboardWidgetData
    {
        $workshops = MentorshipProgram::query()
            ->where('status', 'active')
            ->where(function ($query) {
                $query->where('focus_area', 'like', '%finance%')
                    ->orWhere('title', 'like', '%finance%');
            })
            ->orderByDesc('created_at')
            ->limit(4)
            ->get();

        $registrations = MentorshipSession::query()
            ->whereIn('program_id', $workshops->pluck('id'))
            ->whereNotNull('mentee_user_id')
            ->count();

        return new KeyedDashboardWidgetData(
            key: 'financial-workshop-flow',
            data: [
                'workshops' => $workshops->map(fn (MentorshipProgram $program) => [
                    'title' => $program->title,
                    'capacity' => $program->capacity,
                    'focus_area' => $program->focus_area,
                    'status' => $program->status,
                ])->values()->all(),
                'metrics' => [
                    'active_workshops' => $workshops->count(),
                    'registrations' => $registrations,
                    'avg_capacity' => $workshops->avg('capacity') ?: 0,
                ],
                'cta' => [
                    'label' => 'Launch new workshop',
                    'url' => url('/finance/workshops'),
                ],
            ],
        );
    }

    private function buildTradesApprenticeshipView(User $user, array $definition): KeyedDashboardWidgetData
    {
        $programs = ApprenticeshipProgram::query()
            ->orderByDesc('created_at')
            ->limit(4)
            ->get()
            ->map(fn (ApprenticeshipProgram $program) => [
                'title' => $program->title,
                'location' => $program->location,
                'status' => $program->status,
                'duration_weeks' => $program->duration_weeks,
            ])
            ->all();

        return new KeyedDashboardWidgetData(
            key: 'trades-apprenticeship-view',
            data: [
                'programs' => $programs,
                'metrics' => [
                    'active' => collect($programs)->where('status', 'active')->count(),
                    'drafts' => collect($programs)->where('status', 'draft')->count(),
                    'placements' => ApprenticeshipProgram::query()->where('status', 'placed')->count(),
                ],
                'cta' => [
                    'label' => 'Plan cohort',
                    'url' => url('/apprenticeships'),
                ],
            ],
        );
    }

    private function buildTradesEquipmentFinancing(User $user, array $definition): KeyedDashboardWidgetData
    {
        $loans = Debt::query()
            ->where('user_id', $user->getKey())
            ->orderByDesc('balance')
            ->limit(4)
            ->get();

        $transactions = BankTransaction::query()
            ->where('user_id', $user->getKey())
            ->orderByDesc('posted_at')
            ->limit(3)
            ->get();

        return new KeyedDashboardWidgetData(
            key: 'trades-equipment-financing',
            data: [
                'loans' => $loans->map(fn (Debt $debt) => [
                    'name' => $debt->name,
                    'balance' => $debt->balance,
                    'interest_rate' => $debt->interest_rate,
                    'min_payment' => $debt->min_payment,
                ])->values()->all(),
                'metrics' => [
                    'total_balance' => $loans->sum('balance'),
                    'avg_rate' => round((float) $loans->avg('interest_rate'), 2),
                    'monthly_payment' => $loans->sum('min_payment'),
                ],
                'recent_activity' => $transactions->map(fn (BankTransaction $transaction) => [
                    'description' => Str::limit($transaction->description, 50),
                    'amount' => $transaction->amount,
                    'posted_at' => optional($transaction->posted_at)->toDateString(),
                ])->values()->all(),
                'cta' => [
                    'label' => 'Request financing deck',
                    'url' => url('/finance/equipment'),
                ],
            ],
        );
    }

    private function describePulseMetric(string $key, float|int $value): string
    {
        return match ($key) {
            'trajectory' => $value >= 65
                ? 'Your trajectory is on-track with current goals.'
                : 'Bring in more projects so we can push new introductions.',
            'marketability' => $value >= 70
                ? 'Mentors are highlighting your pitch—keep the cadence.'
                : 'Refresh your story and share two recent outcomes.',
            'confidence' => $value >= 60
                ? 'Confidence is compounding through consistent wins.'
                : 'Document weekly wins so we can calibrate your story.',
            default => 'Momentum builds as we learn more about your work.',
        };
    }

    private function normaliseSlug(string $value): string
    {
        $slug = Str::slug($value);

        return $slug !== '' ? $slug : Str::random(6);
    }

    private function resolveCompany(User $user): ?Company
    {
        if ($user->company_id) {
            return Company::find($user->company_id);
        }

        if ($user->relationLoaded('company')) {
            return $user->company;
        }

        if ($user->company()->exists()) {
            return $user->company;
        }

        if (method_exists(Company::class, 'teamMembers')) {
            return Company::query()
                ->whereHas('teamMembers', fn ($query) => $query->where('user_id', $user->getKey()))
                ->first();
        }

        return null;
    }

    private function buildTaxReturnableAssets(User $user, array $definition): KeyedDashboardWidgetData
    {
        $assets = \App\Models\TaxAsset::query()
            ->where('user_id', $user->getKey())
            ->orderByDesc('purchase_date')
            ->limit(5)
            ->get();

        $totalValue = $assets->sum('current_value');
        $totalCost = $assets->sum('cost');

        return new KeyedDashboardWidgetData(
            key: 'tax-returnable-assets',
            data: [
                'assets' => $assets->map(fn (\App\Models\TaxAsset $asset) => [
                    'id' => $asset->getKey(),
                    'name' => $asset->name,
                    'purchase_date' => optional($asset->purchase_date)->toDateString(),
                    'cost' => $asset->cost,
                    'current_value' => $asset->current_value,
                    'depreciation_type' => Str::headline($asset->depreciation_type),
                ])->values()->all(),
                'metrics' => [
                    'total_assets' => $assets->count(),
                    'total_value' => $totalValue,
                    'total_cost' => $totalCost,
                ],
                'cta' => [
                    'label' => 'Add new asset',
                    'url' => url('/finance/assets/create'),
                ],
            ],
        );
    }

    private function buildReceiptsAndLogbook(User $user, array $definition): KeyedDashboardWidgetData
    {
        $receipts = \App\Models\Receipt::query()
            ->where('user_id', $user->getKey())
            ->latest('date')
            ->limit(5)
            ->get();

        $logbooks = \App\Models\VehicleLogbook::query()
            ->where('user_id', $user->getKey())
            ->with(['entries' => fn($q) => $q->latest('date')->limit(1)])
            ->get();

        return new KeyedDashboardWidgetData(
            key: 'receipts-and-logbook',
            data: [
                'receipts' => $receipts->map(fn (\App\Models\Receipt $receipt) => [
                    'id' => $receipt->getKey(),
                    'merchant' => $receipt->merchant_name,
                    'date' => optional($receipt->date)->toDateString(),
                    'amount' => $receipt->amount,
                    'category' => $receipt->category,
                    'has_image' => !empty($receipt->image_path),
                ])->values()->all(),
                'logbooks' => $logbooks->map(fn (\App\Models\VehicleLogbook $logbook) => [
                    'id' => $logbook->getKey(),
                    'vehicle' => $logbook->vehicle_name,
                    'registration' => $logbook->registration_number,
                    'last_entry' => $logbook->entries->first() ? [
                        'date' => optional($logbook->entries->first()->date)->toDateString(),
                        'distance' => $logbook->entries->first()->distance,
                    ] : null,
                ])->values()->all(),
                'cta_receipt' => [
                    'label' => 'Scan receipt',
                    'url' => url('/finance/receipts/scan'),
                ],
                'cta_logbook' => [
                    'label' => 'Log trip',
                    'url' => url('/finance/logbook/entry'),
                ],
            ],
        );
    }

    private function businessSnapshot(User $user): ?array
    {
        $cacheKey = $user->getKey();

        if (array_key_exists($cacheKey, $this->businessSnapshotCache)) {
            return $this->businessSnapshotCache[$cacheKey];
        }

        $user->loadMissing('businessProfile');
        $profile = $user->businessProfile;

        if (! $profile) {
            return $this->businessSnapshotCache[$cacheKey] = null;
        }

        return $this->businessSnapshotCache[$cacheKey] = $this->businessInsightsService->snapshot($profile);
    }

    public function __call(string $name, array $arguments)
    {
        if (str_starts_with($name, 'build')) {
            return null;
        }

        throw new InvalidArgumentException("Undefined method [{$name}] called on RoleDashboardService");
    }
}

