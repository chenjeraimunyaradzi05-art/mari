<div class="queue-table" wire:key="women-verification-queue">
    @if ($flashMessage)
        <div class="alert alert-{{ $flashType ?? 'info' }} alert-dismissible fade show" role="alert">
            {{ $flashMessage }}
            <button type="button" class="close" aria-label="Close" wire:click="dismissFlash">
                <span aria-hidden="true">&times;</span>
            </button>
        </div>
    @endif

    <div class="card">
        <div class="card-header d-flex flex-column flex-md-row align-items-md-center justify-content-between">
            <div class="d-flex flex-column flex-md-row align-items-md-center mb-3 mb-md-0" style="gap: 0.75rem;">
                <h4 class="mb-0">Verification Queue</h4>
                <a href="{{ route('admin.women.verification.audits.export') }}" class="btn btn-outline-secondary btn-sm">
                    Export Audit Trail
                </a>
            </div>
            <div class="card-header-form w-100 w-md-auto">
                <div class="form-row">
                    <div class="form-group col-md-3">
                        <label class="sr-only" for="statusFilter">Status</label>
                        <select id="statusFilter" class="form-control" wire:model="statusFilter">
                            @foreach ($this->statusOptions as $statusValue => $label)
                                <option value="{{ $statusValue }}">{{ $label }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div class="form-group col-md-3">
                        <label class="sr-only" for="stageFilter">Stage</label>
                        <select id="stageFilter" class="form-control" wire:model="stageFilter">
                            <option value="">All stages</option>
                            @foreach ($stages as $stage)
                                <option value="{{ $stage->value }}">{{ \Illuminate\Support\Str::headline($stage->value) }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div class="form-group col-md-6">
                        <label class="sr-only" for="queueSearch">Search</label>
                        <div class="input-group">
                            <input id="queueSearch" type="search" class="form-control" placeholder="Search name, email, license, regulator" wire:model.debounce.500ms="search">
                            <div class="input-group-append">
                                <button class="btn btn-outline-secondary" type="button" wire:click="resetFilters">Reset</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-striped mb-0">
                    <thead>
                        <tr>
                            <th style="width: 60px;">ID</th>
                            <th>Agent</th>
                            <th>Status</th>
                            <th>Stage</th>
                            <th>License</th>
                            <th>Updated</th>
                            <th style="width: 120px;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($agents as $agent)
                            <tr wire:key="agent-row-{{ $agent->id }}">
                                <td>#{{ $agent->id }}</td>
                                <td>
                                    <strong>{{ $agent->user?->name ?? '—' }}</strong>
                                    <br>
                                    <span class="text-muted small">{{ $agent->user?->email ?? 'No email on file' }}</span>
                                </td>
                                <td>
                                    <span class="badge badge-pill badge-{{ $agent->status === 'verified' ? 'success' : ($agent->status === 'rejected' ? 'danger' : 'warning') }}">
                                        {{ \Illuminate\Support\Str::headline($agent->status) }}
                                    </span>
                                </td>
                                <td>
                                    {{ \Illuminate\Support\Str::headline($agent->verification_stage instanceof \App\Enums\WomenRealEstate\VerificationStage ? $agent->verification_stage->value : $agent->verification_stage) }}
                                </td>
                                <td>
                                    <span class="d-block">{{ $agent->license_number }}</span>
                                    <small class="text-muted">{{ $agent->regulator ?? 'Regulator n/a' }}</small>
                                </td>
                                <td>
                                    <span class="d-block">{{ optional($agent->updated_at)->format('M d, Y') ?? '—' }}</span>
                                    <small class="text-muted">{{ optional($agent->last_reviewed_at)->diffForHumans() ?? 'Awaiting review' }}</small>
                                </td>
                                <td>
                                    <button type="button" class="btn btn-sm btn-outline-primary" wire:click="selectAgent({{ $agent->id }})" wire:loading.attr="disabled">
                                        Review
                                    </button>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="7" class="text-center py-4">No verification records match the current filters.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
        <div class="card-footer text-right">
            @if ($agents->hasPages())
                {{ $agents->links() }}
            @endif
        </div>
    </div>

    @if ($selectedAgent)
        <div class="card mt-4" wire:key="review-card-{{ $selectedAgent->id }}">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h4>Review: {{ $selectedAgent->user?->name ?? 'Agent #'.$selectedAgent->id }}</h4>
                <button type="button" class="btn btn-sm btn-outline-secondary" wire:click="clearSelection">Close</button>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-4 mb-3">
                        <h6 class="text-uppercase text-muted">Agent</h6>
                        <p class="mb-1"><strong>{{ $selectedAgent->user?->name ?? '—' }}</strong></p>
                        <p class="text-muted mb-1">{{ $selectedAgent->user?->email ?? 'No email on file' }}</p>
                        <p class="text-muted mb-0">Phone: {{ $selectedAgent->verification_payload['application']['profile']['phone'] ?? 'Not provided' }}</p>
                    </div>
                    <div class="col-md-4 mb-3">
                        <h6 class="text-uppercase text-muted">License</h6>
                        <p class="mb-1">{{ $selectedAgent->license_number }}</p>
                        <p class="text-muted mb-1">{{ $selectedAgent->regulator ?? 'Regulator n/a' }}</p>
                        <p class="text-muted mb-0">Expires: {{ optional($selectedAgent->license_expires_at)->format('M d, Y') ?? 'Not provided' }}</p>
                    </div>
                    <div class="col-md-4 mb-3">
                        <h6 class="text-uppercase text-muted">Status</h6>
                        <p class="mb-1">{{ \Illuminate\Support\Str::headline($selectedAgent->status) }}</p>
                        <p class="text-muted mb-1">
                            Stage:
                            {{ \Illuminate\Support\Str::headline($selectedAgent->verification_stage instanceof \App\Enums\WomenRealEstate\VerificationStage ? $selectedAgent->verification_stage->value : $selectedAgent->verification_stage) }}
                        </p>
                        <p class="text-muted mb-1">Trust badge: {{ $selectedAgent->trust_badge_level ?? 0 }}</p>
                        @php
                            $latestCompliance = collect(data_get($selectedAgent->verification_payload, 'compliance_escalations', []))->last();
                            $latestComplianceAt = $latestCompliance['escalated_at'] ?? null;
                            $latestComplianceDate = $latestComplianceAt ? \Carbon\CarbonImmutable::make($latestComplianceAt)?->timezone('Australia/Sydney') : null;
                        @endphp
                        @if ($latestComplianceDate)
                            <p class="text-muted mb-1">
                                Compliance hold since {{ $latestComplianceDate->isoFormat('MMM D, YYYY') }}
                                <span class="d-block">{{ $latestComplianceDate->diffForHumans() }}</span>
                            </p>
                        @endif
                        @php
                            $reverifyAfter = data_get($selectedAgent->verification_payload, 'reverify_after');
                            $reverifyDate = $reverifyAfter ? \Carbon\CarbonImmutable::make($reverifyAfter)?->timezone('Australia/Sydney') : null;
                        @endphp
                        @if ($reverifyDate)
                            <p class="text-muted mb-0">
                                Next reverification: {{ $reverifyDate->isoFormat('MMM D, YYYY') }}
                                <span class="d-block">{{ $reverifyDate->diffForHumans() }}</span>
                            </p>
                        @else
                            <p class="text-muted mb-0">Next reverification: Not scheduled</p>
                        @endif
                    </div>
                </div>

                <div class="row mt-3">
                    <div class="col-md-6">
                        <h6 class="text-uppercase text-muted">Risk Flags</h6>
                        @if (! empty($assessment['risk_flags']))
                            <ul class="mb-0">
                                @foreach ($assessment['risk_flags'] as $flag)
                                    <li>{{ \Illuminate\Support\Str::headline(str_replace('_', ' ', $flag)) }}</li>
                                @endforeach
                            </ul>
                        @else
                            <p class="text-muted mb-0">No risk flags detected.</p>
                        @endif
                    </div>
                    <div class="col-md-6">
                        <h6 class="text-uppercase text-muted">Next Stage</h6>
                        @php
                            $recommendedStage = $assessment['recommended_stage'] ?? null;
                            if ($recommendedStage instanceof \App\Enums\WomenRealEstate\VerificationStage) {
                                $recommendedStage = $recommendedStage->value;
                            }
                        @endphp
                        <p class="mb-1">Recommended: {{ $recommendedStage ? \Illuminate\Support\Str::headline($recommendedStage) : 'n/a' }}</p>
                        <p class="text-muted mb-0">Trust delta: {{ $assessment['trust_delta'] ?? '0' }}</p>
                    </div>
                </div>

                @if (! empty($assessment['ai_summary']))
                    @php
                        $aiSummary = $assessment['ai_summary'];
                        $fraudScore = data_get($assessment, 'fraud.score');
                        $regulatorStatus = data_get($assessment, 'regulator.status');
                        $priorityFlags = data_get($aiSummary, 'priority_flags', []);
                        $recommendations = data_get($aiSummary, 'recommendations', []);
                    @endphp
                    <div class="row mt-4">
                        <div class="col-md-12">
                            <h6 class="text-uppercase text-muted mb-2">Automated Screening Summary</h6>
                            <p class="mb-3">{{ $aiSummary['overview'] ?? 'Automated summary unavailable.' }}</p>

                            @if (! empty($priorityFlags))
                                <div class="mb-3">
                                    @foreach ($priorityFlags as $flag)
                                        <span class="badge badge-info mr-1 mb-1">{{ $flag }}</span>
                                    @endforeach
                                </div>
                            @endif

                            <div class="d-flex flex-wrap text-muted mb-3" style="gap: 0.75rem;">
                                @if ($fraudScore !== null)
                                    <span>Fraud score: {{ number_format((float) $fraudScore, 2) }}</span>
                                @endif
                                @if ($regulatorStatus)
                                    <span>Regulator status: {{ \Illuminate\Support\Str::headline($regulatorStatus) }}</span>
                                @endif
                            </div>

                            @if (! empty($recommendations))
                                <ul class="mb-0">
                                    @foreach ($recommendations as $recommendation)
                                        <li>{{ $recommendation }}</li>
                                    @endforeach
                                </ul>
                            @endif
                        </div>
                    </div>
                @endif

                <form wire:submit.prevent="submitAction('approve')" class="mt-4">
                    <div class="form-group">
                        <label for="adminNotes">Reviewer Notes</label>
                        <textarea id="adminNotes" rows="3" class="form-control" placeholder="Add context for this decision" wire:model.defer="notes"></textarea>
                        @error('notes')
                            <span class="text-danger">{{ $message }}</span>
                        @enderror
                    </div>
                    <div class="btn-toolbar" role="toolbar" aria-label="Verification actions">
                        <div class="btn-group mr-2 mb-2">
                            <button type="button" class="btn btn-success" wire:click="submitAction('approve')" wire:loading.attr="disabled">
                                Approve &amp; Verify
                            </button>
                        </div>
                        <div class="btn-group mr-2 mb-2">
                            <button type="button" class="btn btn-warning" wire:click="submitAction('request-info')" wire:loading.attr="disabled">
                                Request Info
                            </button>
                            <button type="button" class="btn btn-danger" wire:click="submitAction('reject')" wire:loading.attr="disabled">
                                Reject
                            </button>
                        </div>
                        @if (in_array($selectedAgent->status, ['pending', 'pending_information'], true))
                            <div class="btn-group mr-2 mb-2">
                                <button type="button" class="btn btn-outline-danger" wire:click="submitAction('escalate')" wire:loading.attr="disabled">
                                    Escalate to Compliance
                                </button>
                            </div>
                        @endif
                        @if ($selectedAgent->status === 'verified')
                            <div class="btn-group mb-2">
                                <button type="button" class="btn btn-outline-primary" wire:click="submitAction('schedule-reverify')" wire:loading.attr="disabled">
                                    Schedule Reverify
                                </button>
                            </div>
                        @endif
                    </div>
                </form>
            </div>
        </div>
    @endif

    <div wire:loading.flex style="position: fixed; inset: 0; background: rgba(255, 255, 255, 0.7); align-items: center; justify-content: center; z-index: 1040;">
        <div class="spinner-border text-primary" role="status">
            <span class="sr-only">Loading...</span>
        </div>
    </div>
</div>
