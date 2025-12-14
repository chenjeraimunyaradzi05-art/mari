<div class="skills-card" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-24);">
    <p class="skills-card__eyebrow" style="color: var(--color-primary); font-weight: var(--font-weight-bold); text-transform: uppercase; font-size: var(--font-size-sm); margin-bottom: var(--space-8);">{{ $skillsCard['eyebrow'] }}</p>

    @if(!empty($skillsCard['title']))
        <h3 class="skills-card__title" style="font-size: var(--font-size-2xl); margin-bottom: var(--space-12);">{{ $skillsCard['title'] }}</h3>
    @endif

    <p class="skills-card__description" style="color: var(--color-text-secondary); margin-bottom: var(--space-24);">{{ $skillsCard['description'] }}</p>

    @if (!empty($skillsCard['points']))
        <ul class="skills-card__list" style="list-style: none; padding: 0; margin-bottom: var(--space-24);">
            @foreach ($skillsCard['points'] as $point)
                <li style="margin-bottom: var(--space-12); padding-left: var(--space-24); position: relative;">
                    <span style="position: absolute; left: 0; top: 8px; width: 6px; height: 6px; background: var(--color-primary); border-radius: 50%;"></span>
                    {!! $point !!}
                </li>
            @endforeach
        </ul>
    @endif

    @if(!empty($skillsCard['cta']))
        <div class="skills-card__cta">
            <a href="{{ $skillsCard['cta']['url'] }}" class="btn btn-primary">
                {{ $skillsCard['cta']['label'] }}
            </a>
        </div>
    @endif
</div>
