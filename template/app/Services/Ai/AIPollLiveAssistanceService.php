<?php

namespace App\Services\Ai;

use App\Contracts\AI\TextModel;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * AI assistance for polls and live streams
 * Provides real-time content suggestions and engagement optimization
 */
class AIPollLiveAssistanceService
{


    /**
     * Suggest poll options based on topic/context
     */
    public function suggestPollOptions(string $topic, int $count = 4): array
    {
        $cacheKey = 'ai_poll_options:' . sha1($topic);

        return Cache::remember($cacheKey, $this->cacheTtl, function () use ($topic, $count) {
            try {
                $prompt = "You're helping women create engaging poll questions for a career-focused social platform.\n"
                    . "Topic: {$topic}\n\n"
                    . "Generate {$count} diverse, inclusive poll options as JSON:\n"
                    . '{"options": ["Option 1", "Option 2", "Option 3", "Option 4"]}' . "\n\n"
                    . "Make options:\n"
                    . "- Relevant to women's careers, education, or professional development\n"
                    . "- Respectful and inclusive\n"
                    . "- Concise (under 60 characters each)";

                $response = $this->textModel->generate($prompt, ['max_tokens' => 200]);
                $decoded = json_decode($response, true);

                if (is_array($decoded) && isset($decoded['options']) && is_array($decoded['options'])) {
                    return array_slice($decoded['options'], 0, $count);
                }

                return $this->fallbackPollOptions($topic, $count);

            } catch (\Throwable $e) {
                Log::warning('AI poll suggestion failed', ['error' => $e->getMessage()]);
                return $this->fallbackPollOptions($topic, $count);
            }
        });
    }

    /**
     * Generate live stream talking points
     */
    public function generateLiveStreamTalkingPoints(string $topic, ?string $profileType = null): array
    {
        $cacheKey = 'ai_live_points:' . sha1($topic . ($profileType ?? ''));

        return Cache::remember($cacheKey, $this->cacheTtl, function () use ($topic, $profileType) {
            try {
                $context = $profileType ? " for a {$profileType} audience" : '';

                $prompt = "You're helping prepare a live stream discussion{$context} on: {$topic}\n\n"
                    . "Generate 5 engaging talking points as JSON:\n"
                    . '{"points": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"]}' . "\n\n"
                    . "Focus on:\n"
                    . "- Women's career development and empowerment\n"
                    . "- Actionable insights and practical advice\n"
                    . "- Inclusive, supportive tone\n"
                    . "- Each point should be 1-2 sentences";

                $response = $this->textModel->generate($prompt, ['max_tokens' => 300]);
                $decoded = json_decode($response, true);

                if (is_array($decoded) && isset($decoded['points']) && is_array($decoded['points'])) {
                    return array_slice($decoded['points'], 0, 5);
                }

                return $this->fallbackTalkingPoints($topic);

            } catch (\Throwable $e) {
                Log::warning('AI live stream points failed', ['error' => $e->getMessage()]);
                return $this->fallbackTalkingPoints($topic);
            }
        });
    }

    /**
     * Suggest follow-up questions during live stream
     */
    public function suggestFollowUpQuestions(string $context, int $count = 3): array
    {
        try {
            $prompt = "During a live stream, someone said: \"{$context}\"\n\n"
                . "Generate {$count} thoughtful follow-up questions as JSON:\n"
                . '{"questions": ["Question 1?", "Question 2?", "Question 3?"]}' . "\n\n"
                . "Questions should:\n"
                . "- Encourage deeper discussion\n"
                . "- Be respectful and inclusive\n"
                . "- Relate to women's careers or professional growth\n"
                . "- Be open-ended (not yes/no)";

            $response = $this->textModel->generate($prompt, ['max_tokens' => 200]);
            $decoded = json_decode($response, true);

            if (is_array($decoded) && isset($decoded['questions']) && is_array($decoded['questions'])) {
                return array_slice($decoded['questions'], 0, $count);
            }

            return $this->fallbackFollowUpQuestions();

        } catch (\Throwable $e) {
            Log::warning('AI follow-up questions failed', ['error' => $e->getMessage()]);
            return $this->fallbackFollowUpQuestions();
        }
    }

