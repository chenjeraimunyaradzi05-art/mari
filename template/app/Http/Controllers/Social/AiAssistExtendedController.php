<?php

namespace App\Http\Controllers\Social;

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
     * Generate live stream talking points
     */
    public function liveStreamTalkingPoints(Request $request): JsonResponse
    {
        $data = $request->validate([
            'topic' => ['required', 'string', 'max:200'],
            'profile_type' => ['nullable', 'string', 'max:50'],
        ]);

        $points = $this->fallbackService->executeWithFallback(
            'live_talking_points',
            fn() => $this->pollLiveService->generateLiveStreamTalkingPoints(
                $data['topic'],
                $data['profile_type'] ?? null
            ),
            fn() => ["Introduction to {$data['topic']}", 'Key insights', 'Practical tips', 'Q&A session'],
            $data
        );

        return response()->json([
            'success' => true,
            'talking_points' => $points,
        ]);
    }

    /**
     * Suggest follow-up questions for live stream
     */
    public function liveStreamFollowUp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'context' => ['required', 'string', 'max:500'],
            'count' => ['sometimes', 'integer', 'min:1', 'max:5'],
        ]);

        $questions = $this->pollLiveService->suggestFollowUpQuestions(
            $data['context'],
            $data['count'] ?? 3
        );

        return response()->json([
            'success' => true,
            'questions' => $questions,
        ]);
    }

    /**
     * Analyze poll results with AI insights
     */
    public function analyzePollResults(Request $request): JsonResponse
    {
        $data = $request->validate([
            'question' => ['required', 'string'],
            'options' => ['required', 'array'],
            'results' => ['required', 'array'],
        ]);

        $analysis = $this->pollLiveService->analyzePollResults($data);

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
        if ($media->post && $media->post->user_id !== $request->user()->id) {
            abort(403, 'Unauthorized to caption this video');
        }

        $result = $this->fallbackService->executeWithFallback(
            'video_captions',
            fn() => $this->videoCaptionService->generateCaptions($media),
            fn() => ['message' => 'Captions will be generated in the background'],
            ['media_id' => $media->id]
        );

        return response()->json([
            'success' => true,
            'captions' => $result,
        ]);
    }

    /**
     * Get AI-enhanced mentor recommendations
     */
    public function mentorRecommendations(Request $request): JsonResponse
    {
        $data = $request->validate([
            'limit' => ['sometimes', 'integer', 'min:1', 'max:10'],
        ]);

        $user = $request->user();
        $limit = $data['limit'] ?? 5;

        $recommendations = $this->fallbackService->executeWithFallback(
            'mentor_match',
            fn() => $this->mentorService->getEnhancedMentorRecommendations($user, $limit),
            fn() => [],
            ['user_id' => $user->id, 'limit' => $limit]
        );

        return response()->json([
            'success' => true,
            'recommendations' => $recommendations,
        ]);
    }

    /**
     * Get AI service health status
     */
    public function healthCheck(): JsonResponse
    {
        $health = $this->fallbackService->checkHealth();
        $stats = $this->fallbackService->getRateLimitStats();

        return response()->json([
            'health' => $health,
            'stats' => $stats,
        ]);
    }
}
