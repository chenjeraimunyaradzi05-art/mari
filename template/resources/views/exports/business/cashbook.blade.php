<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Athena Sole-Trader Finance Export</title>
    <style>
        @page {
            margin: 32px 38px;
        }

        body {
            font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 12px;
            color: #0f172a;
        }

        .heading {
            font-size: 22px;
            font-weight: 600;
            margin-bottom: 6px;
        }

        .sub-heading {
            font-size: 12px;
            color: #475569;
        }

        .cards {
            display: flex;
            gap: 12px;
            margin: 24px 0;
        }

        .card {
            flex: 1;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 14px;
            background: #f8fafc;
        }

        .card-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            color: #64748b;
        }

        .card-value {
            font-size: 18px;
            font-weight: 600;
            margin-top: 8px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 18px;
        }

        th {
            text-align: left;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            color: #475569;
            border-bottom: 1px solid #e2e8f0;
            padding: 10px 6px;
        }

        td {
            font-size: 11px;
            padding: 8px 6px;
            border-bottom: 1px solid #f1f5f9;
        }

        .text-right {
            text-align: right;
        }

        .muted {
            color: #94a3b8;
        }

        .footer {
            margin-top: 24px;
            font-size: 10px;
            color: #94a3b8;
        }
    </style>
</head>
<body>
    <div>
        <p class="heading">{{ $cashbook->name }} · Sole-Trader Finance Export</p>
        <p class="sub-heading">
            Generated {{ $generatedAt->format('d M Y H:i') }} · Range
            {{ $filters['from'] ?? 'start of month' }} — {{ $filters['to'] ?? 'today' }} · Currency {{ $cashbook->currency }}
        </p>
    </div>

    <div class="cards">
        <div class="card">
            <p class="card-label">Income</p>
            <p class="card-value">{{ number_format($summary['totals']['income'] ?? 0, 2) }} {{ $cashbook->currency }}</p>
            <p class="muted">Recorded within the selected window.</p>
        </div>
        <div class="card">
            <p class="card-label">Expenses</p>
            <p class="card-value">{{ number_format($summary['totals']['expenses'] ?? 0, 2) }} {{ $cashbook->currency }}</p>
            <p class="muted">Includes tax-deductible and general expenses.</p>
        </div>
        <div class="card">
            <p class="card-label">Net position</p>
            <p class="card-value">{{ number_format($summary['totals']['net'] ?? 0, 2) }} {{ $cashbook->currency }}</p>
            <p class="muted">Income minus expenses.</p>
        </div>
        <div class="card">
            <p class="card-label">Runway (weeks)</p>
            <p class="card-value">{{ number_format($summary['totals']['runway_weeks'] ?? 0, 1) }}</p>
            <p class="muted">Approximate cash runway.</p>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Description</th>
                <th class="text-right">Amount</th>
                <th>Tax</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($entries as $entry)
                <tr>
                    <td>#{{ $entry->id }}</td>
                    <td>{{ optional($entry->date)->format('d M Y') }}</td>
                    <td>{{ strtoupper($entry->entry_type) }}</td>
                    <td>{{ $entry->category ?? '—' }}</td>
                    <td>{{ $entry->description ?? '—' }}</td>
                    <td class="text-right">{{ number_format((float) $entry->amount, 2) }} {{ $cashbook->currency }}</td>
                    <td>{{ $entry->is_tax_deductible ? 'Yes' : 'No' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="footer">
        Athena Sole-Trader Finance Workspace · {{ config('app.url') }}
    </div>
</body>
</html>
