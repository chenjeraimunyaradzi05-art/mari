@props(['data' => null])

@if (! empty($data))
    <section class="welcome-toast" aria-live="polite">
        <div class="welcome-toast__meta">
            <p class="welcome-toast__eyebrow">
                {{ $data['is_first_login'] ? __('New to Athena') : __('Welcome back') }}
            </p>
            <h2 class="welcome-toast__title">{{ $data['greeting'] }}</h2>
            <p class="welcome-toast__copy">{{ $data['message'] }}</p>
        </div>
        @if (! empty($data['focus']))
            <div class="welcome-toast__focus">
                <p class="welcome-toast__focus-label">{{ __('Today\'s focus') }}</p>
                <p class="welcome-toast__focus-stat">{{ $data['focus']['stat'] ?? '' }}</p>
                <h3 class="welcome-toast__focus-title">{{ $data['focus']['label'] }}</h3>
                <p class="welcome-toast__focus-copy">{{ $data['focus']['summary'] }}</p>
                @if (! empty(data_get($data, 'focus.cta.url')))
                    <a class="welcome-toast__focus-cta" href="{{ $data['focus']['cta']['url'] }}">
                        {{ $data['focus']['cta']['label'] }}
                    </a>
                @endif
            </div>
        @endif
    </section>
@endif
