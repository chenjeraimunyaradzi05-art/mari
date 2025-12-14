# Homepage Ads QA Checklist

Use this runbook once live creatives populate the homepage slots so we catch layout, performance, and analytics regressions early.

## 1. Cross-browser visual sweep

- **Desktop:** Chrome, Edge, Firefox, Safari (latest stable). View at 1440px, 1024px, and 768px widths. Confirm sticky header + ad carousels behave, videos autoplay muted, CTA buttons remain visible.
- **Mobile:** Chrome on Android 13+, Safari on iOS 17+. Test portrait + landscape (390px, 414px, 768px). Ensure cards stack, dots remain tappable, and CTA tap targets meet 44px guidance.
- Capture screenshots for each slot (hero, feature strip, onboarding, education, feature grid, gallery, pricing, CTA) with at least one video and one static creative to verify aspect ratios.

## 2. Beacon verification

- Open DevTools Network tab, filter `ads/beacon`, and scroll through every slot until each request fires (IntersectionObserver triggers at ~60% visibility). Confirm payload contains `creative_id`, `campaign_id`, `slot`, and signature.
- Click every CTA once; verify additional `event: click` request is emitted without duplicates.
- In a lower environment, inspect `advertising_campaign_metrics` for today — impressions and clicks should increment with slot/device breakdowns recorded in `notes` JSON.

## 3. Lighthouse performance passes

- **Desktop run:** Chrome DevTools Lighthouse → Modes: Performance, Accessibility, Best Practices, SEO. Target ≥90 for all, note any CLS introduced by variable media.
- **Mobile run:** Same configuration but emulate Moto G Power / slow 4G. Document First Contentful Paint + Total Blocking Time deltas versus previous baseline.
- If scores dip >5 points, annotate root cause (e.g., oversized creative) and return to ads team before publishing.

## 4. Responsive stress tests

- Temporarily substitute extreme aspect ratios (1:1, 9:16 video, 4:1 banner) and re-run the scroll test to ensure `.ad-card` never overflows and dot navigation still aligns with slides.
- Validate videos without posters gracefully display fallback color + caption, and missing CTA copy hides the button.

## 5. Regression sign-off

- Log QA results in `Progress.md` with date, browsers, devices, Lighthouse scores, and any anomalies.
- Only promote new sponsor rotations after both impression/click beacons and Lighthouse checks pass for that creative batch.
