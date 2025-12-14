<?php

namespace App\Services;

use App\Models\Candidate;
use App\Models\InterviewAnswer;
use App\Models\InterviewQuestion;
use App\Models\InterviewSession;
use App\Models\InterviewQuestionTopic;
use Illuminate\Support\Collection;

final class InterviewCoachService
{
    /**
     * Create a new interview session
     */
    public function createSession(
        Candidate $candidate,
        string $sessionType,
        string $difficulty,
        ?int $jobCategoryId = null,
        ?int $jobRoleId = null,
        ?array $topics = null,
        int $questionCount = 5
    ): InterviewSession {
        // Determine title based on session type
        $title = $this->generateSessionTitle($sessionType, $difficulty, $jobRoleId);

        // Create session
        $session = InterviewSession::create([
            'candidate_id' => $candidate->id,
            'title' => $title,
            'session_type' => $sessionType,
            'job_category_id' => $jobCategoryId,
            'job_role_id' => $jobRoleId,
            'difficulty' => $difficulty,
            'total_questions' => $questionCount,
            'started_at' => now(),
        ]);

        return $session;
    }

    /**
     * Generate session title
     */
    private function generateSessionTitle(string $sessionType, string $difficulty, ?int $jobRoleId): string
    {
        $difficultyLabel = ucfirst($difficulty);

        $typeLabel = match($sessionType) {
            'quick_practice' => 'Quick Practice',
            'full_mock' => 'Full Mock Interview',
            'focused_topic' => 'Focused Topic Practice',
            'custom' => 'Custom Practice',
            default => 'Practice Session',
        };

        if ($jobRoleId) {
            $role = \App\Models\JobRole::find($jobRoleId);
            return "{$difficultyLabel} {$role->name} - {$typeLabel}";
        }

        return "{$difficultyLabel} Level - {$typeLabel}";
    }

    /**
     * Get random questions for session
     *
     * @psalm-return \Illuminate\Database\Eloquent\Collection<int, InterviewQuestion>
     */
    public function getQuestionsForSession(
        InterviewSession $session,
        ?array $topicIds = null,
        ?array $types = null
    ): \Illuminate\Database\Eloquent\Collection {
        $query = InterviewQuestion::active()
            ->where('difficulty', $session->difficulty);

        // Filter by category if provided
        if ($session->job_category_id) {
            $query->where('job_category_id', $session->job_category_id);
        }

        // Filter by role if provided
        if ($session->job_role_id) {
            $query->where('job_role_id', $session->job_role_id);
        }

        // Filter by topics if provided
        if ($topicIds) {
            $query->whereHas('topics', function($q) use ($topicIds) {
                $q->whereIn('interview_question_topics.id', $topicIds);
            });
        }

        // Filter by types if provided
        if ($types) {
            $query->whereIn('type', $types);
        }

        // Get random questions
        return $query->inRandomOrder()
            ->limit($session->total_questions)
            ->get();
    }

    /**
     * Submit an answer and get AI feedback
     */
    public function submitAnswer(
        InterviewSession $session,
        InterviewQuestion $question,
        string $answer,
        int $timeTaken
    ): InterviewAnswer {
        // Calculate word count
        $wordCount = str_word_count(strip_tags($answer));

        // Get AI analysis
        $analysis = $this->analyzeAnswer($question, $answer);

        // Create answer record
        $answerRecord = InterviewAnswer::create([
            'interview_session_id' => $session->id,
            'interview_question_id' => $question->id,
            'answer' => $answer,
            'time_taken' => $timeTaken,
            'word_count' => $wordCount,
            'score' => $analysis['score'],
            'ai_analysis' => $analysis['analysis'],
            'strengths' => $analysis['strengths'],
            'weaknesses' => $analysis['weaknesses'],
            'keywords_used' => $analysis['keywords_used'],
            'keywords_missed' => $analysis['keywords_missed'],
            'clarity_score' => $analysis['clarity_score'],
            'relevance_score' => $analysis['relevance_score'],
            'depth_score' => $analysis['depth_score'],
            'confidence_score' => $analysis['confidence_score'],
            'improvement_tip' => $analysis['improvement_tip'],
        ]);

        // Update session progress
        $session->increment('answered_questions');
        $session->increment('total_time_spent', $timeTaken);

        // Update question usage stats
        $question->incrementUsage();
        $question->updateAverageScore($analysis['score']);

        return $answerRecord;
    }

