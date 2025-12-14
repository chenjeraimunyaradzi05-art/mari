<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $interview_session_id
 * @property int $interview_question_id
 * @property string $answer
 * @property int $time_taken
 * @property numeric|null $score
 * @property array<array-key, mixed>|null $ai_analysis
 * @property array<array-key, mixed>|null $strengths
 * @property array<array-key, mixed>|null $weaknesses
 * @property array<array-key, mixed>|null $keywords_used
 * @property array<array-key, mixed>|null $keywords_missed
 * @property int $word_count
 * @property numeric|null $clarity_score
 * @property numeric|null $relevance_score
 * @property numeric|null $depth_score
 * @property numeric|null $confidence_score
 * @property string|null $improvement_tip
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read string $formatted_time
 * @property-read array $performance_metrics
 * @property-read string $score_badge
 * @property-read string $score_color
 * @property-read \App\Models\InterviewQuestion $question
 * @property-read \App\Models\InterviewSession $session
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereAiAnalysis($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereAnswer($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereClarityScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereConfidenceScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereDepthScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereImprovementTip($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereInterviewQuestionId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereInterviewSessionId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereKeywordsMissed($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereKeywordsUsed($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereRelevanceScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereScore($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereStrengths($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereTimeTaken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereWeaknesses($value)final
 * @method static \Illuminate\Database\Eloquent\Builder<static>|InterviewAnswer whereWordCount($value)
 *
 * @mixin \Eloquent
 */
final class InterviewAnswer extends Model
{
    protected $fillable = [
        'interview_session_id',
        'interview_question_id',
        'answer',
        'time_taken',
        'score',
        'ai_analysis',
        'strengths',
        'weaknesses',
        'keywords_used',
        'keywords_missed',
        'word_count',
        'clarity_score',
        'relevance_score',
        'depth_score',
        'confidence_score',
        'improvement_tip',
    ];

    protected $casts = [
        'time_taken' => 'integer',
        'score' => 'decimal:2',
        'ai_analysis' => 'array',
        'strengths' => 'array',
        'weaknesses' => 'array',
        'keywords_used' => 'array',
        'keywords_missed' => 'array',
        'word_count' => 'integer',
        'clarity_score' => 'decimal:2',
        'relevance_score' => 'decimal:2',
        'depth_score' => 'decimal:2',
        'confidence_score' => 'decimal:2',
    ];

    /**
     * Get the session
     */
    public function session(): BelongsTo
    {
        return $this->belongsTo(InterviewSession::class, 'interview_session_id');
    }

    /**
     * Get the question
     */
    public function question(): BelongsTo
    {
        return $this->belongsTo(InterviewQuestion::class, 'interview_question_id');
    }

    /**
     * Calculate word count from answer
     */
    public function calculateWordCount(): int
    {
        return str_word_count(strip_tags($this->answer));
    }

    /**
     * Get formatted time taken
     */
    public function getFormattedTimeAttribute(): string
    {
        $minutes = floor($this->time_taken / 60);
        $seconds = $this->time_taken % 60;

        if ($minutes > 0) {
            return "{$minutes}m {$seconds}s";
        }

        return "{$seconds}s";
    }

    /**
     * Get score color
     */
    public function getScoreColorAttribute(): string
    {
        if (! $this->score) {
            return '#6B7280';
        }

        return match (true) {
            $this->score >= 90 => '#10B981',
            $this->score >= 75 => '#3B82F6',
            $this->score >= 60 => '#F59E0B',
            $this->score >= 50 => '#EF4444',
            default => '#DC2626',
        };
    }

    /**
     * Get score badge
     */
    public function getScoreBadgeAttribute(): string
    {
        if (! $this->score) {
            return 'Not Scored';
        }

        return match (true) {
            $this->score >= 90 => 'Excellent',
            $this->score >= 75 => 'Very Good',
            $this->score >= 60 => 'Good',
            $this->score >= 50 => 'Fair',
            default => 'Poor',
        };
    }

    /**
     * Get overall performance metrics
     *
     * @return (int|numeric|string)[][]
     *
     * @psalm-return array{clarity: array{score: 0|numeric, label: 'Clarity', color: string}, relevance: array{score: 0|numeric, label: 'Relevance', color: string}, depth: array{score: 0|numeric, label: 'Depth', color: string}, confidence: array{score: 0|numeric, label: 'Confidence', color: string}}
     */
    public function getPerformanceMetricsAttribute(): array
    {
        return [
            'clarity' => [
                'score' => $this->clarity_score ?? 0,
                'label' => 'Clarity',
                'color' => $this->getMetricColor($this->clarity_score),
            ],
            'relevance' => [
                'score' => $this->relevance_score ?? 0,
                'label' => 'Relevance',
                'color' => $this->getMetricColor($this->relevance_score),
            ],
            'depth' => [
                'score' => $this->depth_score ?? 0,
                'label' => 'Depth',
                'color' => $this->getMetricColor($this->depth_score),
            ],
            'confidence' => [
                'score' => $this->confidence_score ?? 0,
                'label' => 'Confidence',
                'color' => $this->getMetricColor($this->confidence_score),
            ],
        ];
    }

    /**
     * Get metric color based on score
     */
    private function getMetricColor(?float $score): string
    {
        if (! $score) {
            return '#6B7280';
        }

        return match (true) {
            $score >= 80 => '#10B981',
            $score >= 60 => '#3B82F6',
            $score >= 40 => '#F59E0B',
            default => '#EF4444',
        };
    }
}
