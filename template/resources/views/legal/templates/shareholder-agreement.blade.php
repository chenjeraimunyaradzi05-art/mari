<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Shareholder Agreement</title>
    <style>
        body { font-family: 'Inter', Arial, sans-serif; color: #0f172a; line-height: 1.6; }
        h1, h2 { color: #111827; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
        th, td { border: 1px solid #e5e7eb; padding: 0.6rem; text-align: left; }
        th { background: #f3f4f6; }
        .note { font-size: 0.8rem; color: #6b7280; }
    </style>
</head>
<body>
    <p class="note">{{ $disclaimer }}</p>
    <h1>Shareholder Agreement — {{ $payload['company_name'] ?? 'Company' }}</h1>

    <h2>1. Capitalisation</h2>
    <table>
        <thead>
            <tr>
                <th>Founders & investors</th>
                <th>Equity / vesting terms</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Founders</td>
                <td>{!! nl2br(e($payload['founder_equity'] ?? 'Detail equity split.')) !!}</td>
            </tr>
            <tr>
                <td>ESOP / option pool</td>
                <td>{{ $payload['esop_pool'] ?? 0 }}%</td>
            </tr>
        </tbody>
    </table>

    @if(!empty($payload['vesting_terms']))
        <h2>2. Vesting</h2>
        <p>{!! nl2br(e($payload['vesting_terms'])) !!}</p>
    @endif

    <h2>3. Governance triggers</h2>
    <p><strong>Information rights:</strong> {!! nl2br(e($payload['information_rights'] ?? 'Quarterly financial + KPI pack.')) !!}</p>
    @if(!empty($payload['drag_tag']))
        <p><strong>Drag/tag rights:</strong> {!! nl2br(e($payload['drag_tag'])) !!}</p>
    @endif
    @if(!empty($payload['exit_provisions']))
        <p><strong>Exit provisions:</strong> {!! nl2br(e($payload['exit_provisions'])) !!}</p>
    @endif

    @if($grant_pack)
        <h2>Grant orientation</h2>
        <p>{{ $grant_pack['summary'] }}</p>
        <ul>
            @foreach($grant_pack['includes'] as $item)
                <li>{{ $item }}</li>
            @endforeach
        </ul>
    @endif

    <p class="note">Generated {{ now()->toDayDateTimeString() }} via Athena Legal Document Lab.</p>
</body>
</html>
