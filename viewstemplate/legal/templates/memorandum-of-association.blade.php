<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Memorandum of Association</title>
    <style>
        body { font-family: 'Inter', Arial, sans-serif; color: #0f172a; line-height: 1.5; }
        h1 { letter-spacing: .04em; }
        .section { margin-bottom: 1.5rem; }
        .disclaimer { font-size: 0.75rem; color: #b45309; background: #fffbeb; padding: 0.75rem 1rem; border-radius: 0.5rem; border: 1px solid #fcd34d; }
    </style>
</head>
<body>
    <div class="disclaimer">
        <strong>Note:</strong> {{ $disclaimer }}
    </div>
    <h1>Memorandum of Association — {{ $payload['company_name'] ?? 'Company' }}</h1>

    <div class="section">
        <h2>1. Primary object</h2>
        <p>{!! nl2br(e($payload['primary_object'] ?? 'State the main business object.')) !!}</p>
    </div>

    @if(!empty($payload['secondary_objects']))
        <div class="section">
            <h2>2. Secondary objects</h2>
            <p>{!! nl2br(e($payload['secondary_objects'])) !!}</p>
        </div>
    @endif

    <div class="section">
        <h2>3. Member liability</h2>
        <p>{{ $payload['member_liability'] ?? 'Limited by shares' }}</p>
        @if(!empty($payload['capital_commitment']))
            <p><strong>Capital commitment:</strong> {!! nl2br(e($payload['capital_commitment'])) !!}</p>
        @endif
    </div>

    @if($grant_pack)
        <div class="section">
            <h2>Grant-overlay statements</h2>
            <p>{{ $grant_pack['summary'] }}</p>
            <ul>
                @foreach($grant_pack['includes'] as $item)
                    <li>{{ $item }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <p>Generated on {{ now()->toFormattedDateString() }} for {{ optional($user)->name ?? 'member' }}.</p>
</body>
</html>
