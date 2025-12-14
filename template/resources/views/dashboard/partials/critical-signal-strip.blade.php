@props(['signals' => []])

@if (! empty($signals))
    <section class="critical-signal" data-critical-signal="true" aria-label="{{ __('Critical research signals') }}">
        <div class="critical-signal__viewport">
            @foreach ($signals as $index => $signal)
                <article class="critical-signal__item {{ $loop->first ? 'is-active' : '' }}" data-critical-item="{{ $index }}">
                    <div>
                        <p class="critical-signal__label">{{ $signal['label'] }}</p>
                        <p class="critical-signal__stat">{{ $signal['stat'] }}</p>
                    </div>
                    <p class="critical-signal__summary">{{ $signal['summary'] }}</p>
                </article>
            @endforeach
        </div>
        @if (count($signals) > 1)
            <div class="critical-signal__controls" role="group" aria-label="{{ __('Cycle through signals') }}">
                <button type="button" class="critical-signal__btn" data-critical-prev>
                    <span aria-hidden="true">←</span>
                    <span class="sr-only">{{ __('Previous signal') }}</span>
                </button>
                <button type="button" class="critical-signal__btn" data-critical-next>
                    <span aria-hidden="true">→</span>
                    <span class="sr-only">{{ __('Next signal') }}</span>
                </button>
            </div>
        @endif
    </section>

    @once
        @push('scripts')
            <script>
                document.addEventListener('DOMContentLoaded', function () {
                    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                    document.querySelectorAll('[data-critical-signal]').forEach(function (section) {
                        const items = section.querySelectorAll('[data-critical-item]');
                        if (items.length <= 1) {
                            return;
                        }

                        let activeIndex = 0;
                        let intervalId = null;

                        const activate = function (nextIndex) {
                            items.forEach(function (item) {
                                item.classList.remove('is-active');
                            });
                            const target = section.querySelector('[data-critical-item="' + nextIndex + '"]');
                            if (target) {
                                target.classList.add('is-active');
                                activeIndex = nextIndex;
                            }
                        };

                        const goNext = function () {
                            const next = (activeIndex + 1) % items.length;
                            activate(next);
                        };

                        const goPrev = function () {
                            const prev = (activeIndex - 1 + items.length) % items.length;
                            activate(prev);
                        };

                        const resetInterval = function () {
                            if (intervalId) {
                                window.clearInterval(intervalId);
                            }
                            if (!prefersReducedMotion) {
                                intervalId = window.setInterval(goNext, 8000);
                            }
                        };

                        const nextButton = section.querySelector('[data-critical-next]');
                        const prevButton = section.querySelector('[data-critical-prev]');

                        if (nextButton) {
                            nextButton.addEventListener('click', function () {
                                goNext();
                                resetInterval();
                            });
                        }

                        if (prevButton) {
                            prevButton.addEventListener('click', function () {
                                goPrev();
                                resetInterval();
                            });
                        }

                        resetInterval();
                    });
                });
            </script>
        @endpush
    @endonce
@endif
