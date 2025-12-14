@extends('emails.layout')

@section('content')
    <h2>⚠️ Your Subscription is Expiring Soon</h2>

    <p>Hi {{ $companyName }},</p>

    <p>This is a friendly reminder that your <strong>{{ $planName }}</strong> subscription will expire in <strong>{{ $daysRemaining }} day{{ $daysRemaining > 1 ? 's' : '' }}</strong>.</p>

    <div class="info-box" style="border-color: #ffc107; background: #fff3cd;">
        <p><strong>Current Plan:</strong> {{ $planName }}</p>
        <p><strong>Expiry Date:</strong> {{ $expiryDate }}</p>
        <p><strong>Days Remaining:</strong> <span style="color: #856404; font-weight: bold;">{{ $daysRemaining }}</span></p>
    </div>

    <p><strong>What happens when your plan expires?</strong></p>
    <ul>
        <li>Your job postings will be deactivated</li>
        <li>You won't receive new applications</li>
        <li>Access to candidate profiles will be limited</li>
        <li>Your company profile will be hidden</li>
    </ul>

    <p style="background: #d4edda; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745;">
        <strong>💡 Renew Now:</strong> Keep your hiring momentum going! Renew your subscription to continue receiving applications from top talent.
    </p>

    <center>
        <a href="{{ $renewUrl }}" class="button" style="background: #ffc107; color: #000;">Renew Subscription</a>
    </center>

    <p style="margin-top: 30px;">
        <strong>Questions about renewal?</strong><br>
        Our team is happy to help you choose the best plan for your hiring needs.
    </p>

    <p>Best regards,<br>The {{ config('app.name') }} Team</p>
@endsection
