@extends('admin.layouts.master')

@section('contents')
    <section class="section">
        <div class="section-header">
            <h1>Women Verification Dry Run</h1>
            <div class="section-header-breadcrumb">
                <div class="breadcrumb-item"><a href="{{ route('admin.dashboard') }}">Dashboard</a></div>
                <div class="breadcrumb-item">Women Verification</div>
                <div class="breadcrumb-item active">Dry Run</div>
            </div>
        </div>

        <div class="section-body">
            @if (session('dry_run_notice'))
                <div class="alert alert-warning">
                    {{ session('dry_run_notice') }}
                </div>
            @endif

            <div class="row">
                <div class="col-12 col-lg-6">
                    <div class="card">
                        <div class="card-header">
                            <h4>Trigger Workflow</h4>
                        </div>
                        <div class="card-body">
                            <form method="POST" action="{{ route('admin.women.verification.dry-run.store') }}">
                                @csrf
                                <div class="form-group">
                                    <label for="agent">Agent Identifier</label>
                                    <input type="text" id="agent" name="agent" class="form-control"
                                           value="{{ old('agent') }}" placeholder="Agent ID or email">
                                    <small class="form-text text-muted">Leave blank to use the most recently verified agent.</small>
                                    @error('agent')
                                        <span class="text-danger">{{ $message }}</span>
                                    @enderror
                                </div>
                                <div class="form-group">
                                    <label for="lead_days">Lead Days</label>
                                    <input type="number" id="lead_days" name="lead_days" class="form-control"
                                           value="{{ old('lead_days', 30) }}" min="0">
                                    <small class="form-text text-muted">How many days before expiry to schedule reverification.</small>
                                    @error('lead_days')
                                        <span class="text-danger">{{ $message }}</span>
                                    @enderror
                                </div>
                                <div class="form-group">
                                    <label for="fraud_score">Fraud Score Override</label>
                                    <input type="number" step="0.01" id="fraud_score" name="fraud_score" class="form-control"
                                           value="{{ old('fraud_score') }}" min="0" max="1">
                                    <small class="form-text text-muted">Optional override between 0 and 1. Leave empty for random value.</small>
                                    @error('fraud_score')
                                        <span class="text-danger">{{ $message }}</span>
                                    @enderror
                                </div>
                                <div class="form-group">
                                    <label for="regulator_status">Regulator Status Override</label>
                                    <select id="regulator_status" name="regulator_status" class="form-control">
                                        <option value="">Random</option>
                                        @foreach ($regulatorStatuses as $status)
                                            <option value="{{ $status }}" @selected(old('regulator_status') === $status)>
                                                {{ \Illuminate\Support\Str::title(str_replace('_', ' ', $status)) }}
                                            </option>
                                        @endforeach
                                    </select>
                                    @error('regulator_status')
                                        <span class="text-danger">{{ $message }}</span>
                                    @enderror
                                </div>
                                <button class="btn btn-primary">Run Dry Workflow</button>
                            </form>
                        </div>
                    </div>
                </div>
                <div class="col-12 col-lg-6">
                    <div class="card">
                        <div class="card-header">
                            <h4>Recent Women Verified Agents</h4>
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive">
                                <table class="table table-striped mb-0">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Stage</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @forelse ($recentAgents as $agent)
                                            <tr>
                                                <td>#{{ $agent->id }}</td>
                                                <td>{{ $agent->user?->name ?? '—' }}</td>
                                                <td>{{ $agent->user?->email ?? '—' }}</td>
                                                <td>{{ $agent->verification_stage?->value ?? '—' }}</td>
                                            </tr>
                                        @empty
                                            <tr>
                                                <td colspan="4" class="text-center py-4">No women verified agents found.</td>
                                            </tr>
                                        @endforelse
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            @if ($lastResult)
                <div class="row mt-4">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-header">
                                <h4>Latest Dry Run Output</h4>
                            </div>
                            <div class="card-body">
                                @if ($lastAgent)
                                    <p><strong>Agent:</strong> #{{ $lastAgent['id'] }} &mdash; {{ $lastAgent['email'] ?? 'Unknown email' }}</p>
                                @endif
                                <div class="row">
                                    <div class="col-md-4">
                                        <h6>Workflow</h6>
                                        <ul class="list-unstyled mb-0">
                                            <li>Stage: {{ $lastResult['stage'] ?? 'n/a' }}</li>
                                            <li>Risk Flags: {{ empty($lastResult['risk_flags']) ? 'None' : implode(', ', $lastResult['risk_flags']) }}</li>
                                            <li>Reminders Logged: {{ $lastResult['reminders_count'] ?? 0 }}</li>
                                            <li>Reverify After: {{ $lastResult['reverify_after'] ?? 'Not set' }}</li>
                                        </ul>
                                    </div>
                                    <div class="col-md-4">
                                        <h6>Signals</h6>
                                        <ul class="list-unstyled mb-0">
                                            <li>Fraud Score: {{ number_format($lastResult['signals']['fraud_score'] ?? 0, 2) }}</li>
                                            <li>Regulator Status: {{ $lastResult['signals']['regulator']['status'] ?? 'unknown' }}</li>
                                        </ul>
                                    </div>
                                    <div class="col-md-4">
                                        <h6>Parameters</h6>
                                        <ul class="list-unstyled mb-0">
                                            <li>Lead Days: {{ $lastResult['lead_days'] ?? 30 }}</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            @endif
        </div>
    </section>
@endsection
