<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Budget summary</title>
    <style>
        body { font-family: 'Inter', Arial, sans-serif; color: #1f2937; margin: 0; padding: 32px; }
        h1, h2, h3 { margin: 0 0 8px; }
        .text-muted { color: #6b7280; }
        .grid { display: flex; gap: 16px; margin-bottom: 24px; }
        .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; flex: 1; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 8px 4px; text-align: left; }
        th { font-size: 0.85rem; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; }
        .totals { display: flex; gap: 16px; }
        .totals .card { flex: 1; text-align: center; }
    </style>
</head>
<body>
    <header style="margin-bottom: 32px;">
        <p class="text-muted" style="text-transform: uppercase; letter-spacing: .2em; font-size: .8rem;">Athena Money</p>
        <h1>Budget snapshot &mdash; {{ ucfirst($scope ?? 'personal') }}</h1>
        <p class="text-muted">Generated {{ optional($generatedAt)->format('M d, Y H:i') ?? now()->format('M d, Y H:i') }}</p>
        <p class="text-muted" style="margin-top: 8px;">Prepared for {{ $user?->name ?? 'Athena member' }} ({{ $user?->email ?? 'n/a' }})</p>
    </header>

    <section class="totals" style="margin-bottom: 32px;">
        <div class="card">
            <p class="text-muted">Monthly income</p>
            <h2>${{ number_format(data_get($snapshot, 'totals.income', 0), 2) }}</h2>
        </div>
        <div class="card">
            <p class="text-muted">Monthly expenses</p>
            <h2>${{ number_format(data_get($snapshot, 'totals.expense', 0), 2) }}</h2>
        </div>
        <div class="card">
            <p class="text-muted">Net position</p>
            @php $net = data_get($snapshot, 'totals.net', 0); @endphp
            <h2 style="color: {{ $net >= 0 ? '#059669' : '#dc2626' }};">${{ number_format($net, 2) }}</h2>
        </div>
        <div class="card">
            <p class="text-muted">Debt balance</p>
            <h2>${{ number_format(data_get($snapshot, 'totals.debt_balance', 0), 2) }}</h2>
        </div>
    </section>

    <section style="margin-bottom: 32px;">
        <h2>Budget items</h2>
        <table>
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Frequency</th>
                    <th class="text-end">Amount</th>
                </tr>
            </thead>
            <tbody>
                @forelse($snapshot['items'] ?? [] as $item)
                    <tr>
                        <td>{{ ucfirst($item->type ?? 'expense') }}</td>
                        <td>{{ $item->category ?? '—' }}</td>
                        <td>{{ $item->description ?? '—' }}</td>
                        <td>{{ ucfirst($item->frequency ?? 'monthly') }}</td>
                        <td style="text-align: right;">${{ number_format($item->amount ?? 0, 2) }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="5" class="text-muted">No budget lines captured for this scope.</td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </section>

    <section>
        <h2>Debt schedule</h2>
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Balance</th>
                    <th>Interest rate</th>
                    <th>Min payment</th>
                </tr>
            </thead>
            <tbody>
                @forelse($snapshot['debts'] ?? [] as $debt)
                    <tr>
                        <td>{{ $debt->name ?? 'Obligation' }}</td>
                        <td>${{ number_format($debt->balance ?? 0, 2) }}</td>
                        <td>{{ $debt->interest_rate ? number_format($debt->interest_rate, 2).'%' : '—' }}</td>
                        <td>${{ number_format($debt->min_payment ?? 0, 2) }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="4" class="text-muted">No debt records were found for this export.</td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </section>
</body>
</html>
