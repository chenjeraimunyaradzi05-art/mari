<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Company Constitution</title>
    <style>
        body { font-family: 'Inter', Arial, sans-serif; line-height: 1.5; color: #0f172a; }
        h1, h2, h3 { color: #111827; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #fce7f3; color: #be185d; font-size: 0.75rem; text-transform: uppercase; letter-spacing: .2em; }
        .section { margin-bottom: 1.8rem; }
        .disclaimer { font-size: 0.75rem; color: #92400e; background: #fef3c7; padding: 1rem; border-radius: 0.5rem; border: 1px solid #fde68a; }
        ul { padding-left: 1.2rem; }
        li { margin-bottom: 0.35rem; }
    </style>
</head>
<body>
    <div class="disclaimer">
        <strong>Informational only:</strong> {{ $disclaimer }}
    </div>

    <h1>{{ $payload['company_name'] ?? 'Company' }} — Constitution</h1>
    <p><span class="badge">Jurisdiction</span> {{ $payload['jurisdiction'] ?? 'Australia' }}</p>
    <p><strong>ABN / ACN:</strong> {{ $payload['abn'] ?? 'TBC' }}</p>
    <p><strong>Registered office:</strong> {{ $payload['registered_office'] ?? 'Not supplied' }}</p>

    @if(!empty($payload['mission_statement']))
        <div class="section">
            <h2>1. Purpose</h2>
            <p>{{ $payload['mission_statement'] }}</p>
        </div>
    @endif

    <div class="section">
        <h2>2. Governance</h2>
        <ul>
            <li>Minimum directors: {{ $payload['directors_required'] ?? '2' }}</li>
            <li>Quorum: {{ $payload['quorum'] ?? '66' }}%</li>
            <li>Special resolution threshold: {{ $payload['voting_threshold'] ?? '75%' }}</li>
            <li>Meeting cadence: {{ $payload['meeting_frequency'] ?? 'Quarterly' }}</li>
        </ul>
    </div>

    <div class="section">
        <h2>3. Share Capital</h2>
        <p><strong>Share classes:</strong> {!! nl2br(e($payload['share_classes'] ?? 'Ordinary shares (voting)')) !!}</p>
        <p><strong>Pre-emptive rights:</strong> {{ $payload['preemptive_rights'] ?? 'Enabled (all classes)' }}</p>
        @if(!empty($payload['transfer_controls']))
            <p><strong>Transfer controls:</strong> {!! nl2br(e($payload['transfer_controls'])) !!}</p>
        @endif
    </div>

    <div class="section">
        <h2>4. Compliance notes</h2>
        <p>Meeting minutes should reference this constitution and any schedules adopted after {{ now()->toFormattedDateString() }}.</p>
        <p>Document generated via Athena Legal Document Lab for {{ optional($user)->name ?? 'member' }}.</p>
    </div>

    @if($grant_pack)
        <div class="section">
            <h2>Grant Pack Overlay</h2>
            <p><strong>{{ $grant_pack['name'] }}</strong> — {{ $grant_pack['summary'] }}</p>
            <ul>
                @foreach($grant_pack['includes'] as $item)
                    <li>{{ $item }}</li>
                @endforeach
            </ul>
            <p><em>{{ $grant_pack['value_proposition'] }}</em></p>
        </div>
    @endif
</body>
</html>
