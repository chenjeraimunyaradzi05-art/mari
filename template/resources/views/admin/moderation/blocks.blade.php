@extends('admin.layouts.master')

@section('contents')
<div class="container-fluid">
    <div class="page-header d-flex justify-content-between align-items-center">
        <div>
            <h3 class="page-title mb-0">Blocks & Suspensions</h3>
            <p class="text-muted mb-0">Audit who is blocked and why.</p>
        </div>
        <button type="button"  href="{{ route('admin.moderation.dashboard') }}" class="btn btn-outline-secondary">Back to dashboard</button>
    </div>

    <div class="card">
        <div class="card-body">
            <div class="table-responsive">
                <table class="table align-middle">
                    <thead>
                        <tr>
                            <th>Blocker</th>
                            <th>Blocked</th>
                            <th>Status</th>
                            <th>Reason</th>
                            <th>Source</th>
                            <th>Expires</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($blocks as $block)
                            <tr>
                                <td>{{ optional($block->blocker)->display_name ?? 'n/a' }}</td>
                                <td>{{ optional($block->blocked)->display_name ?? 'n/a' }}</td>
                                <td><span class="badge bg-light text-dark">{{ ucfirst($block->status) }}</span></td>
                                <td>{{ $block->reason ?? '—' }}</td>
                                <td>{{ ucfirst($block->source) }}</td>
                                <td>{{ $block->expires_at ? $block->expires_at->toDayDateTimeString() : '—' }}</td>
                                <td class="text-end">
                                    @if($block->enforcementAction)
                                        <span class="badge bg-primary">Action #{{ $block->enforcementAction->id }}</span>
                                    @endif
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="7" class="text-center text-muted">No blocks recorded.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>

            <div class="d-flex justify-content-end">
                {{ $blocks->links() }}
            </div>
        </div>
    </div>
</div>
@endsection

