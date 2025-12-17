<?php

namespace App\Http\Controllers\Social;

use App\Http\Controllers\Controller;
use App\Http\Resources\IncidentReportResource;
use App\Models\ConversationParticipant;
use App\Models\IncidentEvent;
use App\Models\IncidentReport;
use App\Models\SocialBlock;
use App\Models\SocialProfile;
use App\Models\Profile;
use App\Support\ActiveProfile;
use App\Support\ActiveSocialProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

final class IncidentReportController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth:sanctum']);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $activeProfile = ActiveProfile::forUser($user);

        abort_if(! $activeProfile, 422, 'Select a persona before filing a report.');

        $payload = $this->validateRequest($request);

        $incident = IncidentReport::create([
            'reporter_user_id' => $user->getKey(),
            'subject_user_id' => $payload['subject_user_id'] ?? null,
            'category' => $payload['category'],
            'severity' => $payload['severity'] ?? 'medium',
            'description' => $payload['description'],
            'status' => 'open',
            'metadata' => array_merge($payload['metadata'] ?? [], [
                'reporter_profile_id' => $activeProfile->getKey(),
                'submitted_via' => 'social_report_flow',
            ]),
            'occurred_at' => Arr::get($payload, 'metadata.occurred_at', now()),
        ]);

        $actions = $this->applyQuickActions($activeProfile, $payload, $incident);

        $incident->load('events');

        return (new IncidentReportResource($incident))
            ->additional([
                'actions' => $actions,
                'links' => [
                    'moderation_queue' => route('admin.moderation.reports'),
                ],
            ])
            ->response()
            ->setStatusCode(201);
    }

    protected function validateRequest(Request $request): array
    {
        return $request->validate([
            'subject_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'category' => ['required', 'string', 'max:120'],
            'description' => ['required', 'string', 'max:2000'],
            'severity' => ['nullable', Rule::in(['low', 'medium', 'high', 'critical'])],
            'metadata' => ['nullable', 'array'],
            'metadata.conversation_id' => ['nullable', 'integer'],
            'metadata.social_thread_id' => ['nullable', 'integer'],
            'metadata.message_id' => ['nullable', 'integer'],
            'metadata.context' => ['nullable', 'string', 'max:255'],
            'metadata.occurred_at' => ['nullable', 'date'],
            'actions' => ['nullable', 'array'],
            'actions.mute' => ['sometimes', 'boolean'],
            'actions.block' => ['sometimes', 'boolean'],
            'actions.collect_evidence' => ['sometimes', 'boolean'],
            'evidence' => ['nullable', 'array'],
            'evidence.*.type' => ['nullable', 'string', 'max:60'],
            'evidence.*.label' => ['nullable', 'string', 'max:160'],
            'evidence.*.reference' => ['nullable', 'string', 'max:255'],
            'evidence.*.payload' => ['nullable', 'array'],
        ]);
    }

    /**
     * @return array[]
     *
     * @psalm-return array{mute?: array, block?: array, collect_evidence?: array}
     */
    protected function applyQuickActions(Profile $reporterProfile, array $payload, IncidentReport $incident): array
    {
        $actions = $payload['actions'] ?? [];
        $results = [];

        if (! empty($actions['mute'])) {
            $results['mute'] = $this->muteConversation($reporterProfile, Arr::get($payload, 'metadata.conversation_id'), $incident);
        }

        if (! empty($actions['block'])) {
            $results['block'] = $this->blockSubject($reporterProfile, $payload['subject_user_id'] ?? null, $incident);
        }

        if (! empty($actions['collect_evidence'])) {
            $results['collect_evidence'] = $this->collectEvidence($incident, $payload['evidence'] ?? []);
        }

        return $results;
    }

    /**
     * @return (bool|int|string)[]
     *
     * @psalm-return array{applied: bool, conversation_id?: int, reason?: 'missing_conversation'|'participant_not_found'}
     */
    protected function muteConversation(Profile $reporterProfile, ?int $conversationId, IncidentReport $incident): array
    {
        if (! $conversationId) {
            return ['applied' => false, 'reason' => 'missing_conversation'];
        }

        $participant = ConversationParticipant::query()
            ->where('conversation_id', $conversationId)
            ->where('profile_id', $reporterProfile->getKey())
            ->first();

        if (! $participant) {
            return ['applied' => false, 'reason' => 'participant_not_found'];
        }

        if (! $participant->muted) {
            $participant->forceFill(['muted' => true])->save();

            IncidentEvent::create([
                'incident_id' => $incident->getKey(),
                'action' => 'quick_action.muted',
                'notes' => 'Reporter muted conversation #'.$conversationId,
            ]);
        }

        return [
            'applied' => true,
            'conversation_id' => $conversationId,
        ];
    }

    /**
     * @return (bool|int|string)[]
     *
     * @psalm-return array{applied: bool, blocked_profiles?: int<0, max>, reason?: 'missing_social_profile'|'missing_subject'|'missing_subject_profile'}
     */
    protected function blockSubject(Profile $reporterProfile, ?int $subjectUserId, IncidentReport $incident): array
    {
        if (! $subjectUserId) {
            return ['applied' => false, 'reason' => 'missing_subject'];
        }

        $blocker = ActiveSocialProfile::forProfile($reporterProfile);

        if (! $blocker) {
            return ['applied' => false, 'reason' => 'missing_social_profile'];
        }

        $subjectProfiles = SocialProfile::query()
            ->where('user_id', $subjectUserId)
            ->pluck('id');

        if ($subjectProfiles->isEmpty()) {
            return ['applied' => false, 'reason' => 'missing_subject_profile'];
        }

        $blockedCount = 0;

        foreach ($subjectProfiles as $subjectProfileId) {
            SocialBlock::query()->updateOrCreate(
                [
                    'blocker_profile_id' => $blocker->getKey(),
                    'blocked_profile_id' => $subjectProfileId,
                ],
                [
                    'status' => 'active',
                    'source' => 'incident_report',
                    'reason' => $incident->category,
                    'metadata' => [
                        'incident_report_id' => $incident->getKey(),
                        'applied_at' => now()->toIso8601String(),
                    ],
                ]
            );

            $blockedCount++;
        }

        IncidentEvent::create([
            'incident_id' => $incident->getKey(),
            'action' => 'quick_action.blocked',
            'notes' => 'Reporter blocked subject user #'.$subjectUserId,
        ]);

        return [
            'applied' => true,
            'blocked_profiles' => $blockedCount,
        ];
    }

    /**
     * @return (bool|int|string)[]
     *
     * @psalm-return array{applied: bool, count?: int<1, max>, reason?: 'empty_payload'}
     */
    protected function collectEvidence(IncidentReport $incident, array $rawEvidence): array
    {
        $entries = collect($rawEvidence)
            ->map(function (array $item) {
                if (! isset($item['reference']) && ! isset($item['payload'])) {
                    return null;
                }

                return [
                    'type' => $item['type'] ?? 'snippet',
                    'label' => Str::limit($item['label'] ?? 'Captured evidence', 160),
                    'reference' => $item['reference'] ?? null,
                    'payload' => $item['payload'] ?? null,
                ];
            })
            ->filter()
            ->values()
            ->all();

        if (empty($entries)) {
            return ['applied' => false, 'reason' => 'empty_payload'];
        }

        $metadata = $incident->metadata ?? [];
        $metadata['evidence'] = array_values(array_merge($metadata['evidence'] ?? [], $entries));

        $incident->forceFill(['metadata' => $metadata])->save();

        IncidentEvent::create([
            'incident_id' => $incident->getKey(),
            'action' => 'quick_action.evidence',
            'notes' => 'Captured '.count($entries).' evidence artefacts.',
        ]);

        return [
            'applied' => true,
            'count' => count($entries),
        ];
    }
}

