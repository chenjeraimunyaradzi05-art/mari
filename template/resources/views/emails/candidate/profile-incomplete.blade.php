@extends('emails.layout')

@section('content')
    <h2>Complete Your Profile to Get More Opportunities! 📝</h2>

    <p>Hi {{ $candidateName }},</p>

    <p>We noticed your profile is <strong>{{ $completionPercentage }}% complete</strong>. Great start!</p>

    <p>However, members with complete profiles are <strong>3x more likely</strong> to get interview calls. Let's finish setting up your profile!</p>

    <div class="info-box" style="border-color: #ffc107; background: #fff3cd;">
        <p><strong>Profile Completion:</strong> {{ $completionPercentage }}%</p>
        <p><strong>Missing Information:</strong></p>
        <ul style="margin: 10px 0 0 20px;">
            @foreach($missingFields as $field)
                <li>{{ $field }}</li>
            @endforeach
        </ul>
    </div>

    <p><strong>Benefits of a Complete Profile:</strong></p>
    <ul>
        <li>✓ Higher visibility to employers</li>
        <li>✓ Better job matches</li>
        <li>✓ More interview opportunities</li>
        <li>✓ Stand out from other members</li>
        <li>✓ Professional appearance</li>
    </ul>

    <center>
        <a href="{{ $profileUrl }}" class="button">Complete Your Profile</a>
    </center>

    <p style="background: #d1ecf1; padding: 15px; border-radius: 5px; border-left: 4px solid #0c5460; margin-top: 30px;">
        <strong>⏱️ Quick Tip:</strong> It only takes 5-10 minutes to complete your profile. Do it now while you have time!
    </p>

    <p>
        <strong>What to Add:</strong>
    </p>
    <ol>
        <li>Upload a professional photo</li>
        <li>Add your work experience</li>
        <li>List your skills</li>
        <li>Include your education</li>
        <li>Upload your resume</li>
    </ol>

    <p>
        Every section you complete increases your chances of landing your dream job!
    </p>

    <p>Best regards,<br>The {{ config('app.name') }} Team</p>
@endsection
