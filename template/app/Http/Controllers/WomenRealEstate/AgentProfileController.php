<?php

declare(strict_types=1);

namespace App\Http\Controllers\WomenRealEstate;

use App\Enums\WomenRealEstate\VerificationStage;
use App\Http\Controllers\Controller;
use App\Models\AgentProfile;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use App\Services\WomenRealEstate\AgentPulseService;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

final class AgentProfileController extends Controller
{
    public function __construct(private readonly AgentPulseService $agentPulse)
    {
        $this->middleware(['auth', 'verified']);
    }

    public function edit(Request $request): View
    {
        $profile = AgentProfile::firstOrCreate(
            ['user_id' => $request->user()->id],
            [
                'availability_status' => 'available',
                'experience_years' => 0,
            ],
        );

        $this->authorize('view', $profile);

        $profile->loadMissing(['user.socialProfile']);

        if (! $profile->social_profile_id && $request->user()->socialProfile) {
            $profile->social_profile_id = $request->user()->socialProfile->id;
            $profile->save();
        }

        $verificationRecord = WomenVerifiedAgent::query()
            ->with('user')
            ->where('user_id', $request->user()->id)
            ->first();

        $pulseSnapshot = $this->agentPulse->snapshotFor($request->user());

        return view('women.real-estate.agents.profile', [
            'profile' => $profile,
            'verificationRecord' => $verificationRecord,
            'verificationTimeline' => $this->buildVerificationTimeline($verificationRecord),
            'pulseSnapshot' => $pulseSnapshot,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $profile = AgentProfile::firstOrCreate(
            ['user_id' => $request->user()->id],
            [
                'availability_status' => 'available',
                'experience_years' => 0,
            ],
        );

        $this->authorize('update', $profile);

        $validated = $request->validate([
            'headline' => ['nullable', 'string', 'max:160'],
            'bio' => ['nullable', 'string'],
            'experience_years' => ['nullable', 'integer', 'min:0', 'max:60'],
            'transaction_focus' => ['nullable', 'string'],
            'service_regions' => ['nullable', 'string'],
            'availability_status' => ['required', 'in:available,waitlist,offline'],
            'calendly_url' => ['nullable', 'url'],
            'video_pitch_url' => ['nullable', 'url'],
        ]);

        $profile->fill([
            'headline' => $validated['headline'] ?? null,
            'bio' => $validated['bio'] ?? null,
            'experience_years' => $validated['experience_years'] ?? 0,
            'availability_status' => $validated['availability_status'],
            'calendly_url' => $validated['calendly_url'] ?? null,
            'video_pitch_url' => $validated['video_pitch_url'] ?? null,
        ]);

        $profile->transaction_focus = $this->normaliseList($validated['transaction_focus'] ?? null);
        $profile->service_regions = $this->normaliseList($validated['service_regions'] ?? null);

        if (! $profile->social_profile_id && $request->user()->socialProfile) {
            $profile->social_profile_id = $request->user()->socialProfile->id;
        }

        $profile->save();

        return redirect()
            ->route('women.real-estate.agents.profile.edit')
            ->with('status', 'Agent profile updated successfully.');
    }

    /**
     * @return (null|string)[]
     *
     * @psalm-return array{status: string, status_label: string, badge_class: string, description: string, stage_label: null|string, last_reviewed_formatted: null|string, last_reviewed_diff: null|string, next_reverification_formatted: null|string, next_reverification_diff: null|string, callout: null|string, callout_variant: null|string}
     */
    private function buildVerificationTimeline(?WomenVerifiedAgent $agent): array
    {
        $timezone = 'Australia/Sydney';

        if ($agent === null) {
            return [
                'status' => 'not_submitted',
                'status_label' => 'Not submitted',
                'badge_class' => 'bg-gray-100 text-gray-700 border border-gray-200',
                'description' => 'Complete the verification wizard below to request WomenRise review.',
                'stage_label' => 'Not started',
                'last_reviewed_formatted' => null,
                'last_reviewed_diff' => null,
                'next_reverification_formatted' => null,
                'next_reverification_diff' => null,
                'callout' => 'Submit your documents to unlock WomenRise reminders and the trusted badge.',
                'callout_variant' => 'info',
            ];
        }

        $status = $agent->status ?? 'pending';
        $stage = $agent->verification_stage instanceof VerificationStage
            ? $agent->verification_stage->value
            : ($agent->verification_stage ?? null);

        $lastReviewed = $agent->last_reviewed_at
            ? CarbonImmutable::make($agent->last_reviewed_at)?->timezone($timezone)
            : null;

        $reverifyAfter = Arr::get($agent->verification_payload ?? [], 'reverify_after');
        $reverifyDate = $reverifyAfter
            ? CarbonImmutable::make($reverifyAfter)?->timezone($timezone)
            : null;

        $badgeClass = match ($status) {
            'verified' => 'bg-emerald-100 text-emerald-800 border border-emerald-200',
            'pending', 'pending_information', 'pending_compliance' => 'bg-amber-100 text-amber-800 border border-amber-200',
            'rejected' => 'bg-rose-100 text-rose-800 border border-rose-200',
            default => 'bg-gray-100 text-gray-700 border border-gray-200',
        };

        $description = match ($status) {
            'verified' => 'Your trusted badge is live for women browsing our advocate network.',
            'pending_information' => 'Share the requested details so our team can complete your review.',
            'pending_compliance' => 'Our compliance specialists are reviewing your submission to keep the community safe.',
            'rejected' => 'We could not approve the last submission. Update your details and resubmit when ready.',
            default => 'Our verification team is reviewing your submission. We will email you with updates.',
        };

        $callout = null;
        $calloutVariant = null;

        if ($status === 'verified') {
            if ($reverifyDate) {
                $callout = sprintf(
                    'Next reverification window starts %s (%s). We will email reminders ahead of the date.',
                    $reverifyDate->isoFormat('MMM D, YYYY'),
                    $reverifyDate->diffForHumans()
                );
            } else {
                $callout = 'We will schedule your next reverification window soon and send reminders ahead of time.';
            }
            $calloutVariant = 'success';
        } elseif ($status === 'pending_information') {
            $callout = 'Reply to the verification email or add notes in your submission so we can continue the review.';
            $calloutVariant = 'warning';
        } elseif ($status === 'pending_compliance') {
            $callout = 'Thanks for your patience. Our compliance team is reviewing your details and will reach out if anything else is required.';
            $calloutVariant = 'warning';
        } elseif ($status === 'rejected') {
            $callout = 'Contact the WomenRise team if you believe we missed something, or update your documents before resubmitting.';
            $calloutVariant = 'danger';
        } elseif ($status === 'pending') {
            $callout = 'Thanks for submitting your details. We will email you as soon as a reviewer updates your status.';
            $calloutVariant = 'info';
        }

        return [
            'status' => $status,
            'status_label' => Str::headline($status),
            'badge_class' => $badgeClass,
            'description' => $description,
            'stage_label' => $stage ? Str::headline($stage) : null,
            'last_reviewed_formatted' => $lastReviewed?->isoFormat('MMM D, YYYY'),
            'last_reviewed_diff' => $lastReviewed?->diffForHumans(),
            'next_reverification_formatted' => $reverifyDate?->isoFormat('MMM D, YYYY'),
            'next_reverification_diff' => $reverifyDate?->diffForHumans(),
            'callout' => $callout,
            'callout_variant' => $calloutVariant,
        ];
    }

    /**
     * @return null|string[]
     *
     * @psalm-return array<int, string>|null
     */
    private function normaliseList(?string $value): array|null
    {
        if ($value === null) {
            return null;
        }

        $items = collect(preg_split('/[\n,]+/', $value))
            ->map(static fn (string $item) => trim($item))
            ->filter()
            ->values()
            ->all();

        return empty($items) ? null : $items;
    }
}

