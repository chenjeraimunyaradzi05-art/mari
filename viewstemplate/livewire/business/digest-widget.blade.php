@once

@endonce

<div class="bd-card bd-card--widget business-digest-widget">
    <div class="bd-card__header">
        <div>
            <p class="bd-card__tag">Founder digest</p>
            <h3 class="bd-card__title">{{ $snapshot['venture'] ?? 'Business Network' }} pulse</h3>
            <p class="bd-card__helper">{{ $snapshot['digest_summary'] ?? 'Live snapshot of milestones, reach, and resources.' }}</p>
        </div>
        <button wire:click="refreshSnapshot"
            wire:loading.attr="disabled"
            class="bd-ghost bd-ghost--button">
            <span wire:loading.remove>{{ $refreshing ? 'Refreshing…' : 'Refresh' }}</span>
            <span wire:loading>Refreshing…</span>
        </button>
    </div>

    <div class="bd-digest__kpis">
        @foreach ($kpis as $kpi)
            <div class="bd-digest__kpi">
                <p class="bd-digest__kpi-label">{{ $kpi['label'] }}</p>
                <p class="bd-digest__kpi-value">{{ $kpi['value'] }}{{ $kpi['suffix'] ?? '' }}</p>
                <p class="bd-digest__kpi-helper">{{ $kpi['helper'] ?? 'Keep building' }}</p>
            </div>
        @endforeach
    </div>

    @if ($nextMilestone)
        <div class="bd-digest__meta">
            <p class="bd-digest__meta-label">Next milestone</p>
            <p class="bd-digest__meta-title">{{ $nextMilestone['title'] }}</p>
            <p class="bd-digest__meta-copy">{{ $nextMilestone['summary'] }}</p>
            <div class="bd-digest__meta-footer">
                <span class="bd-chip bd-chip--soft">Due {{ $nextMilestone['due_human'] ?? 'soon' }}</span>
                @if (! empty($nextMilestone['cta_url']))
                    <a href="{{ $nextMilestone['cta_url'] }}" target="_blank" class="bd-cta bd-cta--ghost">
                        {{ $nextMilestone['cta_label'] ?? 'Open brief' }}
                    </a>
                @endif
            </div>
        </div>
    @endif

    @if ($resourceSpotlight)
        <div class="bd-digest__meta">
            <p class="bd-digest__meta-label">Resource spotlight</p>
            <p class="bd-digest__meta-title">{{ $resourceSpotlight['title'] }}</p>
            <p class="bd-digest__meta-copy">{{ $resourceSpotlight['summary'] }}</p>
            <a href="{{ $resourceSpotlight['cta_url'] }}" target="_blank" class="bd-link">
                {{ $resourceSpotlight['cta_label'] }} →
            </a>
        </div>
    @endif

    @if (! empty($snapshot['recommendations']))
        <div class="bd-digest__list">
            <p class="bd-digest__meta-label">Moves to make</p>
            <ul>
                @foreach ($snapshot['recommendations'] as $recommendation)
                    <li>{{ $recommendation }}</li>
                @endforeach
            </ul>
        </div>
    @endif
</div>

