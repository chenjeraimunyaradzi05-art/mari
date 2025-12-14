@props(['panel' => null, 'section' => null])

@if (! empty($panel))
    <div class="athena-micro-panel" data-panel-section="{{ $section }}">
        <div>
            <p class="athena-micro-panel__title">{{ $panel['title'] ?? __('What Athena does') }}</p>
            <p class="athena-micro-panel__body">{{ $panel['body'] ?? '' }}</p>
        </div>
        @if (! empty(data_get($panel, 'action.url')))
            <a class="athena-micro-panel__cta" href="{{ $panel['action']['url'] }}">
                {{ $panel['action']['label'] }}
            </a>
        @endif
    </div>
@endif
