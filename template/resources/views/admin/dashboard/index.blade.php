@extends('admin.layouts.master')

@section('contents')
<main class="athena-dashboard container">
    <header class="athena-dashboard__header">
        <div class="athena-dashboard__title">
            <h1>Athena — Admin Dashboard</h1>
            <p class="muted">A concise overview of site health, activity and pending work.</p>
        </div>
        <div class="athena-dashboard__actions">
            <form class="search" method="GET" action="{{ url()->current() }}">
                <input name="q" class="search__input" placeholder="Search jobs, members, companies...">
            </form>
            <div class="action-buttons">
                <button type="button"  href="{{ route('admin.jobs.index') }}" class="btn btn-primary">View all jobs</button>
                <button type="button"  href="{{ route('admin.analytics') }}" class="btn btn-ghost">Analytics</button>
            </div>
        </div>
    </header>

    @if (canAccess(['dashboard analytics']))
    <section class="athena-stats-grid" aria-label="Key statistics">
        <article class="stat">
            <div class="stat__icon bg-gradient-primary"><i class="fas fa-dollar-sign"></i></div>
            <div class="stat__meta">
                <div class="stat__label">Total Earnings</div>
                <div class="stat__value">{{ config('settings.site_currency_icon') }} {{ $totalEarnings }}</div>
                <div class="stat__note muted">Since last 30 days</div>
            </div>
        </article>

        <article class="stat">
            <div class="stat__icon bg-gradient-rose"><i class="fas fa-users"></i></div>
            <div class="stat__meta">
                <div class="stat__label">Members</div>
                <div class="stat__value">{{ $totalCandidates }}</div>
                <div class="stat__note muted">Active members / total</div>
            </div>
        </article>

        <article class="stat">
            <div class="stat__icon bg-gradient-amber"><i class="fas fa-building"></i></div>
            <div class="stat__meta">
                <div class="stat__label">Companies</div>
                <div class="stat__value">{{ $totalCompanies }}</div>
                <div class="stat__note muted">Verified partners</div>
            </div>
        </article>

        <article class="stat">
            <div class="stat__icon bg-gradient-green"><i class="fas fa-briefcase"></i></div>
            <div class="stat__meta">
                <div class="stat__label">Jobs</div>
                <div class="stat__value">{{ $totalJobs }}</div>
                <div class="stat__note muted">Open / pending</div>
            </div>
        </article>

        <article class="stat small">
            <div class="stat__icon bg-gradient-blue"><i class="fas fa-check-circle"></i></div>
            <div class="stat__meta">
                <div class="stat__label">Active Jobs</div>
                <div class="stat__value">{{ $activeJobs }}</div>
            </div>
        </article>

        <article class="stat small">
            <div class="stat__icon bg-gradient-gray"><i class="fas fa-times-circle"></i></div>
            <div class="stat__meta">
                <div class="stat__label">Expired Jobs</div>
                <div class="stat__value">{{ $expiredJobs }}</div>
            </div>
        </article>

        <article class="stat small">
            <div class="stat__icon bg-gradient-amber"><i class="fas fa-hourglass-half"></i></div>
            <div class="stat__meta">
                <div class="stat__label">Pending Jobs</div>
                <div class="stat__value">{{ $pendingJobs }}</div>
            </div>
        </article>

        <article class="stat small">
            <div class="stat__icon bg-gradient-red"><i class="fas fa-clock"></i></div>
            <div class="stat__meta">
                <div class="stat__label">Avg Identity Resolution</div>
                <div class="stat__value">{{ $avgResolutionTime }} hrs</div>
            </div>
        </article>
    </section>
    {{-- Analytics section: larger charts and a short summary column --}}
    <section class="athena-analytics" aria-label="Analytics">
        <div class="analytics-charts">
            <div class="card__header" style="padding:0 4px 12px 0;">
                <h3 style="margin:0">Overview & trends</h3>
            </div>
            <div class="chart-placeholder">Traffic & engagement — chart placeholder</div>

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px">
                <div class="small-chart">Conversion: {{ $conversionRate ?? '—' }}</div>
                <div class="small-chart">Avg Response: {{ $avgResolutionTime ?? '—' }} hrs</div>
                <div class="small-chart">New members: {{ $newMembersThisPeriod ?? $totalCandidates }}</div>
            </div>
        </div>

        <aside class="analytics-summary">
            <div class="analytics-card">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
                    <div>
                        <div style="font-size:0.85rem;color:var(--muted)">Conversion last 30d</div>
                        <div style="font-weight:700;font-size:1.3rem">{{ $conversionRate ?? 'N/A' }}</div>
                    </div>
                    <div class="stat__icon bg-gradient-rose" style="width:48px;height:48px;font-size:14px"><i class="fas fa-chart-line"></i></div>
                </div>
            </div>

            <div class="analytics-card">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
                    <div>
                        <div style="font-size:0.85rem;color:var(--muted)">SLA Health (7d)</div>
                        <div style="font-weight:700;font-size:1.2rem">{{ $slaHealth ?? 'Good' }}</div>
                    </div>
                    <div class="stat__icon bg-gradient-blue" style="width:48px;height:48px;font-size:14px"><i class="fas fa-shield-alt"></i></div>
                </div>
            </div>

            <div class="analytics-card" style="display:flex;align-items:center;gap:10px;justify-content:space-between">
                <div>
                    <div style="font-size:0.85rem;color:var(--muted)">Open alerts</div>
                    <div style="font-weight:700;font-size:1.2rem">{{ $openAlerts ?? 0 }}</div>
                </div>
                <div class="stat__icon bg-gradient-amber" style="width:48px;height:48px;font-size:14px"><i class="fas fa-exclamation-triangle"></i></div>
            </div>
        </aside>
    </section>
    @endif

    @if (canAccess(['dashboard pending posts']))
    <section class="athena-grid">
        <div class="athena-grid__main">
            <div class="card card--elevated">
                <header class="card__header">
                    <h3>Pending Jobs Approval</h3>
                    <div class="card__actions">
                        <button type="button"  href="{{ route('admin.jobs.index') }}" class="btn btn-outline">View all</button>
                    </div>
                </header>

                <div class="card__body">
                    <div class="table-responsive">
                        <table class="table table--striped table--compact">
                            <thead>
                                <tr>
                                    <th>Job</th>
                                    <th>Category & Role</th>
                                    <th>Salary</th>
                                    <th>Deadline</th>
                                    <th>Status</th>
                                    <th class="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse ($jobs as $job)
                                <tr>
                                    <td class="job-cell">
                                        @if($job->company->logo)
                                            <img class="job-cell__logo" width="40" src="{{ asset($job->company->logo) }}" alt="logo">
                                        @else
                                            <div class="job-cell__fallback"><i class="fas fa-building"></i></div>
                                        @endif
                                        <div class="job-cell__meta">
                                            <div class="job-cell__title">{{ $job->title }}</div>
                                            <div class="muted">{{ $job->company->name }} • {{ $job->jobType->name }}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="font-weight-600">{{ $job->category?->name }}</div>
                                        <div class="muted">{{ $job->jobRole->name }}</div>
                                    </td>
                                    <td>
                                        @if ($job->salary_mode === 'range')
                                            <div class="salary-range">{{ $job->min_salary }} - {{ $job->max_salary }} {{ config('settings.site_default_currency') }}</div>
                                            <div class="muted small">{{ $job->salaryType->name }}</div>
                                        @else
                                            <div class="salary-range">{{ $job->custom_salary }}</div>
                                            <div class="muted small">{{ $job->salaryType->name }}</div>
                                        @endif
                                    </td>
                                    <td>{{ formatDate($job->deadline) }}</td>
                                    <td>
                                        <span class="badge badge--warning">Pending</span>
                                    </td>
                                    <td class="text-right">
                                        <div class="btn-group">
                                            <a href="{{ route('admin.jobs.edit', $job->id) }}" class="btn btn-sm btn-primary" title="Edit"><i class="fas fa-edit"></i></a>
                                            <form method="POST" action="{{ route('admin.jobs.destroy', $job->id) }}" class="d-inline">
                                                @csrf
                                                @method('DELETE')
                                                <button type="submit" class="btn btn-sm btn-danger delete-item" title="Delete"><i class="fas fa-trash-alt"></i></button>
                                            </form>
                                        </div>
                                    </td>
                                </tr>
                                @empty
                                <tr>
                                    <td colspan="6" class="text-center muted">No pending jobs found.</td>
                                </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>

                <footer class="card__footer text-right">
                    @if (is_object($jobs) && method_exists($jobs, 'hasPages') && $jobs->hasPages())
                        {{ $jobs->withQueryString()->links() }}
                    @endif
                </footer>
            </div>
        </div>

        <aside class="athena-grid__side">
            <div class="card card--compact">
                <h4>Quick Overview</h4>
                <ul class="mini-list">
                    <li>Open jobs <strong>{{ $totalJobs }}</strong></li>
                    <li>Pending approvals <strong>{{ $pendingJobs }}</strong></li>
                    <li>Avg resolution <strong>{{ $avgResolutionTime }} hrs</strong></li>
                </ul>
            </div>

            <div class="card card--compact">
                <h4>Recent Activity</h4>
                <ul class="activity-list">
                    @foreach ($recentEvents ?? [] as $event)
                        <li>
                            <div class="dot"></div>
                            <div class="event-meta">
                                <div class="event-title">{{ $event['title'] ?? 'Event' }}</div>
                                <div class="muted small">{{ $event['time_ago'] ?? '' }}</div>
                            </div>
                        </li>
                    @endforeach
                    @if (empty($recentEvents))
                        <li class="muted">No recent activity.</li>
                    @endif
                </ul>
            </div>
        </aside>
    </section>
    @endif
    <div class="athena-layout-spacer"></div>
</main>
@endsection

@push('scripts')
<script>
    $(document).ready(function() {
        // Any specific dashboard scripts
    });
</script>
@endpush

