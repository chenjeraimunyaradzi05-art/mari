<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Articles of Association</title>
    <style>
        body { font-family: 'Inter', Arial, sans-serif; color: #0f172a; line-height: 1.6; }
        h1, h2 { color: #1f2937; }
        .section { margin-bottom: 1.4rem; }
        .panel { border: 1px solid #c7d2fe; background: #eef2ff; padding: 1rem; border-radius: 0.75rem; }
    </style>
</head>
<body>
    <div class="panel">
        <strong>Reminder:</strong> {{ $disclaimer }}
    </div>

    <h1>Articles of Association — {{ $payload['company_name'] ?? 'Company' }}</h1>

    <div class="section">
        <h2>1. Board Governance</h2>
        <p><strong>Appointment process:</strong> {!! nl2br(e($payload['appointment_process'] ?? 'Board appoints directors by majority vote.')) !!}</p>
        <p><strong>Removal process:</strong> {!! nl2br(e($payload['removal_process'] ?? 'Members may remove directors by ordinary resolution.')) !!}</p>
        @if(!empty($payload['director_fees']))
            <p><strong>Director fees:</strong> {!! nl2br(e($payload['director_fees'])) !!}</p>
        @endif
    </div>

    <div class="section">
        <h2>2. Member Rights</h2>
        <p><strong>Notice period:</strong> {{ $payload['notice_period'] ?? 21 }} days.</p>
        @if(!empty($payload['dividend_policy']))
            <p><strong>Dividend policy:</strong> {!! nl2br(e($payload['dividend_policy'])) !!}</p>
        @endif
        @if(!empty($payload['dispute_resolution']))
            <p><strong>Dispute resolution:</strong> {!! nl2br(e($payload['dispute_resolution'])) !!}</p>
        @endif
    </div>

    @if($grant_pack)
        <div class="section">
            <h2>Grant-aligned narrative</h2>
            <p>{{ $grant_pack['value_proposition'] }}</p>
            <ul>
                @foreach($grant_pack['includes'] as $item)
                    <li>{{ $item }}</li>
                @endforeach
            </ul>
        </div>
    @endif
</body>
</html>
