<?php

namespace App\Http\Controllers\Frontend\Social;

use App\Http\Controllers\Controller;
use App\Services\Ai\AIPollLiveAssistanceService;
use App\Services\Ai\AIVideoCaptioningService;
use App\Services\Ai\AIMentorMatchingService;
use App\Services\Ai\AIRateLimitFallbackService;
use App\Models\SocialMedia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Extended AI assistance controller for advanced features
 */
final class AiAssistExtendedController extends Controller
{
    public function __construct(
        private readonly AIPollLiveAssistanceService $pollLiveService,
        private readonly AIVideoCaptioningService $videoCaptionService,
        private readonly AIMentorMatchingService $mentorService,
        private readonly AIRateLimitFallbackService $fallbackService
    ) {
    }

    /**
     * Generate poll options based on topic
     */
    public function pollSuggestions(Request $request): JsonResponse
    {
        $data = $request->validate([
            'topic' => ['required', 'string', 'max:200'],
            'count' => ['sometimes', 'integer', 'min:2', 'max:6'],
        ]);

        $topic = $data['topic'];
        $count = $data['count'] ?? 4;

        $options = $this->fallbackService->executeWithFallback(
            'poll_suggestions',
            fn() => $this->pollLiveService->suggestPollOptions($topic, $count),
            fn() => ['Yes', 'No', 'Maybe', 'Not sure'],
            ['topic' => $topic, 'count' => $count]
        );

        return response()->json([
            'success' => true,
            'options' => $options,
        ]);
    }

    /**
     * Generate talking points for live stream
     */
    public function liveStreamTalkingPoints(Request $request): JsonResponse
    {
        $data = $request->validate([
            'topic' => ['required', 'string', 'max:200'],
            'duration_minutes' => ['sometimes', 'integer', 'min:5', 'max:120'],
            'profile_type' => ['sometimes', 'string', 'in:professional,casual,educational'],
        ]);

        $topic = $data['topic'];
        $durationMinutes = $data['duration_minutes'] ?? 30;
        $profileType = $data['profile_type'] ?? 'professional';

        $talkingPoints = $this->fallbackService->executeWithFallback(
            'live_talking_points',
            fn() => $this->pollLiveService->generateLiveStreamTalkingPoints($topic, $durationMinutes, $profileType),
            fn() => [
                'Introduction: Welcome everyone to the stream',
                'Main Topic: Discuss ' . $topic,
                'Q&A: Take questions from viewers',
                'Wrap up: Thank viewers for joining',
            ],
            ['topic' => $topic, 'duration' => $durationMinutes, 'profile_type' => $profileType]
        );

        return response()->json([
            'success' => true,
            'talking_points' => $talkingPoints,
        ]);
    }

    /**
     * Generate follow-up questions for live stream
     */
    public function liveStreamFollowUp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'discussion_summary' => ['required', 'string', 'max:2000'],
        ]);

        $summary = $data['discussion_summary'];

        $questions = $this->fallbackService->executeWithFallback(
            'live_follow_up',
            fn() => $this->pollLiveService->suggestFollowUpQuestions($summary),
            fn() => [
                'What are your thoughts on this topic?',
                'Has anyone experienced this before?',
                'What would you like to know more about?',
            ],
            ['summary' => $summary]
        );

        return response()->json([
            'success' => true,
            'follow_up_questions' => $questions,
        ]);
    }

    /**
     * Analyze poll results
     */
    public function analyzePollResults(Request $request): JsonResponse
    {
        $data = $request->validate([
            'question' => ['required', 'string', 'max:500'],
            'results' => ['required', 'array'],
            'results.*.option' => ['required', 'string'],
            'results.*.votes' => ['required', 'integer', 'min:0'],
        ]);

        $question = $data['question'];
        $results = $data['results'];

        $analysis = $this->fallbackService->executeWithFallback(
            'poll_analysis',
            fn() => $this->pollLiveService->analyzePollResults($question, $results),
            fn() => [
                'insights' => 'Poll results show diverse opinions',
                'top_choice' => $results[0]['option'] ?? 'N/A',
                'engagement_level' => 'moderate',
            ],
            ['question' => $question, 'results' => $results]
        );

        return response()->json([
            'success' => true,
            'analysis' => $analysis,
        ]);
    }

    /**
     * Generate captions for video
     */
    public function generateVideoCaptions(Request $request): JsonResponse
    {
        $data = $request->validate([
            'media_id' => ['required', 'integer', 'exists:social_media,id'],
        ]);

        $media = SocialMedia::findOrFail($data['media_id']);

        // Check authorization
        if ($media->user_id !== auth()->id()) {
            return response()->json([
                'success' => false,
                'error' => 'Unauthorized',
            ], 403);
        }

        // Check if media is video
        if (!str_starts_with($media->mime_type ?? '', 'video/')) {
            return response()->json([
                'success' => false,
                'error' => 'Media must be a video',
            ], 422);
        }

        $result = $this->fallbackService->executeWithFallback(
            'video_captions',
            fn() => $this->videoCaptionService->generateCaptions($media),
            fn() => [
                'success' => false,
                'error' => 'Caption generation unavailable',
            ],
            ['media_id' => $media->id]
        );

        return response()->json($result);
    }

    /**
     * Get mentor recommendations for user
     */
    public function mentorRecommendations(Request $request): JsonResponse
    {
        $data = $request->validate([
            'limit' => ['sometimes', 'integer', 'min:1', 'max:20'],
        ]);

        $limit = $data['limit'] ?? 5;

        $recommendations = $this->fallbackService->executeWithFallback(
            'mentor_recommendations',
            fn() => $this->mentorService->getEnhancedMentorRecommendations(auth()->user(), $limit),
            fn() => [],
            ['user_id' => auth()->id(), 'limit' => $limit]
        );

        return response()->json([
            'success' => true,
            'recommendations' => $recommendations,
        ]);
    }

    /**
     * Check AI service health
     */
    public function healthCheck(): JsonResponse
    {
        $health = $this->fallbackService->checkHealth();

        return response()->json($health);
    }
}