    /**
     * Analyze answer with AI
     *
     * @return ((int|mixed|string)[]|float|string)[]
     *
     * @psalm-return array{score: float, analysis: array{overall_assessment: string, keyword_coverage: string, word_count: int, time_efficiency: 'Good'}, strengths: list{0?: string, 1?: 'Addressed key points effectively'|'Demonstrated confidence'|'Provided detailed explanation', 2?: 'Demonstrated confidence'|'Provided detailed explanation', 3?: 'Demonstrated confidence'}, weaknesses: list{0?: string, 1?: string, 2?: 'Could provide more detailed examples'|'Try to sound more confident and assertive', 3?: 'Try to sound more confident and assertive'}, keywords_used: list<mixed>, keywords_missed: list<mixed>, clarity_score: float, relevance_score: float, depth_score: float, confidence_score: float, improvement_tip: string}
     */
    private function analyzeAnswer(InterviewQuestion $question, string $answer): array
    {
        // Simulated AI analysis - In production, this would call OpenAI/Gemini API
        $wordCount = str_word_count(strip_tags($answer));
        $answerLower = strtolower($answer);

        // Check for keywords
        $keywordsUsed = [];
        $keywordsMissed = [];

        if ($question->keywords) {
            foreach ($question->keywords as $keyword) {
                if (str_contains($answerLower, strtolower($keyword))) {
                    $keywordsUsed[] = $keyword;
                } else {
                    $keywordsMissed[] = $keyword;
                }
            }
        }

        // Calculate scores based on various factors
        $keywordScore = count($question->keywords ?? []) > 0
            ? (count($keywordsUsed) / count($question->keywords)) * 100
            : 70;

         // 100 words = 100%
        $clarityScore = $this->calculateClarityScore($answer);
        $relevanceScore = $keywordScore; // Simplified
        $depthScore = min(100, ($wordCount / 150) * 100); // 150 words for full depth
        $confidenceScore = $this->calculateConfidenceScore($answer);

        // Overall score (weighted average)
        $overallScore = (
            $clarityScore * 0.25 +
            $relevanceScore * 0.30 +
            $depthScore * 0.25 +
            $confidenceScore * 0.20
        );

        // Determine strengths and weaknesses
        $strengths = [];
        $weaknesses = [];

        if ($clarityScore >= 75) {
            $strengths[] = 'Clear and well-structured answer';
        } else {
            $weaknesses[] = 'Could be more clear and structured';
        }

        if ($relevanceScore >= 75) {
            $strengths[] = 'Addressed key points effectively';
        } else {
            $weaknesses[] = 'Missed some important keywords: ' . implode(', ', array_slice($keywordsMissed, 0, 3));
        }

        if ($depthScore >= 75) {
            $strengths[] = 'Provided detailed explanation';
        } else {
            $weaknesses[] = 'Could provide more detailed examples';
        }

        if ($confidenceScore >= 75) {
            $strengths[] = 'Demonstrated confidence';
        } else {
            $weaknesses[] = 'Try to sound more confident and assertive';
        }

        // Generate improvement tip
        $improvementTip = $this->generateImprovementTip($overallScore, $weaknesses, $keywordsMissed);

        return [
            'score' => round($overallScore, 2),
            'analysis' => [
                'overall_assessment' => $this->getAssessmentMessage($overallScore),
                'keyword_coverage' => count($keywordsUsed) . '/' . count($question->keywords ?? []),
                'word_count' => $wordCount,
                'time_efficiency' => 'Good', // Could be calculated based on time vs word count
            ],
            'strengths' => $strengths,
            'weaknesses' => $weaknesses,
            'keywords_used' => $keywordsUsed,
            'keywords_missed' => $keywordsMissed,
            'clarity_score' => round($clarityScore, 2),
            'relevance_score' => round($relevanceScore, 2),
            'depth_score' => round($depthScore, 2),
            'confidence_score' => round($confidenceScore, 2),
            'improvement_tip' => $improvementTip,
        ];
    }

