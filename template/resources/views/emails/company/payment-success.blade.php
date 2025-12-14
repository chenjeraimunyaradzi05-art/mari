@extends('emails.layout')

@section('content')
    <h2>Payment Successful! ✓</h2>

    <p>Hi {{ $companyName }},</p>

    <p>Thank you for your payment! Your transaction has been processed successfully.</p>

    <div class="info-box">
        <p><strong>Order ID:</strong> #{{ $order->id }}</p>
        <p><strong>Plan:</strong> {{ $planName }}</p>
        <p><strong>Amount Paid:</strong> ${{ number_format($amount, 2) }}</p>
        <p><strong>Transaction ID:</strong> {{ $transactionId }}</p>
        <p><strong>Payment Date:</strong> {{ $paymentDate }}</p>
        <p><strong>Payment Method:</strong> {{ ucfirst($order->payment_provider) }}</p>
    </div>

    <p><strong>Your Plan Benefits:</strong></p>
    <ul>
        <li><strong>{{ $order->plan->job_limit }}</strong> Job Postings</li>
        <li><strong>{{ $order->plan->featured_job_limit }}</strong> Featured Jobs</li>
        <li><strong>{{ $order->plan->highlight_job_limit }}</strong> Highlighted Jobs</li>
        <li><strong>{{ $order->plan->candidate_cv_view_limit }}</strong> CV Views</li>
        <li>Validity: <strong>30 Days</strong></li>
    </ul>

    <center>
        <a href="{{ $invoiceUrl }}" class="button">Download Invoice</a>
    </center>

    <p style="background: #d1ecf1; padding: 15px; border-radius: 5px; border-left: 4px solid #0c5460; margin-top: 30px;">
        <strong>📄 Invoice:</strong> Your invoice has been generated and is available for download. Keep it for your records.
    </p>

    <p>
        Your plan is now active and you can start posting jobs immediately. If you have any questions about your purchase, please don't hesitate to contact our support team.
    </p>

    <p>
        <strong>Need Help?</strong><br>
        If you have any questions or need assistance, our support team is here to help.
    </p>

    <p>Thank you for choosing {{ config('app.name') }}!</p>

    <p>Best regards,<br>The {{ config('app.name') }} Team</p>
@endsection
