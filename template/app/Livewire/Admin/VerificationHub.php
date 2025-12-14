<?php

namespace App\Livewire\Admin;

use App\Enums\SocialVerificationStatus;
use App\Models\SocialProfileVerification;
use App\Support\Livewire\FallbackComponent;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

trait VerificationHubBehavior
{
    use AuthorizesRequests;

    /** @var array<string, int> */
    public array $metrics = [];

    /** @var array<int, array<string, mixed>> */
    public array $openReviews = [];

    /** @var array<int, array<string, string>> */
    public array $automationAlerts = [];

    public ?string $flashMessage = null;

    public string $flashType = 'info';

    public function mount(): void
    {
        $this->authorize('operations.verification-hub');
        $this->metrics = [
            'pending' => 0,
            'escalated' => 0,
            'approved_24h' => 0,
            'ai_fallbacks' => 0,
        ];
    }

    public function load(): void
    {
        $this->authorize('operations.verification-hub');
        $now = CarbonImmutable::now();

        $pending = SocialProfileVerification::query()->where('status', SocialVerificationStatus::Pending)->count();
        $needsMoreInfo = SocialProfileVerification::query()->where('status', SocialVerificationStatus::NeedsMoreInfo)->count();
        $approved24h = SocialProfileVerification::query()
            ->where('status', SocialVerificationStatus::Approved)
            ->where('reviewed_at', '>=', $now->subDay())
            ->count();

        $aiFallbacks = SocialProfileVerification::query()
            ->where('status', SocialVerificationStatus::Pending)
            ->where(function ($query): void {
                $query
                    ->where('notes', 'like', '%ai_fallback%')
                    ->orWhere('notes', 'like', '%manual_review%');
            })
            ->count();

        $this->metrics = [
            'pending' => $pending,
            'escalated' => $needsMoreInfo,
            'approved_24h' => $approved24h,
            'ai_fallbacks' => $aiFallbacks,
        ];

        $this->openReviews = SocialProfileVerification::query()
            ->with(['profile'])
            ->whereIn('status', [SocialVerificationStatus::Pending, SocialVerificationStatus::NeedsMoreInfo])
            ->latest('submitted_at')
            ->limit(10)
            ->get()
            ->map(function (SocialProfileVerification $verification): array {
                return [
                    'id' => $verification->id,
                    'profile_id' => $verification->social_profile_id,
                    'profile' => optional($verification->profile)->display_name ?? 'Profile #'.$verification->social_profile_id,
                    'status' => $verification->status->value,
                    'submitted_at' => optional($verification->submitted_at)?->diffForHumans() ?? 'n/a',
                    'reviewer' => optional($verification->reviewer)->name,
                ];
            })
            ->all();

        $alerts = Collection::make();

        if ($pending > 50) {
            $alerts->push([
                'title' => 'Pending queue exceeds 50',
                'details' => 'Consider enabling weekend reviewer rotations to drain backlog.',
            ]);
        }

        if ($needsMoreInfo > ($pending / 2)) {
            $alerts->push([
                'title' => 'High manual follow-up volume',
                'details' => 'AI recommendations need retraining for verification documents.',
            ]);
        }

        if ($aiFallbacks > 0) {
            $alerts->push([
                'title' => 'AI fallback triggered',
                'details' => $aiFallbacks.' submissions require human-only review flow.',
            ]);
        }

        $this->automationAlerts = $alerts->take(3)->values()->all();
    }

    public function review(int $verificationId): void
    {
        $this->authorize('operations.verification-hub');
        $this->dispatch('open-verification-review', verificationId: $verificationId);
    }

    public function approveVerification(int $verificationId): void
    {
        $this->authorize('operations.verification-hub');
        $verification = SocialProfileVerification::findOrFail($verificationId);

        $verification->forceFill([
            'status' => SocialVerificationStatus::Approved,
            'reviewed_by' => auth('admin')->id(),
            'reviewed_at' => CarbonImmutable::now(),
        ])->save();

        $this->flash('success', 'Verification #'.$verification->id.' approved.');
        $this->load();
    }

    public function rejectVerification(int $verificationId): void
    {
        $this->authorize('operations.verification-hub');
        $verification = SocialProfileVerification::findOrFail($verificationId);

        $verification->forceFill([
            'status' => SocialVerificationStatus::Rejected,
            'reviewed_by' => auth('admin')->id(),
            'reviewed_at' => CarbonImmutable::now(),
        ])->save();

        $this->flash('warning', 'Verification #'.$verification->id.' rejected.');
        $this->load();
    }

    public function requestMoreInfo(int $verificationId): void
    {
        $this->authorize('operations.verification-hub');
        $verification = SocialProfileVerification::findOrFail($verificationId);

        $verification->forceFill([
            'status' => SocialVerificationStatus::NeedsMoreInfo,
            'reviewed_by' => auth('admin')->id(),
            'reviewed_at' => CarbonImmutable::now(),
        ])->save();

        $this->flash('info', 'Verification #'.$verification->id.' moved to needs-more-info.');
        $this->load();
    }

    public function exportQueue(): StreamedResponse
    {
        $this->authorize('operations.verification-hub');

        $rows = SocialProfileVerification::query()
            ->whereIn('status', [SocialVerificationStatus::Pending, SocialVerificationStatus::NeedsMoreInfo])
            ->orderByDesc('submitted_at')
            ->limit(250)
            ->get(['id', 'social_profile_id', 'status', 'submitted_at', 'reviewed_by']);

        $filename = 'verification-hub-queue-'.CarbonImmutable::now()->format('Ymd_His').'.csv';

        return response()->streamDownload(function () use ($rows): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Verification ID', 'Profile ID', 'Status', 'Submitted', 'Reviewer']);

            foreach ($rows as $row) {
                fputcsv($handle, [
                    $row->id,
                    $row->social_profile_id,
                    $row->status->value,
                    optional($row->submitted_at)?->toDateTimeString() ?? 'n/a',
                    $row->reviewed_by ?? '—',
                ]);
            }

            fclose($handle);
        }, $filename);
    }

    protected function flash(string $type, string $message): void
    {
        $this->flashType = $type;
        $this->flashMessage = $message;
    }

    public function render()
    {
        return view('livewire.admin.verification-hub');
    }
}

if (! class_exists(__NAMESPACE__.'\\LivewireComponent', false)) {
    if (class_exists('Livewire\\Component')) {
        class_alias('Livewire\\Component', __NAMESPACE__.'\\LivewireComponent');
    } else {
        class LivewireComponent extends FallbackComponent
        {
        }
    }
}

final class VerificationHub extends LivewireComponent
{
    use VerificationHubBehavior;
}

