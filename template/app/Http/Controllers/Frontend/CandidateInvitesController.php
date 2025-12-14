<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Jobs\Social\SendInvitationNudgeJob;
use App\Models\Invitation;
use App\Models\MentorshipCohort;
use App\Models\MentorshipCohortMember;
use App\Models\MentorshipMatch;
use App\Models\SocialProfile;
use App\Models\User;
use App\Services\CommunityMembershipService;
use App\Support\InAppNotifier;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class CandidateInvitesController extends Controller
{
    public function __construct(private readonly CommunityMembershipService $communityMemberships)
    {
    }

    /**
     * Display all invitations.
     */
    public function index(Request $request): \Illuminate\Contracts\View\View
    {
        /** @var User $user */
        $user = Auth::user();
        $candidate = $user->candidate;

        $invitations = Invitation::where('receiver_id', Auth::id())
            ->with(['sender', 'receiver'])
            ->orderBy('created_at', 'desc')
            ->paginate(15);

        $pendingCount = Invitation::where('receiver_id', Auth::id())
            ->where('status', 'pending')
            ->count();

        $templates = collect(config('social_invites.templates', []))
            ->map(fn (array $definition, string $key) => [
                'key' => $key,
                'label' => $definition['label'] ?? ucfirst(str_replace('_', ' ', $key)),
                'type' => $definition['type'] ?? 'connection',
                'default_message' => $definition['default_message'] ?? null,
                'onboarding' => $definition['onboarding'] ?? [],
            ])->values();

        $mentorshipCohorts = MentorshipCohort::query()
            ->select(['id', 'name', 'cohort_code', 'status', 'focus_area'])
            ->whereNotIn('status', ['archived'])
            ->orderBy('name')
            ->limit(50)
            ->get();

        return view('frontend.candidate-dashboard.social.invites', [
            'candidate' => $candidate,
            'invitations' => $invitations,
            'pendingCount' => $pendingCount,
            'inviteTemplates' => $templates,
            'mentorshipCohorts' => $mentorshipCohorts,
        ]);
    }

    /**
     * Send an invitation.
     */
    public function store(Request $request): \Illuminate\Http\JsonResponse
    {
        try {
            $validated = $request->validate([
                'receiver_id' => 'required|exists:users,id|different:sender_id',
                'type' => ['nullable', Rule::in($this->allowedInviteTypes())],
                'template_key' => ['nullable', Rule::in(array_keys(config('social_invites.templates', [])))],
                'message' => 'nullable|string|max:500',
                'mentorship_cohort_id' => ['nullable', 'exists:mentorship_cohorts,id'],
                'metadata' => ['nullable', 'array'],
                'context' => ['nullable', 'string', 'max:240'],
                'match_context' => ['nullable', 'string', 'max:280'],
            ]);

            $existingInvite = Invitation::where('sender_id', Auth::id())
                ->where('receiver_id', $validated['receiver_id'])
                ->where('type', $validated['type'])
                ->where('status', 'pending')
                ->first();

            if ($existingInvite) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invitation already sent',
                ], 409);
            }

            $template = $this->resolveTemplate($validated['template_key'] ?? null);
            $message = $validated['message'] ?? ($template['default_message'] ?? null);
            $type = $template['type'] ?? ($validated['type'] ?? 'connection');

            $metadata = array_filter([
                'template' => $template ? [
                    'key' => $validated['template_key'],
                    'label' => $template['label'] ?? null,
                    'type' => $template['type'] ?? null,
                    'onboarding' => $template['onboarding'] ?? null,
                    'nudge_offsets' => $template['nudge_offsets'] ?? [],
                ] : null,
                'context' => $validated['context'] ?? null,
                'mentorship' => $validated['mentorship_cohort_id'] ? [
                    'cohort_id' => $validated['mentorship_cohort_id'],
                    'match_context' => $validated['match_context'] ?? null,
                ] : null,
            ], fn ($value) => $value !== null);

            if (! empty($validated['metadata'])) {
                $metadata = array_replace_recursive($metadata, $validated['metadata']);
            }

            $invitation = Invitation::create([
                'sender_id' => Auth::id(),
                'receiver_id' => $validated['receiver_id'],
                'type' => $type,
                'message' => $message,
                'status' => 'pending',
                'template_key' => $validated['template_key'] ?? null,
                'metadata' => $metadata ?: null,
                'mentorship_cohort_id' => $validated['mentorship_cohort_id'] ?? null,
            ]);

            if ($template && ! empty($template['nudge_offsets'])) {
                $this->scheduleTemplateNudges($invitation, $validated['template_key'], $template['nudge_offsets']);
            }

            return response()->json([
                'success' => true,
                'message' => 'Invitation sent successfully',
                'invitation' => $invitation,
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'An error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Accept an invitation.
     */
    public function accept(Invitation $invitation): \Illuminate\Http\JsonResponse
    {
        try {
            if ($invitation->receiver_id !== Auth::id()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized',
                ], 403);
            }

            if ($invitation->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'Invitation already processed',
                ], 400);
            }

            $invitation->update(['status' => 'accepted']);

            $this->activateMentorshipMatch($invitation->fresh());

            return response()->json([
                'success' => true,
                'message' => 'Invitation accepted successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'An error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Reject an invitation.
     */
    public function reject(Invitation $invitation): \Illuminate\Http\JsonResponse
    {
        try {
            if ($invitation->receiver_id !== Auth::id()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized',
                ], 403);
            }

            if ($invitation->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'Invitation already processed',
                ], 400);
            }

            $invitation->update(['status' => 'rejected']);

            return response()->json([
                'success' => true,
                'message' => 'Invitation rejected successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'An error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Cancel/Delete an invitation.
     */
    public function destroy(Invitation $invitation): \Illuminate\Http\JsonResponse
    {
        try {
            if ($invitation->sender_id !== Auth::id() && $invitation->receiver_id !== Auth::id()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized',
                ], 403);
            }

            $invitation->delete();

            return response()->json([
                'success' => true,
                'message' => 'Invitation cancelled successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'An error occurred: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * @return (mixed|string)[]
     *
     * @psalm-return non-empty-list<'collaboration'|'connection'|'event'|'group'|mixed>
     */
    protected function allowedInviteTypes(): array
    {
        $base = ['connection', 'group', 'event', 'collaboration'];
        $templateTypes = collect(config('social_invites.templates', []))
            ->pluck('type')
            ->filter()
            ->unique()
            ->values()
            ->all();

        return array_values(array_unique(array_merge($base, $templateTypes)));
    }

    protected function resolveTemplate(?string $key): ?array
    {
        if (! $key) {
            return null;
        }

        return config("social_invites.templates.{$key}");
    }

    protected function scheduleTemplateNudges(Invitation $invitation, ?string $templateKey, array $offsets): void
    {
        if (! $templateKey) {
            return;
        }

        $windows = collect($offsets)
            ->filter(function ($val) {
                return is_numeric($val) && (int) $val > 0;
            })
            ->unique()
            ->values();

        foreach ($windows as $window) {
            $offset = (int) $window;

            if ($offset <= 0) {
                continue;
            }

            SendInvitationNudgeJob::dispatch($invitation->getKey(), $templateKey, $offset)
                ->delay(now()->addHours($offset));
        }

        if ($windows->isNotEmpty()) {
            $invitation->forceFill(['nudges_scheduled_at' => now()])->save();
        }
    }

    protected function activateMentorshipMatch(Invitation $invitation): void
    {
        $templateKey = $invitation->template_key;

        if (! $templateKey || $invitation->mentorship_match_id) {
            return;
        }

        $template = $this->resolveTemplate($templateKey);

        if (! $template || ! in_array($template['type'] ?? null, ['mentor_connection', 'cohort_invite', 'office_hours'], true)) {
            return;
        }

        $mentor = $invitation->sender;
        $mentee = $invitation->receiver;

        if (! $mentor || ! $mentee) {
            return;
        }

        $cohort = $invitation->mentorshipCohort()->with('group')->first();

        $mentorProfile = $this->resolveSocialProfile($mentor);
        $menteeProfile = $this->resolveSocialProfile($mentee);

        $this->addMenteeToCohort($cohort, $menteeProfile);

        $match = MentorshipMatch::create([
            'mentorship_cohort_id' => $cohort?->getKey(),
            'mentorship_program_id' => $cohort?->mentorship_program_id,
            'mentor_user_id' => $mentor->getKey(),
            'mentee_user_id' => $mentee->getKey(),
            'mentor_profile_id' => $mentorProfile?->getKey(),
            'mentee_profile_id' => $menteeProfile?->getKey(),
            'status' => 'active',
            'started_at' => now(),
            'next_check_in_at' => $this->calculateNextCheckIn($template),
            'context' => array_filter([
                'template_key' => $templateKey,
                'template_label' => $template['label'] ?? null,
                'resource_bundle' => data_get($template, 'onboarding.resource_bundle'),
                'metadata' => $invitation->metadata,
            ]),
        ]);

        $invitation->forceFill(['mentorship_match_id' => $match->getKey()])->save();

        InAppNotifier::notifyUser($mentor->getKey(), 'mentorship.match.accepted', [
            'match_id' => $match->getKey(),
            'mentee' => $mentee->only(['id', 'name', 'email']),
            'template_key' => $templateKey,
        ]);

        InAppNotifier::notifyUser($mentee->getKey(), 'mentorship.match.confirmed', [
            'match_id' => $match->getKey(),
            'mentor' => $mentor->only(['id', 'name', 'email']),
            'cohort' => $cohort ? $cohort->only(['id', 'name', 'cohort_code']) : null,
            'resource_bundle' => data_get($template, 'onboarding.resource_bundle'),
        ]);

        if ($bundle = data_get($template, 'onboarding.resource_bundle')) {
            InAppNotifier::notifyUser($mentee->getKey(), 'mentorship.onboarding.resources', [
                'match_id' => $match->getKey(),
                'bundle' => $bundle,
                'mentor' => $mentor->only(['id', 'name']),
            ]);
        }
    }

    protected function resolveSocialProfile(User $user): SocialProfile|null
    {
        if ($user->relationLoaded('socialProfile') && $user->socialProfile) {
            return $user->socialProfile;
        }

        return SocialProfile::query()
            ->where('user_id', $user->getKey())
            ->latest('id')
            ->first();
    }

    protected function addMenteeToCohort(?MentorshipCohort $cohort, ?SocialProfile $profile): ?MentorshipCohortMember
    {
        if (! $cohort || ! $profile || ! $cohort->group) {
            return null;
        }

        $membership = $this->communityMemberships->addMember($cohort->group, $profile, [
            'community_chapter_id' => $cohort->community_chapter_id,
            'status' => 'active',
            'approved_at' => now(),
            'joined_via' => 'invitation',
        ]);

        return MentorshipCohortMember::updateOrCreate(
            [
                'mentorship_cohort_id' => $cohort->getKey(),
                'social_profile_id' => $profile->getKey(),
            ],
            [
                'community_membership_id' => $membership->getKey(),
                'role' => 'mentee',
                'status' => 'active',
                'joined_at' => now(),
            ]
        );
    }

    protected function calculateNextCheckIn(?array $template): ?CarbonImmutable
    {
        $days = (int) data_get($template, 'onboarding.check_in_days', 0);

        if ($days <= 0) {
            return null;
        }

        return CarbonImmutable::now()->addDays($days);
    }
}

