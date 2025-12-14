<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Job Alert</title>
    
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>🎯 New Job Match!</h1>
            <div class="match-badge">{{ $matchScore }}% Match</div>
        </div>

        <!-- Content -->
        <div class="content">
            <div class="greeting">
                Hi {{ $candidate->user->name }},
            </div>

            <p>Great news! We found a new job that matches your alert <strong>"{{ $alert->name ?? 'Job Alert' }}"</strong>:</p>

            <!-- Job Card -->
            <div class="job-card">
                <h2 class="job-title">{{ $job->title }}</h2>
                <p class="company-name">{{ $job->company->name }}</p>

                <div class="job-details">
                    <div class="detail-item">
                        <i>📍</i>
                        <span>{{ $job->country }}</span>
                    </div>
                    <div class="detail-item">
                        <i>💼</i>
                        <span>{{ $job->jobType->name ?? 'N/A' }}</span>
                    </div>
                    <div class="detail-item">
                        <i>💰</i>
                        <span>${{ number_format($job->min_salary) }} - ${{ number_format($job->max_salary) }}</span>
                    </div>
                    <div class="detail-item">
                        <i>🎓</i>
                        <span>{{ $job->jobExperience->name ?? 'N/A' }}</span>
                    </div>
                </div>

                <div class="job-description">
                    {{ Str::limit(strip_tags($job->description), 200) }}
                </div>

                <center>
                    <a href="{{ route('jobs.show', $job->slug) }}?alert={{ $alert->id }}" class="cta-button">
                        View Full Details & Apply
                    </a>
                </center>
            </div>

            <!-- Match Reasons -->
            @if($matchScore >= 80)
            <div class="match-reasons">
                <h3>Why this is a great match:</h3>
                <ul>
                    <li>✓ Job category matches your preferences</li>
                    <li>✓ Salary range aligns with your expectations</li>
                    <li>✓ Experience level is appropriate</li>
                    <li>✓ Located in your preferred area</li>
                </ul>
            </div>
            @endif

            <p style="margin-top: 20px; font-size: 14px; color: #666;">
                <strong>Deadline:</strong> {{ $job->deadline->format('M d, Y') }}
                <br>
                <strong>Vacancies:</strong> {{ $job->vacancies }} position(s)
            </p>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>
                This job alert was sent because you subscribed to
                <strong>{{ $alert->name ?? 'Job Alerts' }}</strong>
            </p>
            <p>
                <a href="{{ route('member.dashboard') }}">View Dashboard</a> |
                <a href="{{ route('member.job-alerts.index') }}">Manage Alerts</a>
            </p>
            <p class="unsubscribe">
                Want fewer emails?
                <a href="{{ route('member.job-alerts.edit', $alert->id) }}">Adjust alert frequency</a>
                or
                <a href="{{ route('member.job-alerts.unsubscribe', $alert->id) }}">Unsubscribe</a>
            </p>
            <p style="margin-top: 15px;">
                © {{ date('Y') }} JobPilot. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>

