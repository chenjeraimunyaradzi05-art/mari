@extends('emails.layout')

@section('content')
    <h2>Welcome to {{ config('app.name') }}, {{ $companyName }}! 🎉</h2>

    <p>Thank you for choosing our platform to find top talent! We're excited to help you build your dream team.</p>

    <p>Your company account is now active, and you can:</p>

    <div class="info-box">
        <p><strong>✓</strong> Post unlimited job openings</p>
        <p><strong>✓</strong> Access thousands of qualified members</p>
        <p><strong>✓</strong> Manage applications efficiently</p>
        <p><strong>✓</strong> Track hiring metrics</p>
        <p><strong>✓</strong> Build your employer brand</p>
    </div>

    <p><strong>Get Started:</strong></p>
    <ol>
        <li>Complete your company profile</li>
        <li>Add your company logo and description</li>
        <li>Post your first job opening</li>
        <li>Start receiving applications!</li>
    </ol>

    <center>
        <a href="{{ $dashboardUrl }}" class="button">Go to Dashboard</a>
        <a href="{{ $postJobUrl }}" class="button" style="background: #28a745;">Post Your First Job</a>
    </center>

    <p style="margin-top: 30px;">
        <strong>Pro Tip:</strong> Companies with complete profiles and detailed job descriptions receive 5x more qualified applications!
    </p>

    <p>
        Need help getting started? Our dedicated support team is here to assist you.
    </p>

    <p>Best regards,<br>The {{ config('app.name') }} Team</p>
@endsection