    /**
     * Calculate clarity score based on sentence structure
     */
    private function calculateClarityScore(string $answer): float
    {
        $sentences = preg_split('/[.!?]+/', $answer, -1, PREG_SPLIT_NO_EMPTY);
        $sentenceCount = count($sentences);

        if ($sentenceCount === 0) {
            return 0;
        }

        $avgWordsPerSentence = str_word_count($answer) / $sentenceCount;

        // Ideal: 15-20 words per sentence
        if ($avgWordsPerSentence >= 15 && $avgWordsPerSentence <= 20) {
            $clarityScore = 100;
        } elseif ($avgWordsPerSentence < 15) {
            $clarityScore = max(50, ($avgWordsPerSentence / 15) * 100);
        } else {
            $clarityScore = max(50, 100 - (($avgWordsPerSentence - 20) * 2));
        }

        return $clarityScore;
    }

    /**
     * Calculate confidence score based on language patterns
     *
     * @psalm-return int<50, 100>
     */
    private function calculateConfidenceScore(string $answer): int
    {
        $answerLower = strtolower($answer);
        $confidenceScore = 70; // Base score

        // Positive indicators
        $positiveWords = ['definitely', 'certainly', 'confident', 'successfully', 'achieved', 'accomplished', 'led', 'managed'];
        foreach ($positiveWords as $word) {
            if (str_contains($answerLower, $word)) {
                $confidenceScore += 5;
            }
        }

        // Negative indicators
        $negativeWords = ['maybe', 'might', 'perhaps', 'i think', 'i guess', 'probably', 'not sure'];
        foreach ($negativeWords as $word) {
            if (str_contains($answerLower, $word)) {
                $confidenceScore -= 10;
            }
        }

        return max(0, min(100, $confidenceScore));
    }

    /**
     * Get assessment message based on score
     */
    private function getAssessmentMessage(float $score): string
    {
        return match(true) {
            $score >= 90 => 'Excellent answer! You demonstrated strong understanding and provided comprehensive details.',
            $score >= 75 => 'Very good answer! You covered the main points well with room for minor improvements.',
            $score >= 60 => 'Good answer! You addressed the question but could add more depth and examples.',
            $score >= 50 => 'Fair answer. Consider providing more specific examples and addressing all key points.',
            default => 'Needs improvement. Focus on understanding the question better and providing more relevant details.',
        };
    }

    /**
     * Generate improvement tip
     */
    private function generateImprovementTip(float $score, array $weaknesses, array $keywordsMissed): string
    {
        if ($score >= 90) {
            return 'Great job! Keep practicing to maintain this level of performance.';
        }

        if (!empty($keywordsMissed)) {
            return 'Try to incorporate these important keywords in your answer: ' . implode(', ', array_slice($keywordsMissed, 0, 3)) . '.';
        }

        if (!empty($weaknesses)) {
            return $weaknesses[0] . '. ' . $this->getSpecificTip($weaknesses[0]);
        }

        return 'Focus on providing more specific examples from your experience.';
    }

    /**
     * Get specific improvement tip based on weakness
     */
    private function getSpecificTip(string $weakness): string
    {
        if (str_contains($weakness, 'clear')) {
            return 'Use the STAR method (Situation, Task, Action, Result) to structure your answer.';
        }

        if (str_contains($weakness, 'detailed')) {
            return 'Provide specific numbers, metrics, or outcomes to strengthen your answer.';
        }

        if (str_contains($weakness, 'confident')) {
            return 'Use assertive language like "I successfully..." instead of "I think..." or "Maybe...".';
        }

        if (str_contains($weakness, 'keywords')) {
            return 'Research common terminology in your field and incorporate it naturally.';
        }

        return 'Practice more to improve your interview skills.';
    }

