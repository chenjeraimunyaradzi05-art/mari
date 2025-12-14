@extends('emails.layout')

@section('content')
    <h2>New Application Received! 📨</h2>

    <p>Hi {{ $companyName }},</p>

    <p>Great news! You've received a new application for your job posting.</p>

    <div class="info-box">
        <p><strong>Member:</strong> {{ $candidateName }}</p>
        <p><strong>Title:</strong> {{ $candidateTitle }}</p>
        <p><strong>Job:</strong> {{ $jobTitle }}</p>
        <p><strong>Applied:</strong> {{ $applicationDate }}</p>
    </div>

    <p><strong>Next Steps:</strong></p>
    <ol>
        <li>Review the member's profile and resume</li>
        <li>Check their skills and experience</li>
        <li>Shortlist if they match your requirements</li>
        <li>Schedule an interview</li>
    </ol>

    <center>
        <a href="{{ $viewApplicationUrl }}" class="button">View Application</a>
    </center>

    <p style="background: #d1ecf1; padding: 15px; border-radius: 5px; border-left: 4px solid #0c5460; margin-top: 30px;">
        <strong>💼 Hiring Tip:</strong> Respond to applications within 24-48 hours to show professionalism and keep top members engaged!
    </p>

    <p>
        Review the application promptly to avoid losing great members to competitors.
    </p>

    <p>Best regards,<br>The {{ config('app.name') }} Team</p>
@endsection
