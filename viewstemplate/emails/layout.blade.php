<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $subject ?? 'Email Notification' }}</title>
    
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{ config('app.name') }}</h1>
        </div>
        <div class="content">
            @yield('content')
        </div>
        <div class="footer">
            <p>&copy; {{ date('Y') }} {{ config('app.name') }}. All rights reserved.</p>
            <p>
                <a href="{{ url('/') }}">Visit Website</a> |
                <a href="{{ url('/contact') }}">Contact Us</a> |
                <a href="{{ url('/privacy-policy') }}">Privacy Policy</a>
            </p>
            <p style="margin-top: 15px;">
                This email was sent to you because you have an account with {{ config('app.name') }}.<br>
                If you did not request this email, please ignore it.
            </p>
        </div>
    </div>
</body>
</html>