    /**
     * Complete session and generate final feedback
     */
    public function completeSession(InterviewSession $session): void
    {
        $answers = $session->answers;

        if ($answers->isEmpty()) {
            return;
        }

        // Calculate overall score
        $overallScore = $answers->avg('score');

        // Gather all strengths and weaknesses
        $allStrengths = [];
        $allWeaknesses = [];
        $topicFrequency = [];

        foreach ($answers as $answer) {
            if ($answer->strengths) {
                $allStrengths = array_merge($allStrengths, $answer->strengths);
            }
            if ($answer->weaknesses) {
                $allWeaknesses = array_merge($allWeaknesses, $answer->weaknesses);
            }

            // Track keywords for topic recommendations
            if ($answer->keywords_missed) {
                foreach ($answer->keywords_missed as $keyword) {
                    $topicFrequency[$keyword] = ($topicFrequency[$keyword] ?? 0) + 1;
                }
            }
        }

        // Get most common strengths and weaknesses
        $strengthCounts = array_count_values($allStrengths);
        arsort($strengthCounts);
        $topStrengths = array_slice(array_keys($strengthCounts), 0, 5);

        $weaknessCounts = array_count_values($allWeaknesses);
        arsort($weaknessCounts);
        $topWeaknesses = array_slice(array_keys($weaknessCounts), 0, 5);

        // Get recommended topics
        arsort($topicFrequency);
        $recommendedTopics = array_slice(array_keys($topicFrequency), 0, 5);

        // Generate AI feedback
        $aiFeedback = [
            'summary' => $this->generateSessionSummary($overallScore, $session->answered_questions),
            'performance_trend' => $this->analyzePerformanceTrend($answers),
            'time_management' => $this->analyzeTimeManagement($session, $answers),
            'recommendations' => $this->generateRecommendations($overallScore, $topWeaknesses),
        ];

        // Update session
        $session->update([
            'status' => 'completed',
            'completed_at' => now(),
            'overall_score' => round($overallScore, 2),
            'ai_feedback' => $aiFeedback,
            'strengths' => $topStrengths,
            'improvements' => $topWeaknesses,
            'recommended_topics' => $recommendedTopics,
        ]);
    }

    /**
     * Generate session summary
     */
    private function generateSessionSummary(float $score, int $questionCount): string
    {
        $level = match(true) {
            $score >= 90 => 'exceptional',
            $score >= 75 => 'strong',
            $score >= 60 => 'good',
            $score >= 50 => 'fair',
            default => 'developing',
        };

        return "You completed {$questionCount} questions with a {$level} performance level. Your overall score of " . round($score, 1) . "% indicates " . $this->getPerformanceInsight($score) . ".";
    }

    /**
     * Get performance insight
     */
    private function getPerformanceInsight(float $score): string
    {
        return match(true) {
            $score >= 90 => 'you are well-prepared and demonstrate excellent interview skills',
            $score >= 75 => 'you have solid interview skills with room for refinement',
            $score >= 60 => 'you have good foundational skills that can be strengthened',
            $score >= 50 => 'you would benefit from more focused practice',
            default => 'you should focus on building core interview skills',
        };
    }

    /**
     * Analyze performance trend across answers
     */
    private function analyzePerformanceTrend(Collection $answers): string
    {
        if ($answers->count() < 3) {
            return 'Not enough data to analyze trend';
        }

        $scores = $answers->pluck('score')->toArray();
        $firstHalf = array_slice($scores, 0, ceil(count($scores) / 2));
        $secondHalf = array_slice($scores, ceil(count($scores) / 2));

        $firstAvg = array_sum($firstHalf) / count($firstHalf);
        $secondAvg = array_sum($secondHalf) / count($secondHalf);

        $difference = $secondAvg - $firstAvg;

        if ($difference > 10) {
            return 'Improving - Your performance got better as the session progressed';
        } elseif ($difference < -10) {
            return 'Declining - Consider taking breaks during longer sessions';
        } else {
            return 'Consistent - You maintained steady performance throughout';
        }
    }

    /**
     * Analyze time management
     *
     * @psalm-return 'Good time management. You balanced speed with thoroughness.'|'You answered quickly. Consider taking more time to provide detailed responses.'|'You used most of the allotted time. Work on being more concise while maintaining quality.'
     */
    private function analyzeTimeManagement(InterviewSession $session, Collection $answers): string
    {
        $avgTime = $answers->avg('time_taken');
        $timeLimit = $answers->first()->question->time_limit ?? 300;

        $efficiency = ($avgTime / $timeLimit) * 100;

        if ($efficiency < 50) {
            return 'You answered quickly. Consider taking more time to provide detailed responses.';
        } elseif ($efficiency > 90) {
            return 'You used most of the allotted time. Work on being more concise while maintaining quality.';
        } else {
            return 'Good time management. You balanced speed with thoroughness.';
        }
    }

