@extends('emails.layout')

@section('content')
    <h2>New User Registration 👤</h2>

    <p>Hello Admin,</p>

    <p>A new user has registered on {{ config('app.name') }}.</p>

    <div class="info-box">
        <p><strong>Name:</strong> {{ $userName }}</p>
        <p><strong>Email:</strong> {{ $userEmail }}</p>
        <p><strong>Role:</strong> <span style="color: #667eea; font-weight: bold;">{{ ucfirst($userRole) }}</span></p>
        <p><strong>Registration Date:</strong> {{ $registrationDate }}</p>
    </div>

    <p><strong>Action Required:</strong></p>
    <ul>
        <li>Review the user's profile</li>
        <li>Verify account details if necessary</li>
        <li>Monitor for any suspicious activity</li>
        @if($userRole === 'company')
            <li>Check company information for accuracy</li>
        @endif
    </ul>

    <center>
        <a href="{{ $userDetailsUrl }}" class="button">View User Details</a>
    </center>

    <p style="margin-top: 30px;">
        <strong>Platform Statistics:</strong><br>
        Check your admin dashboard for updated user statistics and platform metrics.
    </p>

    <p>Best regards,<br>{{ config('app.name') }} System</p>
@endsection
