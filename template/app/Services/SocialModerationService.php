<?php

namespace App\Services;

use App\Models\Admin;
use App\Models\SocialModerationEvent;
use App\Models\SocialPost;
use App\Models\SocialPostReport;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

final class SocialModerationService
{
    private \App\Services\TransparencyLogService $transparencyLogService;

    public function __construct(?\App\Services\TransparencyLogService $transparencyLogService = null)
    {
        $this->transparencyLogService = $transparencyLogService ?? app(\App\Services\TransparencyLogService::class);
    }
    public function requestReview(SocialPost $post, array $context = []): SocialModerationEvent
    {
        return DB::transaction(function () use ($post, $context) {
            $post->update([
                'moderation_status' => $context['target_status'] ?? 'pending_review',
            ]);

            $event = SocialModerationEvent::create([
                'social_post_id' => $post->id,
                'event_type' => 'review_requested',
                'actor_type' => $context['actor_type'] ?? 'system',
                'actor_id' => $context['actor_id'] ?? null,
                'payload' => $context,
            ]);

            Log::info('social.moderation.review_requested', [
                'post_id' => $post->id,
                'actor_type' => $event->actor_type,
                'actor_id' => $event->actor_id,
            ]);

            // Record metric/event for monitoring/observability
            app(\App\Services\RealTimeAnalyticsEngine::class)->record('moderation.request.created', [
                'properties' => [
                    'post_id' => $post->id,
                    'actor_type' => $event->actor_type,
                    'actor_id' => $event->actor_id,
                ],
            ]);

            return $event;
        });
    }

    public function recordDecision(SocialPost $post, string $decision, array $context = []): SocialModerationEvent
    {
        return DB::transaction(function () use ($post, $decision, $context) {
            $post->update([
                'moderation_status' => $decision,
                'published_at' => $decision === 'approved' ? ($post->published_at ?? now()) : $post->published_at,
            ]);

            if (!empty($context['report_ids'])) {
                SocialPostReport::query()
                    ->whereIn('id', (array) $context['report_ids'])
                    ->update([
                        'status' => $decision,
                        'reviewed_at' => now(),
                        'reviewer_id' => $context['reviewer_id'] ?? null,
                    ]);
            }

            $event = SocialModerationEvent::create([
                'social_post_id' => $post->id,
                'event_type' => 'decision_recorded',
                'actor_type' => $context['actor_type'] ?? 'moderator',
                'actor_id' => $context['actor_id'] ?? $context['reviewer_id'] ?? null,
                'payload' => array_merge($context, ['decision' => $decision]),
            ]);

            Log::info('social.moderation.decision_recorded', [
                'post_id' => $post->id,
                'decision' => $decision,
            ]);

            $this->transparencyLogService->recordDecision(
                action: 'social_moderation.decision',
                subject: $post,
                actor: $this->resolveReviewer($context['reviewer'] ?? null, $context['reviewer_id'] ?? null),
                context: [
                    'decision' => $decision,
                    'rationale' => $context['rationale'] ?? $context['reason'] ?? null,
                    'visibility' => $context['transparency_visibility'] ?? 'internal',
                    'metadata' => [
                        'report_ids' => $context['report_ids'] ?? [],
                        'actor_type' => $context['actor_type'] ?? 'moderator',
                    ],
                ]
            );

            return $event;
        });
    }

    protected function resolveReviewer($reviewer, ?int $reviewerId): ?Admin
    {
        if ($reviewer instanceof Admin) {
            return $reviewer;
        }

        if ($reviewerId) {
            return Admin::find($reviewerId);
        }

        return null;
    }
}

