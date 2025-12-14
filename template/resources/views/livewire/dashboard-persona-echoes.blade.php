<div class="dashboard-card mb-40 persona-echo-card">
    <div class="dashboard-card-header d-flex flex-wrap align-items-center gap-2">
        <div>
            <p class="dashboard-card-title mb-1">Persona Echoes</p>
            <span class="dashboard-card-subtitle">Signals from the onboarding graph to keep your journey on track.</span>
        </div>
        <button type="button" class="btn btn-sm ms-auto persona-echo-refresh" wire:click="refreshPersonas" wire:loading.attr="disabled">
            <i class="fas fa-rotate"></i>
            <span wire:loading.remove>Refresh</span>
            <span wire:loading>Refreshing…</span>
        </button>
    </div>
    <div class="dashboard-card-body">
        @if ($errorMessage)
            <div class="alert alert-warning" role="alert">
                {{ $errorMessage }}
            </div>
        @endif

        @if (empty($personas))
            <div class="dashboard-empty-state">
                <i class="fas fa-satellite-dish"></i>
                <span>We will surface new persona nudges once the intelligence engines have enough signal.</span>
            </div>
        @else
            <div class="row g-3">
                @foreach ($personas as $persona)
                    @php
                        $personaId = \Illuminate\Support\Arr::get($persona, 'id', uniqid('persona', true));
                        $nudges = collect(\Illuminate\Support\Arr::get($persona, 'nudges', []))->filter();
                        $ctaLabel = \Illuminate\Support\Arr::get($persona, 'cta.label');
                        $ctaUrl = \Illuminate\Support\Arr::get($persona, 'cta.url');
                    @endphp
                    <div class="col-md-6 col-xl-4" wire:key="persona-{{ $personaId }}">
                        <div class="persona-echo-card-item h-100">
                            <div class="d-flex align-items-center gap-3">
                                <span class="persona-echo-icon">
                                    @if (!empty($persona['icon']))
                                        <i class="{{ $persona['icon'] }}"></i>
                                    @else
                                        <i class="fas fa-user-astronaut"></i>
                                    @endif
                                </span>
                                <div>
                                    <span class="persona-echo-label">{{ \Illuminate\Support\Arr::get($persona, 'label', 'Growth Persona') }}</span>
                                    <span class="persona-echo-id">{{ \Illuminate\Support\Str::headline((string) \Illuminate\Support\Arr::get($persona, 'id', 'persona')) }}</span>
                                </div>
                            </div>

                            @if ($nudges->isNotEmpty())
                                <ul class="persona-echo-list mt-3">
                                    @foreach ($nudges->take(3) as $nudge)
                                        <li>{{ $nudge }}</li>
                                    @endforeach
                                </ul>
                            @endif

                            <div class="d-flex flex-wrap gap-2 mt-3">
                                <button type="button" class="btn btn-sm persona-echo-dismiss" wire:click="dismiss('{{ $personaId }}')" wire:loading.attr="disabled">
                                    <i class="fas fa-bell-slash"></i> Dismiss
                                </button>
                                @if ($ctaUrl)
                                    <a href="{{ $ctaUrl }}" class="btn btn-sm persona-echo-button">
                                        {{ $ctaLabel ?? 'View action plan' }}
                                        <i class="fas fa-arrow-up-right-from-square ms-2"></i>
                                    </a>
                                @endif
                            </div>
                        </div>
                    </div>
                @endforeach
            </div>
        @endif
    </div>
</div>



