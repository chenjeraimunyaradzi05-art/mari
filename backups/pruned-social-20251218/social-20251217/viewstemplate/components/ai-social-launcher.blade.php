@php
    $aiRouteName = config('app.platform.ai_entry_route', 'ai.concierge');
    $socialRouteName = config('app.platform.social_entry_route', 'social.feed.index');

    $aiUrl = \Illuminate\Support\Facades\Route::has($aiRouteName) ? route($aiRouteName) : url('/ai');
    $socialUrl = \Illuminate\Support\Facades\Route::has($socialRouteName) ? route($socialRouteName) : url('/feed');

    $intentEvaluator = auth()->check() ? \App\Support\IntentEvaluator::for(auth()->user()) : null;

    $intentLaunchers = collect(config('intent.contexts', []))
        ->map(function ($context, $key) use ($intentEvaluator) {
            $launcher = $context['launcher'] ?? [];
            $guestDefault = (bool) ($context['public_default'] ?? false);
            $requiresAuth = (bool) ($launcher['requires_auth'] ?? false);

            $target = $launcher['link'] ?? $launcher['url'] ?? null;
            if (! empty($launcher['route']) && \Illuminate\Support\Facades\Route::has($launcher['route'])) {
                $target = route($launcher['route'], $launcher['parameters'] ?? []);
            } elseif ($target !== null) {
                $target = url($target);
            }

            if (auth()->check() && ! empty($launcher['auth_route']) && \Illuminate\Support\Facades\Route::has($launcher['auth_route'])) {
                $target = route($launcher['auth_route'], $launcher['auth_parameters'] ?? []);
            }

            $visible = $intentEvaluator
                ? $intentEvaluator->allowsContext($key)
                : ($guestDefault && ! $requiresAuth);

            if ($requiresAuth && ! auth()->check()) {
                $visible = false;
            }

            return [
                'key' => $key,
                'label' => $launcher['label'] ?? ($context['label'] ?? \Illuminate\Support\Str::headline($key)),
                'description' => $launcher['description'] ?? $context['description'] ?? null,
                'icon' => $launcher['icon'] ?? 'fas fa-circle',
                'link' => $target ?? '#',
                'visible' => $visible,
            ];
        })
        ->filter(fn ($launcher) => $launcher['visible'])
        ->values();
@endphp

<div class="intent-launcher" data-intent-launcher data-intent-launcher-active="false">
    <div class="intent-launcher__inner">
        <div class="intent-launcher__control">
            <button type="button" class="intent-launcher__toggle" data-intent-launcher-toggle aria-label="Open Athena launchers">
                <span class="intent-launcher__toggle-glow"></span>
                <span class="intent-launcher__toggle-core" aria-hidden="true">
                    <i class="fas fa-wand-magic" aria-hidden="true"></i>
                    <span class="intent-launcher__toggle-text">AI</span>
                </span>
            </button>
            <span class="intent-launcher__label">Athena Assist</span>
            <div class="intent-launcher__panel" data-intent-launcher-panel aria-hidden="true">
                <div class="intent-launcher__panel-inner">
                    <p class="intent-launcher__title">Fast launch</p>
                    <a class="intent-launcher__action" href="{{ $aiUrl }}">
                        <span class="intent-launcher__action-icon">
                            <i class="fas fa-moon" aria-hidden="true"></i>
                        </span>
                        <span>
                            <strong>AI Concierge</strong>
                            <small>Ask Athena anything in dark mode comfort.</small>
                        </span>
                    </a>
                    <a class="intent-launcher__action" href="{{ $socialUrl }}">
                        <span class="intent-launcher__action-icon">
                            <i class="fas fa-satellite-dish" aria-hidden="true"></i>
                        </span>
                        <span>
                            <strong>Social Feed</strong>
                            <small>Drop into community updates instantly.</small>
                        </span>
                    </a>

                    @if ($intentLaunchers->isNotEmpty())
                        <div class="intent-launcher__divider" aria-hidden="true"></div>
                        <p class="intent-launcher__title intent-launcher__title--sub">Your focus areas</p>
                        @foreach ($intentLaunchers as $launcher)
                            <a class="intent-launcher__action intent-launcher__action--context" href="{{ $launcher['link'] }}">
                                <span class="intent-launcher__action-icon">
                                    <i class="{{ $launcher['icon'] }}" aria-hidden="true"></i>
                                </span>
                                <span>
                                    <strong>{{ $launcher['label'] }}</strong>
                                    @if (! empty($launcher['description']))
                                        <small>{{ $launcher['description'] }}</small>
                                    @endif
                                </span>
                            </a>
                        @endforeach
                    @endif
                </div>
            </div>
        </div>
    </div>
</div>



<script>
    document.addEventListener('DOMContentLoaded', () => {
        const launchers = document.querySelectorAll('[data-intent-launcher]');
        if (!launchers.length) {
            return;
        }

        launchers.forEach((launcher) => {
            const toggleButton = launcher.querySelector('[data-intent-launcher-toggle]');
            const panel = launcher.querySelector('[data-intent-launcher-panel]');

            if (!toggleButton || !panel) {
                return;
            }

            const closePanel = () => {
                launcher.setAttribute('data-intent-launcher-active', 'false');
                panel.setAttribute('aria-hidden', 'true');
            };

            const openPanel = () => {
                launcher.setAttribute('data-intent-launcher-active', 'true');
                panel.setAttribute('aria-hidden', 'false');
            };

            toggleButton.addEventListener('click', () => {
                const isActive = launcher.getAttribute('data-intent-launcher-active') === 'true';
                if (isActive) {
                    closePanel();
                } else {
                    openPanel();
                }
            });

            document.addEventListener('click', (event) => {
                const target = event.target;
                if (target instanceof Node && !launcher.contains(target)) {
                    closePanel();
                }
            });
        });
    });
</script>

