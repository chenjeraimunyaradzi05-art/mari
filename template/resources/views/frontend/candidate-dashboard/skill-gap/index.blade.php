<x-app-layout>
	@php
		$toCollection = function ($value) {
			if ($value instanceof \Illuminate\Pagination\AbstractPaginator) {
				return $value->getCollection();
			}

			if ($value instanceof \Illuminate\Support\Collection) {
				return $value;
			}

			if (is_array($value)) {
				return collect($value);
			}

			return collect();
		};

		$normalizeItem = function ($value) {
			if (is_array($value)) {
				return $value;
			}

			if (is_object($value)) {
				return get_object_vars($value);
			}

			return [];
		};

		$latestAnalysisModel = $latestAnalysis ?? null;
		$hasLatestAnalysis = !empty($latestAnalysisModel);

		$analysisDate = $hasLatestAnalysis ? data_get($latestAnalysisModel, 'analysis_date') : null;

		if ($analysisDate && ! $analysisDate instanceof \Carbon\CarbonInterface) {
			try {
				$analysisDate = \Carbon\Carbon::parse((string) $analysisDate);
			} catch (\Exception $exception) {
				$analysisDate = null;
			}
		}

		$analysisDateLabel = $analysisDate instanceof \Carbon\CarbonInterface
			? $analysisDate->format('M d, Y')
			: null;

		$competitivenessScore = $hasLatestAnalysis ? (float) data_get($latestAnalysisModel, 'market_competitiveness', 0) : null;
		if ($competitivenessScore !== null) {
			$competitivenessScore = max(0, min(100, $competitivenessScore));
		}

		$competitivenessLevel = $hasLatestAnalysis ? (string) data_get($latestAnalysisModel, 'competitiveness_level', 'In review') : null;
		$competitivenessColor = $hasLatestAnalysis ? (string) data_get($latestAnalysisModel, 'competitiveness_color', '#6366f1') : '#6366f1';

		$skillsMatched = (int) ($hasLatestAnalysis ? data_get($latestAnalysisModel, 'skills_matched', 0) : 0);
		$skillsGap = (int) ($hasLatestAnalysis ? data_get($latestAnalysisModel, 'skills_gap', 0) : 0);
		$skillsAnalyzed = max(0, $skillsMatched + $skillsGap);
		$careerLevel = $hasLatestAnalysis ? (string) data_get($latestAnalysisModel, 'career_level', 'Emerging professional') : 'Not yet classified';

		$aiRecommendations = $hasLatestAnalysis ? trim((string) data_get($latestAnalysisModel, 'ai_recommendations', '')) : '';

		$priorityGaps = collect(data_get($latestAnalysisModel, 'priority_gaps', []))
			->map($normalizeItem)
			->filter(function ($gap) {
				return filled($gap['skill_name'] ?? null);
			})
			->values();

		$criticalGapIndex = $priorityGaps->search(function ($gap) {
			$priority = strtolower((string) ($gap['priority'] ?? ''));
			return $priority === 'critical';
		});

		$criticalGap = $criticalGapIndex !== false ? $priorityGaps->get($criticalGapIndex) : null;

		$topSkills = collect(data_get($latestAnalysisModel, 'top_in_demand_skills', []))
			->map($normalizeItem)
			->filter(function ($skill) {
				return filled($skill['name'] ?? null);
			})
			->values();

		$marketInsights = collect($hasLatestAnalysis ? data_get($latestAnalysisModel, 'market_insights', []) : []);
		$totalOpportunities = (int) $marketInsights->get('total_opportunities', 0);
		$matchedOpportunities = (int) $marketInsights->get('matched_jobs', 0);
		$potentialSalaryIncrease = $marketInsights->get('potential_salary_increase');
		$trendingSkillsCollection = collect($marketInsights->get('trending_skills', []))
			->map($normalizeItem)
			->filter(function ($skill) {
				return filled($skill['name'] ?? null);
			})
			->values();
		$industryDemandCollection = collect($marketInsights->get('industry_demand', []))
			->map($normalizeItem)
			->filter(function ($industry) {
				return filled($industry['name'] ?? null);
			})
			->values();
		$locationHotspotsCollection = collect($marketInsights->get('location_hotspots', []))
			->map($normalizeItem)
			->filter(function ($location) {
				return filled($location['name'] ?? null);
			})
			->values();

		$inDemandSkillsCollection = $topSkills->isNotEmpty() ? $topSkills : $trendingSkillsCollection;

		$learningPathsCollection = collect($hasLatestAnalysis ? data_get($latestAnalysisModel, 'learning_paths', []) : [])
			->map($normalizeItem)
			->filter(function ($path) {
				return filled($path['name'] ?? null);
			})
			->values();

		$learningStatsCollection = collect($learningStats ?? []);
		$totalResources = (int) $learningStatsCollection->get('total_resources', 0);
		$totalCompleted = (int) $learningStatsCollection->get('completed', 0);
		$totalInProgress = (int) $learningStatsCollection->get('in_progress', 0);
		$totalTimeMinutes = (int) $learningStatsCollection->get('total_time_spent', 0);
		$totalTimeHours = intdiv($totalTimeMinutes, 60);
		$totalTimeRemainderMinutes = $totalTimeMinutes % 60;
		$totalTimeLabel = $totalTimeHours > 0
			? sprintf('%dh %02dm', $totalTimeHours, $totalTimeRemainderMinutes)
			: sprintf('%d min', $totalTimeMinutes);

		$recommendedResourcesCollection = $toCollection($recommendedResources ?? null)->filter();
		$recentProgressCollection = $toCollection($recentProgress ?? null)->filter();

		$hasRecommendedResources = $recommendedResourcesCollection->isNotEmpty();
		$hasRecentProgress = $recentProgressCollection->isNotEmpty();

		$firstResource = $hasRecommendedResources ? $recommendedResourcesCollection->first() : null;
		$firstResourceId = $firstResource ? data_get($firstResource, 'id') : null;

		$firstProgress = $hasRecentProgress ? $recentProgressCollection->first() : null;
		$firstProgressId = $firstProgress
			? (data_get($firstProgress, 'id')
				?? data_get($firstProgress, 'learning_resource_id')
				?? spl_object_id($firstProgress))
			: null;

		$highlightItems = collect();

		if ($hasLatestAnalysis) {
			$highlightItems->push([
				'icon' => 'fa-tachometer-alt',
				'label' => 'Market stance',
				'meta' => ($competitivenessScore !== null ? number_format($competitivenessScore, 0) . '% competitive' : 'Awaiting scan'),
				'target' => 'skills-card-competitiveness',
			]);
		}

		if ($criticalGap) {
			$highlightItems->push([
				'icon' => 'fa-exclamation-triangle',
				'label' => 'Critical gap',
				'meta' => $criticalGap['skill_name'],
				'target' => 'priority-gap-' . $criticalGapIndex,
			]);
		}

		if ($hasRecommendedResources) {
			$highlightItems->push([
				'icon' => 'fa-book-open',
				'label' => 'Learning track',
				'meta' => $recommendedResourcesCollection->count() . ' picks ready',
				'target' => $firstResourceId !== null ? 'skills-resource-' . $firstResourceId : 'skills-section-resources',
			]);
		}

		if ($hasRecentProgress) {
			$highlightItems->push([
				'icon' => 'fa-history',
				'label' => 'Momentum log',
				'meta' => $recentProgressCollection->count() . ' activities logged',
				'target' => $firstProgressId !== null ? 'skills-progress-' . $firstProgressId : 'skills-section-progress',
			]);
		}

		$criticalGapCount = $priorityGaps->filter(function ($gap) {
			return strtolower((string) ($gap['priority'] ?? '')) === 'critical';
		})->count();
		$highGapCount = $priorityGaps->filter(function ($gap) {
			return strtolower((string) ($gap['priority'] ?? '')) === 'high';
		})->count();
		$recommendedResourcesCount = $recommendedResourcesCollection->count();
		$recentProgressCount = $recentProgressCollection->count();

		$formatNumber = function ($value) {
			return number_format((int) round($value ?? 0));
		};

		$formatCurrency = function ($value) {
			if ($value === null || $value === '') {
				return 'N/A';
			}

			return '$' . number_format((float) $value, 0);
		};

		$formatPercent = function ($value, $decimals = 0) {
			if ($value === null || $value === '') {
				return 'N/A';
			}

			return number_format((float) $value, $decimals) . '%';
		};

		$hasAnalyzeRoute = \Illuminate\Support\Facades\Route::has('member.skill-gap.analyze');
		$hasLearningPathsRoute = \Illuminate\Support\Facades\Route::has('member.skill-gap.learning-paths');
		$hasProgressRoute = \Illuminate\Support\Facades\Route::has('member.skill-gap.progress');
		$hasResourceRoute = \Illuminate\Support\Facades\Route::has('member.skill-gap.resources');

		$analysisStatusLabel = $analysisDateLabel ? 'Synced ' . $analysisDateLabel : 'Awaiting first analysis';

		$aiRecommendationLines = collect($aiRecommendations !== '' ? preg_split('/\r?\n\r?\n/', (string) $aiRecommendations) : [])
			->map(function ($line) {
				return trim((string) $line);
			})
			->filter();
	@endphp

	<div class="skills-dashboard container py-5 py-md-6">
		<section class="skills-hero rounded-4 overflow-hidden">
			<div class="skills-hero__background"></div>
			<div class="skills-hero__container">
				<div class="skills-hero__content">
					<span class="skills-hero__eyebrow">Skill Compass</span>
					<h1 class="skills-hero__title">Map your strengths and close the distance to your next opportunity</h1>
					<p class="skills-hero__subtitle">
						{{ $hasLatestAnalysis ? 'Review what the market loves, see the gaps to close, and move with confidence into the roles drawing near.' : 'Launch your first scan to reveal the skills lighting up demand charts and the ones that need a little polish.' }}
					</p>
					<div class="skills-hero__cta">
						<a href="{{ $hasAnalyzeRoute ? route('member.skill-gap.analyze') : '#' }}" class="skills-hero__primary" @unless($hasAnalyzeRoute) aria-disabled="true" @endunless>
							<i class="fas fa-sync-alt"></i>
							Rescan my skills
						</a>
						<a href="{{ $hasLearningPathsRoute && $hasLatestAnalysis ? route('member.skill-gap.learning-paths') : '#' }}" class="skills-hero__secondary" @if(! $hasLearningPathsRoute || ! $hasLatestAnalysis) aria-disabled="true" @endif>
							<i class="fas fa-map-signs"></i>
							Explore learning paths
						</a>
					</div>
				</div>
				<div class="skills-hero__metrics">
					<div class="hero-stat hero-stat--indigo" id="skills-card-competitiveness">
						<span class="hero-stat__icon" style="background: {{ $competitivenessColor }};"><i class="fas fa-tachometer-alt"></i></span>
						<div>
							<p class="hero-stat__label">Market competitiveness</p>
							<p class="hero-stat__value">{{ $competitivenessScore !== null ? number_format($competitivenessScore, 0) . '%' : '—' }}</p>
							<p class="hero-stat__hint">{{ $competitivenessLevel ?? 'Pending review' }}</p>
						</div>
					</div>
					<div class="hero-stat hero-stat--lilac">
						<span class="hero-stat__icon"><i class="fas fa-layer-group"></i></span>
						<div>
							<p class="hero-stat__label">Skills matched</p>
							<p class="hero-stat__value">{{ number_format($skillsMatched) }} / {{ number_format($skillsAnalyzed) }}</p>
							<p class="hero-stat__hint">{{ number_format($skillsGap) }} gaps remaining</p>
						</div>
					</div>
					<div class="hero-stat hero-stat--sunrise">
						<span class="hero-stat__icon"><i class="fas fa-graduation-cap"></i></span>
						<div>
							<p class="hero-stat__label">Learning momentum</p>
							<p class="hero-stat__value">{{ number_format($totalResources) }}</p>
							<p class="hero-stat__hint">{{ number_format($totalCompleted) }} completed | {{ number_format($totalInProgress) }} active</p>
						</div>
					</div>
					<div class="hero-stat hero-stat--rose">
						<span class="hero-stat__icon"><i class="fas fa-clock"></i></span>
						<div>
							<p class="hero-stat__label">Time invested</p>
							<p class="hero-stat__value">{{ $totalTimeLabel }}</p>
							<p class="hero-stat__hint">{{ $analysisStatusLabel }}</p>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section class="skills-highlight mt-5">
			<div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
				<div>
					<h2 class="section-title mb-1">Where to focus next</h2>
					<p class="section-subtitle mb-0">Hop straight to the sections unlocking the biggest lift right now</p>
				</div>
				<span class="status-pill">{{ $analysisStatusLabel }}</span>
			</div>

			<div class="skills-highlight-strip">
				@forelse($highlightItems as $highlight)
					<button type="button" class="skills-highlight-card" data-skills-target="{{ $highlight['target'] }}">
						<span class="skills-highlight-card__icon"><i class="fas {{ $highlight['icon'] }}"></i></span>
						<span class="skills-highlight-card__label">{{ $highlight['label'] }}</span>
						<span class="skills-highlight-card__meta">{{ $highlight['meta'] }}</span>
					</button>
				@empty
					<div class="skills-highlight-card skills-highlight-card--empty">
						<span class="skills-highlight-card__icon"><i class="fas fa-sparkles"></i></span>
						<span class="skills-highlight-card__label">Run an analysis to generate highlights</span>
						<span class="skills-highlight-card__meta">We&rsquo;ll surface your focus points here</span>
					</div>
				@endforelse
			</div>
		</section>

		<section class="skills-summary mt-5">
			<div class="skills-summary-grid">
				<div class="skills-summary-card skills-summary-card--sunrise">
					<span class="skills-summary-card__icon"><i class="fas fa-chart-pie"></i></span>
					<div>
						<p class="skills-summary-card__label">Skills analyzed</p>
						<p class="skills-summary-card__value">{{ number_format($skillsAnalyzed) }}</p>
						<p class="skills-summary-card__hint">{{ number_format($skillsMatched) }} aligned to your profile</p>
					</div>
				</div>
				<div class="skills-summary-card skills-summary-card--lilac">
					<span class="skills-summary-card__icon"><i class="fas fa-bolt"></i></span>
					<div>
						<p class="skills-summary-card__label">Critical gaps</p>
						<p class="skills-summary-card__value">{{ number_format($criticalGapCount) }}</p>
						<p class="skills-summary-card__hint">{{ number_format($highGapCount) }} additional high-priority gaps</p>
					</div>
				</div>
				<div class="skills-summary-card skills-summary-card--indigo">
					<span class="skills-summary-card__icon"><i class="fas fa-graduation-cap"></i></span>
					<div>
						<p class="skills-summary-card__label">Resources curated</p>
						<p class="skills-summary-card__value">{{ number_format($totalResources) }}</p>
						<p class="skills-summary-card__hint">{{ number_format($totalCompleted) }} finished to date</p>
					</div>
				</div>
				<div class="skills-summary-card skills-summary-card--rose">
					<span class="skills-summary-card__icon"><i class="fas fa-history"></i></span>
					<div>
						<p class="skills-summary-card__label">Recent progress</p>
						<p class="skills-summary-card__value">{{ number_format($recentProgressCount) }}</p>
						<p class="skills-summary-card__hint">{{ number_format($recommendedResourcesCount) }} new picks ready</p>
					</div>
				</div>
			</div>
		</section>

		<section class="skills-grid mt-5">
			<div class="row g-4">
				<div class="col-xl-6">
					<article class="skills-card" id="skills-section-analysis">
						<header class="skills-card__header">
							<div>
								<span class="skills-card__eyebrow">Market position</span>
								<h3 class="skills-card__title">Competitiveness snapshot</h3>
								<p class="skills-card__subtitle">Understand how your skills stack against current demand</p>
							</div>
							@if($hasAnalyzeRoute)
								<a href="{{ route('member.skill-gap.analyze') }}" class="skills-card__link">
									<i class="fas fa-sync-alt"></i>
									Refresh analysis
								</a>
							@endif
						</header>
						<div class="skills-score">
							<div class="skills-score__value" style="color: {{ $competitivenessColor }};">
								{{ $competitivenessScore !== null ? number_format($competitivenessScore, 0) . '%' : 'Awaiting scan' }}
							</div>
							<div class="skills-score-bar">
								<div class="skills-score-bar__fill" style="width: {{ $competitivenessScore !== null ? max(4, min(100, $competitivenessScore)) : 0 }}%; background: {{ $competitivenessColor }};"></div>
							</div>
							<p class="skills-score__note">{{ $competitivenessLevel ? 'Currently rated: ' . $competitivenessLevel : 'Final rating coming soon' }}</p>
						</div>
						<ul class="skills-meta-list">
							<li>
								<i class="fas fa-user-tie"></i>
								<span>Career level: <strong>{{ $careerLevel }}</strong></span>
							</li>
							<li>
								<i class="fas fa-briefcase"></i>
								<span>Matched roles: <strong>{{ number_format($matchedOpportunities) }}</strong> of {{ number_format($totalOpportunities) }}</span>
							</li>
							<li>
								<i class="fas fa-dollar-sign"></i>
								<span>Salary lift potential: <strong>{{ $formatCurrency($potentialSalaryIncrease) }}</strong></span>
							</li>
						</ul>
					</article>
				</div>
				<div class="col-xl-6">
					<article class="skills-card" id="skills-section-ai">
						<header class="skills-card__header">
							<div>
								<span class="skills-card__eyebrow">AI guidance</span>
								<h3 class="skills-card__title">Personalized recommendations</h3>
								<p class="skills-card__subtitle">Actionable nudges to convert momentum into results</p>
							</div>
						</header>
						@if($aiRecommendationLines->isNotEmpty())
							<div class="skills-recommendations">
								@foreach($aiRecommendationLines as $line)
									<div class="skills-recommendation">
										<span class="skills-recommendation__icon"><i class="fas fa-sparkles"></i></span>
										<p class="skills-recommendation__text">{{ $line }}</p>
									</div>
								@endforeach
							</div>
						@else
							<div class="skills-empty">
								<span class="skills-empty__icon"><i class="fas fa-robot"></i></span>
								<h4 class="skills-empty__title">Insights will appear after your next scan</h4>
								<p class="skills-empty__subtitle">Trigger an analysis to receive step-by-step recommendations.</p>
							</div>
						@endif
					</article>
				</div>
			</div>
		</section>

		<section class="skills-grid mt-4">
			<div class="row g-4">
				<div class="col-xxl-7">
					<article class="skills-card" id="skills-section-gaps">
						<header class="skills-card__header">
							<div>
								<span class="skills-card__eyebrow">Gap radar</span>
								<h3 class="skills-card__title">Priority skills to close</h3>
								<p class="skills-card__subtitle">Focus on the gaps unlocking the biggest hiring signals</p>
							</div>
						</header>
						<div class="skills-gap-list">
							@forelse($priorityGaps as $gapIndex => $gap)
								@php
									$priority = strtolower((string) data_get($gap, 'priority', ''));
									$priorityLabel = $priority !== '' ? \Illuminate\Support\Str::headline($priority) : 'Review';
									$demandLevel = (string) data_get($gap, 'demand_level', 'High');
								@endphp
								<div class="skills-gap-item skills-gap-item--{{ $priority ?: 'review' }}" id="priority-gap-{{ $gapIndex }}">
									<div class="skills-gap-item__header">
										<div>
											<p class="skills-gap-item__title">{{ data_get($gap, 'skill_name', 'Skill gap') }}</p>
											<p class="skills-gap-item__meta">{{ $priorityLabel }} priority • Demand {{ \Illuminate\Support\Str::headline($demandLevel) }}</p>
										</div>
										<span class="skills-gap-chip">Gap score {{ number_format((float) data_get($gap, 'gap_score', 0), 0) }}</span>
									</div>
									<ul class="skills-gap-stats">
										<li><i class="fas fa-briefcase"></i>{{ number_format((int) data_get($gap, 'job_count', 0)) }} open roles</li>
										<li><i class="fas fa-chart-line"></i>{{ $formatPercent(data_get($gap, 'growth_rate', null), 1) }} growth</li>
										<li><i class="fas fa-wallet"></i>{{ $formatCurrency(data_get($gap, 'avg_salary', null)) }} avg salary</li>
									</ul>
								</div>
							@empty
								<div class="skills-empty">
									<span class="skills-empty__icon"><i class="fas fa-circle-notch"></i></span>
									<h4 class="skills-empty__title">No gaps detected right now</h4>
									<p class="skills-empty__subtitle">Run another scan after adding new skills or updating your profile.</p>
								</div>
							@endforelse
						</div>
					</article>
				</div>
				<div class="col-xxl-5">
					<article class="skills-card" id="skills-section-demand">
						<header class="skills-card__header">
							<div>
								<span class="skills-card__eyebrow">Market buzz</span>
								<h3 class="skills-card__title">In-demand signals</h3>
								<p class="skills-card__subtitle">Spot the skills and locations heating up this week</p>
							</div>
						</header>
						<div class="skills-demand">
							<div class="skills-demand__column">
								<h4 class="skills-demand__title">Hot skills</h4>
								<ul class="skills-chip-list">
									@forelse($inDemandSkillsCollection as $skill)
										<li class="skills-chip">
											<i class="fas fa-fire"></i>
											<span>{{ data_get($skill, 'name') }}</span>
										</li>
									@empty
										<li class="skills-chip skills-chip--empty">Add skills to unlock trending insights</li>
									@endforelse
								</ul>
							</div>
							<div class="skills-demand__column">
								<h4 class="skills-demand__title">Industry demand</h4>
								<ul class="skills-demand-list">
									@forelse($industryDemandCollection as $industry)
										<li>
											<i class="fas fa-building"></i>
											<span>{{ data_get($industry, 'name') }}</span>
											<span class="skills-demand-list__meta">{{ number_format((int) data_get($industry, 'job_count', 0)) }} roles</span>
										</li>
									@empty
										<li class="skills-demand-list__empty">We&rsquo;ll surface industries once data lands.</li>
									@endforelse
								</ul>
							</div>
							<div class="skills-demand__column">
								<h4 class="skills-demand__title">Location hotspots</h4>
								<ul class="skills-demand-list">
									@forelse($locationHotspotsCollection as $location)
										<li>
											<i class="fas fa-map-marker-alt"></i>
											<span>{{ data_get($location, 'name') }}</span>
											<span class="skills-demand-list__meta">{{ number_format((int) data_get($location, 'job_count', 0)) }} roles</span>
										</li>
									@empty
										<li class="skills-demand-list__empty">Hotspots appear once we crunch the latest data.</li>
									@endforelse
								</ul>
							</div>
						</div>
					</article>
				</div>
			</div>
		</section>

		<section class="skills-grid mt-4">
			<div class="row g-4">
				<div class="col-xl-6">
					<article class="skills-card" id="skills-section-resources">
						<header class="skills-card__header">
							<div>
								<span class="skills-card__eyebrow">Learning tracks</span>
								<h3 class="skills-card__title">Recommended resources</h3>
								<p class="skills-card__subtitle">Hand-picked picks to erase gaps faster</p>
							</div>
							@if($hasLearningPathsRoute && $learningPathsCollection->isNotEmpty())
								<a href="{{ route('member.skill-gap.learning-paths') }}" class="skills-card__link">
									<i class="fas fa-project-diagram"></i>
									View learning paths
								</a>
							@endif
						</header>
						<div class="skills-resource-list">
							@forelse($recommendedResourcesCollection as $resourceIndex => $resource)
								@php
									$resourceId = data_get($resource, 'id');
									$resourceKey = $resourceId !== null ? 'skills-resource-' . $resourceId : 'skills-resource-' . $resourceIndex;
									$resourceTitle = data_get($resource, 'title', 'Learning resource');
									$resourceSkill = data_get($resource, 'skill.name') ?? data_get($resource, 'skill_name');
									$resourceDifficulty = \Illuminate\Support\Str::headline((string) data_get($resource, 'difficulty', 'All levels'));
									$resourceTypeIcon = data_get($resource, 'type_icon', 'fa-book-open');
									$resourceDuration = data_get($resource, 'formatted_duration', data_get($resource, 'duration'));
									$resourcePrice = data_get($resource, 'price_display', null);
								@endphp
								<div class="skills-resource-card" id="{{ $resourceKey }}">
									<div class="skills-resource-card__icon"><i class="fas {{ $resourceTypeIcon }}"></i></div>
									<div class="skills-resource-card__content">
										<h4 class="skills-resource-card__title">{{ $resourceTitle }}</h4>
										<p class="skills-resource-card__meta">{{ $resourceSkill ?? 'Multi-skill' }} • {{ $resourceDifficulty }}</p>
										<ul class="skills-resource-card__tags">
											@if($resourceDuration)
												<li><i class="fas fa-clock"></i>{{ $resourceDuration }}</li>
											@endif
											@if($resourcePrice)
												<li><i class="fas fa-wallet"></i>{{ $resourcePrice }}</li>
											@endif
										</ul>
									</div>
									@if($hasResourceRoute && ($skillId = data_get($resource, 'skill_id')))
										<a href="{{ route('member.skill-gap.resources', $skillId) }}" class="skills-resource-card__cta">
											<i class="fas fa-external-link-alt"></i>
										</a>
									@endif
								</div>
							@empty
								<div class="skills-empty">
									<span class="skills-empty__icon"><i class="fas fa-book-open"></i></span>
									<h4 class="skills-empty__title">Learning picks populate after analysis</h4>
									<p class="skills-empty__subtitle">Run the skill gap scan and we&rsquo;ll curate resources automatically.</p>
								</div>
							@endforelse
						</div>
					</article>
				</div>
				<div class="col-xl-6">
					<article class="skills-card" id="skills-section-progress">
						<header class="skills-card__header">
							<div>
								<span class="skills-card__eyebrow">Momentum log</span>
								<h3 class="skills-card__title">Recent learning progress</h3>
								<p class="skills-card__subtitle">See how consistent learning sessions stack up</p>
							</div>
							@if($hasProgressRoute)
								<a href="{{ route('member.skill-gap.progress') }}" class="skills-card__link">
									<i class="fas fa-tasks"></i>
									View all progress
								</a>
							@endif
						</header>
						<div class="skills-progress-list">
							@forelse($recentProgressCollection as $progressIndex => $progress)
								@php
									$progressId = data_get($progress, 'id')
										?? data_get($progress, 'learning_resource_id')
										?? 'progress-' . $progressIndex;
									$progressTitle = data_get($progress, 'learningResource.title') ?? data_get($progress, 'title', 'Learning activity');
									$progressSkill = data_get($progress, 'skill.name') ?? data_get($progress, 'skill_name');
									$progressStatus = data_get($progress, 'status_badge') ?? data_get($progress, 'status');
									$progressPercent = (int) data_get($progress, 'progress_percentage', 0);
									$timeSpent = data_get($progress, 'formatted_time_spent', data_get($progress, 'time_spent'));
								@endphp
								<div class="skills-progress-card" id="skills-progress-{{ $progressId }}">
									<div class="skills-progress-card__header">
										<p class="skills-progress-card__title">{{ $progressTitle }}</p>
										<p class="skills-progress-card__meta">{{ $progressSkill ?? 'Cross-skill' }}</p>
										<span class="skills-progress-card__badge">{{ \Illuminate\Support\Str::headline((string) $progressStatus) }}</span>
									</div>
									<div class="skills-progress-meter">
										<div class="skills-progress-meter__fill" style="width: {{ max(0, min(100, $progressPercent)) }}%;"></div>
									</div>
									<div class="skills-progress-card__footer">
										<span><i class="fas fa-bullseye"></i>{{ $progressPercent }}% complete</span>
										<span><i class="fas fa-hourglass-half"></i>{{ $timeSpent ?? '0m' }} invested</span>
									</div>
								</div>
							@empty
								<div class="skills-empty">
									<span class="skills-empty__icon"><i class="fas fa-flag-checkered"></i></span>
									<h4 class="skills-empty__title">Start tracking your learning journey</h4>
									<p class="skills-empty__subtitle">Complete a resource and log your progress to see momentum here.</p>
								</div>
							@endforelse
						</div>
					</article>
				</div>
			</div>
		</section>
	</div>

	@push('scripts')
		<script>
			document.addEventListener('DOMContentLoaded', function () {
				var highlightButtons = document.querySelectorAll('[data-skills-target]');
				var skillCards = document.querySelectorAll('.skills-card, .hero-stat');

				highlightButtons.forEach(function (button) {
					button.addEventListener('click', function () {
						var targetId = button.getAttribute('data-skills-target');
						var target = targetId ? document.getElementById(targetId) : null;

						if (!target) {
							return;
						}

						skillCards.forEach(function (card) {
							card.classList.remove('skills-card--focus');
						});

						target.classList.add('skills-card--focus');
						target.scrollIntoView({ behavior: 'smooth', block: 'center' });
					});
				});
			});
		</script>
	@endpush

</x-app-layout>

