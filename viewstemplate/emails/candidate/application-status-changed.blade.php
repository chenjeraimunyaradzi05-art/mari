@extends('emails.layout')

@section('content')
    @php
        $statusMessages = [
            'shortlisted' => [
                'title' => '🎉 Congratulations! You\'ve Been Shortlisted',
                'message' => 'Great news! The hiring team has reviewed your application and you\'ve been shortlisted for the next round.',
                'color' => '#28a745',
            ],
            'interview' => [
                'title' => '📅 Interview Scheduled',
                'message' => 'Excellent! The company would like to interview you. Check your application for interview details.',
                'color' => '#17a2b8',
            ],
            'hired' => [
                'title' => '🎊 Congratulations! You\'re Hired',
                'message' => 'Amazing news! You\'ve been selected for the position. The company will contact you with next steps.',
                'color' => '#ffc107',
            ],
            'rejected' => [
                'title' => 'Application Update',
                'message' => 'Thank you for your interest. Unfortunately, we\'ve decided to move forward with other members at this time.',
                'color' => '#dc3545',
            ],
        ];

        $statusInfo = $statusMessages[$newStatus] ?? [
            'title' => 'Application Status Updated',
            'message' => 'Your application status has been updated.',
            'color' => '#667eea',
        ];
    @endphp

    <h2>{{ $statusInfo['title'] }}</h2>

    <p>Hi {{ $candidateName }},</p>

    <p>{{ $statusInfo['message'] }}</p>

    <div class="info-box" style="border-color: {{ $statusInfo['color'] }};">
        <p><strong>Job Title:</strong> {{ $jobTitle }}</p>
        <p><strong>Company:</strong> {{ $companyName }}</p>
        <p><strong>Previous Status:</strong> {{ ucfirst($oldStatus) }}</p>
        <p><strong>Current Status:</strong> <span style="color: {{ $statusInfo['color'] }}; font-weight: bold;">{{ ucfirst($newStatus) }}</span></p>
    </div>

    @if($newStatus === 'shortlisted')
        <p><strong>What's Next?</strong></p>
        <ul>
            <li>Keep your phone accessible - the recruiter may call you</li>
            <li>Prepare for potential interviews</li>
            <li>Research the company thoroughly</li>
            <li>Update your availability</li>
        </ul>
    @elseif($newStatus === 'interview')
        <p><strong>Interview Preparation Tips:</strong></p>
        <ul>
            <li>Review the job description carefully</li>
            <li>Research the company and their products</li>
            <li>Prepare questions to ask the interviewer</li>
            <li>Test your internet connection (for video interviews)</li>
            <li>Dress professionally</li>
        </ul>
    @elseif($newStatus === 'hired')
        <p><strong>Congratulations on your new role!</strong></p>
        <p>The company's HR team will reach out to you with:</p>
        <ul>
            <li>Offer letter details</li>
            <li>Joining date and onboarding process</li>
            <li>Required documents</li>
            <li>Next steps</li>
        </ul>
    @elseif($newStatus === 'rejected')
        <p><strong>Don't lose hope!</strong></p>
        <p>Every "no" brings you closer to a "yes". Here's what you can do:</p>
        <ul>
            <li>Apply to similar positions</li>
            <li>Improve your resume based on feedback</li>
            <li>Enhance your skills</li>
            <li>Keep networking</li>
        </ul>
        <p>Remember: The right opportunity is waiting for you!</p>
    @endif

    <center>
        <a href="{{ $applicationUrl }}" class="button" style="background: {{ $statusInfo['color'] }};">View Application Details</a>
    </center>

    <p style="margin-top: 30px;">
        Good luck with your job search!
    </p>

    <p>Best regards,<br>The {{ config('app.name') }} Team</p>
@endsection
