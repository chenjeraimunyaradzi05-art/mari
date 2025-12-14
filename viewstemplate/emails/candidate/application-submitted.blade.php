@extends('emails.layout')

@section('content')
    <h2>Application Submitted Successfully! ✓</h2>

    <p>Hi {{ $candidateName }},</p>

    <p>Great news! Your application has been successfully submitted.</p>

    <div class="info-box">
        <p><strong>Job Title:</strong> {{ $jobTitle }}</p>
        <p><strong>Company:</strong> {{ $companyName }}</p>
        <p><strong>Application Date:</strong> {{ $applicationDate }}</p>
        <p><strong>Status:</strong> Under Review</p>
    </div>

    <p><strong>What happens next?</strong></p>
    <ol>
        <li>The hiring team will review your application</li>
        <li>You'll receive an email if you're shortlisted</li>
        <li>Track your application status in your dashboard</li>
    </ol>

    <p style="background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
        <strong>💡 Tip:</strong> While you wait, continue applying to other matching jobs to increase your chances!
    </p>

    <center>
        <a href="{{ $applicationUrl }}" class="button">View Application Status</a>
    </center>

    <p style="margin-top: 30px;">
        <strong>Application Tips:</strong>
    </p>
    <ul>
        <li>Ensure your profile is up-to-date</li>
        <li>Keep your phone accessible for recruiter calls</li>
        <li>Check your email regularly for updates</li>
        <li>Prepare for potential interviews</li>
    </ul>

    <p>Best of luck with your application!</p>

    <p>Best regards,<br>The {{ config('app.name') }} Team</p>
@endsection
