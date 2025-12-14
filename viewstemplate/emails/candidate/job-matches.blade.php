@extends('emails.layout')

@section('content')
    <h2>🎯 New Jobs Matching Your Profile!</h2>

    <p>Hi {{ $candidateName }},</p>

    <p>We've found <strong>{{ count($matchedJobs) }} new job{{ count($matchedJobs) > 1 ? 's' : '' }}</strong> that match your skills and preferences!</p>

    @foreach($matchedJobs as $job)
        <div class="info-box">
            <h3 style="margin: 0 0 10px 0; color: #667eea;">{{ $job['title'] }}</h3>
            <p style="margin: 5px 0;"><strong>Company:</strong> {{ $job['company'] }}</p>
            <p style="margin: 5px 0;"><strong>Location:</strong> {{ $job['location'] }}</p>
            <p style="margin: 5px 0;"><strong>Salary:</strong> {{ $job['salary'] }}</p>
            <p style="margin: 5px 0;"><strong>Match Score:</strong> <span style="color: #28a745; font-weight: bold;">{{ $job['match_score'] }}%</span></p>
            <p style="margin: 10px 0 0 0;">{{ $job['description'] }}</p>
            <a href="{{ $job['url'] }}" style="display: inline-block; margin-top: 10px; color: #667eea; text-decoration: none; font-weight: 600;">
                View Job Details →
            </a>
        </div>
    @endforeach

    <center>
        <a href="{{ $jobsUrl }}" class="button">Browse All Jobs</a>
    </center>

    <p style="background: #d4edda; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745; margin-top: 30px;">
        <strong>💡 Quick Apply Tip:</strong> Jobs receive the most applications within the first 48 hours of posting. Apply early to increase your chances!
    </p>

    <p>
        <strong>Email Preferences:</strong><br>
        You're receiving this email because you've opted in to job match notifications.
        You can update your notification preferences in your dashboard settings.
    </p>

    <p>Best regards,<br>The {{ config('app.name') }} Team</p>
@endsection
