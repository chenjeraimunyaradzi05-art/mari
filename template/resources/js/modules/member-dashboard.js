const reducedMotionQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
let prefersReducedMotion = reducedMotionQuery ? reducedMotionQuery.matches : false;

const focusFirstInteractive = (container) => {
    if (!container) {
        return;
    }

    const target = container.querySelector('[data-welcome-primary], a[href], button');

    if (!target) {
        return;
    }

    target.setAttribute('tabindex', '0');

    if (typeof target.focus === 'function') {
        const focusElement = () => {
            try {
                target.focus({ preventScroll: true });
            } catch {
                target.focus();
            }
        };

        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(focusElement);
        } else {
            focusElement();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const welcome = document.querySelector('[data-dashboard-welcome]');
    if (!welcome) {
        return;
    }

    const pulseTarget = welcome.querySelector('[data-greeting-pulse]');
    if (!pulseTarget || prefersReducedMotion) {
        focusFirstInteractive(welcome);
        return;
    }

    pulseTarget.addEventListener(
        'animationend',
        () => {
            pulseTarget.classList.remove('is-animating');
        },
        { once: true },
    );

    pulseTarget.classList.add('is-animating');
    focusFirstInteractive(welcome);
});

if (reducedMotionQuery) {
    const handleMotionChange = (event) => {
        prefersReducedMotion = event.matches;
    };

    if (typeof reducedMotionQuery.addEventListener === 'function') {
        reducedMotionQuery.addEventListener('change', handleMotionChange);
    } else if (typeof reducedMotionQuery.addListener === 'function') {
        reducedMotionQuery.addListener(handleMotionChange);
    }
}