    /**
     * Generate recommendations
     *
     * @return string[]
     *
     * @psalm-return list{0: string, 1?: string, 2?: string,...}
     */
    private function generateRecommendations(float $score, array $weaknesses): array
    {
        $recommendations = [];

        if ($score < 60) {
            $recommendations[] = 'Practice more basic interview questions to build confidence';
            $recommendations[] = 'Study the STAR method for behavioral questions';
        }

        if (!empty($weaknesses)) {
            foreach (array_slice($weaknesses, 0, 3) as $weakness) {
                if (str_contains($weakness, 'keywords')) {
                    $recommendations[] = 'Research industry-specific terminology and practice using it';
                } elseif (str_contains($weakness, 'detailed')) {
                    $recommendations[] = 'Prepare specific examples with metrics and outcomes';
                } elseif (str_contains($weakness, 'confident')) {
                    $recommendations[] = 'Practice in front of a mirror to build confidence';
                }
            }
        }

        if (empty($recommendations)) {
            $recommendations[] = 'Continue practicing to maintain your strong performance';
            $recommendations[] = 'Try more challenging questions to push your skills';
        }

        return $recommendations;
    }

    /**
     * Get candidate statistics
     *
     * @return (array|int|mixed)[]
     *
     * @psalm-return array{total_sessions: mixed, completed_sessions: mixed, total_questions_answered: mixed, total_practice_time: mixed, average_score: 0|mixed, highest_score: 0|mixed, recent_sessions: mixed, performance_by_difficulty: array, performance_by_type: array}
     */
    public function getCandidateStats(Candidate $candidate): array
    {
        $sessions = InterviewSession::where('candidate_id', $candidate->id)->get();
        $completedSessions = $sessions->where('status', 'completed');

        return [
            'total_sessions' => $sessions->count(),
            'completed_sessions' => $completedSessions->count(),
            'total_questions_answered' => $completedSessions->sum('answered_questions'),
            'total_practice_time' => $completedSessions->sum('total_time_spent'),
            'average_score' => $completedSessions->avg('overall_score') ?? 0,
            'highest_score' => $completedSessions->max('overall_score') ?? 0,
            'recent_sessions' => $sessions->sortByDesc('created_at')->take(5),
            'performance_by_difficulty' => $this->getPerformanceByDifficulty($completedSessions),
            'performance_by_type' => $this->getPerformanceByType($completedSessions),
        ];
    }

    /**
     * Get performance by difficulty
     *
     * @return (float|int)[]
     *
     * @psalm-return array{entry: float|int, mid: float|int, senior: float|int, executive: float|int}
     */
    private function getPerformanceByDifficulty(Collection $sessions): array
    {
        return [
            'entry' => $sessions->where('difficulty', 'entry')->avg('overall_score') ?? 0,
            'mid' => $sessions->where('difficulty', 'mid')->avg('overall_score') ?? 0,
            'senior' => $sessions->where('difficulty', 'senior')->avg('overall_score') ?? 0,
            'executive' => $sessions->where('difficulty', 'executive')->avg('overall_score') ?? 0,
        ];
    }

    /**
     * Get performance by session type
     *
     * @return (float|int)[]
     *
     * @psalm-return array{quick_practice: float|int, full_mock: float|int, focused_topic: float|int, custom: float|int}
     */
    private function getPerformanceByType(Collection $sessions): array
    {
        return [
            'quick_practice' => $sessions->where('session_type', 'quick_practice')->avg('overall_score') ?? 0,
            'full_mock' => $sessions->where('session_type', 'full_mock')->avg('overall_score') ?? 0,
            'focused_topic' => $sessions->where('session_type', 'focused_topic')->avg('overall_score') ?? 0,
            'custom' => $sessions->where('session_type', 'custom')->avg('overall_score') ?? 0,
        ];
    }
}