    /**
     * Analyze poll results and generate insights
     *
     * @return (array|float|int|string)[]
     *
     * @psalm-return array{summary: string, insights: array, breakdown?: list{0?: string,...}, total_votes?: float|int}
     */
    public function analyzePollResults(array $pollData): array
    {
        try {
            $pollData['question'] ?? 'Poll';
            $options = $pollData['options'] ?? [];
            $results = $pollData['results'] ?? [];

            $totalVotes = array_sum($results);
            if ($totalVotes === 0) {
                return [
                    'summary' => 'No votes yet. Share this poll to get community insights!',
                    'insights' => [],
                ];
            }

            // Calculate percentages
            $breakdown = [];
            foreach ($options as $index => $option) {
                $votes = $results[$index] ?? 0;
                $percentage = round(($votes / $totalVotes) * 100, 1);
                $breakdown[] = "{$option}: {$percentage}% ({$votes} votes)";
            }

            // Find winner
            $maxVotes = max($results);
            $winnerIndex = array_search($maxVotes, $results);
            $winner = $options[$winnerIndex] ?? 'Unknown';

            $summary = "'{$winner}' is leading with " . round(($maxVotes / $totalVotes) * 100, 1) . "% of {$totalVotes} votes.";

            return [
                'summary' => $summary,
                'breakdown' => $breakdown,
                'total_votes' => $totalVotes,
                'insights' => $this->generatePollInsights($pollData, $breakdown),
            ];

        } catch (\Throwable $e) {
            Log::warning('Poll analysis failed', ['error' => $e->getMessage()]);
            return [
                'summary' => 'Poll results available',
                'insights' => [],
            ];
        }
    }

    /**
     * Fallback poll options
     *
     * @return string[]
     *
     * @psalm-return list<'Neutral'|'Somewhat agree'|'Somewhat disagree'|'Strongly agree'|'Strongly disagree'>
     */
    private function fallbackPollOptions(string $topic, int $count): array
    {
        $generic = [
            'Strongly agree',
            'Somewhat agree',
            'Neutral',
            'Somewhat disagree',
            'Strongly disagree',
        ];

        return array_slice($generic, 0, $count);
    }

    /**
     * Fallback talking points
     *
     * @return string[]
     *
     * @psalm-return list{string, 'Key challenges and how to overcome them', 'Success stories and real-world examples', 'Practical tips you can apply today', 'Q&A: Your questions answered'}
     */
    private function fallbackTalkingPoints(string $topic): array
    {
        return [
            "Introduction: What is {$topic} and why does it matter?",
            "Key challenges and how to overcome them",
            "Success stories and real-world examples",
            "Practical tips you can apply today",
            "Q&A: Your questions answered",
        ];
    }

    /**
     * Fallback follow-up questions
     *
     * @return string[]
     *
     * @psalm-return list{'Can you share more about your experience with that?', 'What advice would you give to someone starting out?', 'How did you overcome challenges along the way?'}
     */
    private function fallbackFollowUpQuestions(): array
    {
        return [
            'Can you share more about your experience with that?',
            'What advice would you give to someone starting out?',
            'How did you overcome challenges along the way?',
        ];
    }

    /**
     * Generate insights from poll results
     *
     * @return string[]
     *
     * @psalm-return list{0?: 'Strong consensus emerging from the community.'|'This is a close race! The community is divided on this topic.', 1?: 'Strong consensus emerging from the community.'}
     */
    private function generatePollInsights(array $pollData, array $breakdown): array
    {
        $insights = [];
        $results = $pollData['results'] ?? [];
        $pollData['options'] ?? [];

        // Check for close race
        $sortedResults = $results;
        rsort($sortedResults);
        if (count($sortedResults) >= 2) {
            $diff = $sortedResults[0] - $sortedResults[1];
            $total = array_sum($results);

            if ($total > 0 && ($diff / $total) < 0.1) {
                $insights[] = 'This is a close race! The community is divided on this topic.';
            }
        }

        // Check for consensus
        if (count($results) > 0) {
            $maxPercentage = (max($results) / array_sum($results)) * 100;
            if ($maxPercentage > 70) {
                $insights[] = 'Strong consensus emerging from the community.';
            }
        }

        return $insights;
    }
}

