@extends('emails.layout')

@section('content')
    <h2>Welcome to {{ config('app.name') }}, {{ $candidateName }}! 🎉</h2>

    <p>Thank you for joining our platform! We're excited to help you find your dream job.</p>

    <p>You've successfully created your member account, and now you can:</p>

    <div class="info-box">
        <p><strong>✓</strong> Browse thousands of job opportunities</p>
        <p><strong>✓</strong> Apply to jobs with one click</p>
        <p><strong>✓</strong> Get matched with jobs that fit your skills</p>
        <p><strong>✓</strong> Track your applications in real-time</p>
        <p><strong>✓</strong> Build a professional profile</p>
    </div>

    <p><strong>Next Steps:</strong></p>
    <ol>
        <li>Complete your profile to increase your visibility</li>
        <li>Upload your resume</li>
        <li>Add your skills and experience</li>
        <li>Start applying to jobs!</li>
    </ol>

    <center>
        <a href="{{ $profileUrl }}" class="button">Complete Your Profile</a>
        <a href="{{ $jobsUrl }}" class="button" style="background: #28a745;">Browse Jobs</a>
    </center>

    <p style="margin-top: 30px;">
        <strong>Pro Tip:</strong> Members with complete profiles get 3x more interview calls!
    </p>

    <p>
        If you have any questions, feel free to reach out to our support team.
    </p>

    <p>Best regards,<br>The {{ config('app.name') }} Team</p>
@endsection
