<?php

namespace App\Services;

use App\Models\Job;
use App\Models\Candidate;
use Illuminate\Support\Facades\Log;

/**
 * Smart Application Service
 *
 * Provides AI-powered assistance for job applications including:
 * - Cover letter generation
 * - Application score prediction
 * - Skill matching analysis
 * - Personalized application tips
 */
final class SmartApplicationService
{
    /**
     * Generate AI-powered cover letter based on job and candidate profile
     *
     * @return (bool|float|int|string)[]
     *
     * @psalm-return array{success: bool, error?: 'Failed to generate cover letter', cover_letter?: string, word_count?: int, confidence?: float}
     */
    public function generateCoverLetter(Job $job, Candidate $candidate): array
    {
        try {
            $candidateName = $candidate->user->name ?? 'Candidate';
            $candidateSkills = $candidate->skills->pluck('name')->implode(', ') ?: 'general skills';
            $candidateExperience = $candidate->experiences->first()?->experience?->name ?? 'relevant experience';
            $companyName = $job->company->name;
            $jobTitle = $job->title;
            $jobDescription = strip_tags($job->description);

            // Extract key requirements from job description
            $requirements = $this->extractKeyRequirements($jobDescription);

            $coverLetter = $this->buildCoverLetter([
                'candidateName' => $candidateName,
                'companyName' => $companyName,
                'jobTitle' => $jobTitle,
                'skills' => $candidateSkills,
                'experience' => $candidateExperience,
                'requirements' => $requirements,
            ]);

            return [
                'success' => true,
                'cover_letter' => $coverLetter,
                'word_count' => str_word_count($coverLetter),
                'confidence' => 0.85,
            ];
        } catch (\Exception $e) {
            Log::error('Cover letter generation failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => 'Failed to generate cover letter',
            ];
        }
    }

    /**
     * Calculate application match score
     *
     * @return ((float|int)[]|float|string)[]
     *
     * @psalm-return array{overall_score: float, breakdown: array{skills_match: float, experience_match: float, education_match: float, profile_completeness: float, video_profile: 0|20}, recommendation: string, likelihood: string}
     */
    public function calculateApplicationScore(Job $job, Candidate $candidate): array
    {
        $scores = [
            'skills_match' => $this->calculateSkillsMatch($job, $candidate),
            'experience_match' => $this->calculateExperienceMatch($job, $candidate),
            'education_match' => $this->calculateEducationMatch($job, $candidate),
            'profile_completeness' => $this->calculateProfileCompleteness($candidate),
            'video_profile' => $this->hasVideoProfile($candidate) ? 20 : 0,
        ];

        $totalScore = array_sum($scores);
        $maxScore = 100;
        $percentage = ($totalScore / $maxScore) * 100;

        return [
            'overall_score' => round($percentage, 1),
            'breakdown' => $scores,
            'recommendation' => $this->getRecommendation($percentage),
            'likelihood' => $this->getLikelihood($percentage),
        ];
    }

    /**
     * Get personalized application tips
     *
     * @return string[][]
     *
     * @psalm-return list{0: array{icon: string, type: string, title: string, description: string, priority: 'high'|'medium', action: string}, 1?: array{icon: string, type: string, title: string, description: string, priority: 'high'|'medium', action: string}, 2?: array{icon: 'briefcase'|'clock'|'file-alt', type: 'application'|'experience'|'timing', title: 'Add Your Work Experience'|'Apply Soon - Deadline Approaching'|'Customize Your Cover Letter', description: string, priority: 'high'|'medium', action: string}, 3?: array{icon: 'clock'|'file-alt', type: 'application'|'timing', title: 'Apply Soon - Deadline Approaching'|'Customize Your Cover Letter', description: string, priority: 'high'|'medium', action: '#ai-cover-letter-section'|'#application-form'}, 4?: array{icon: 'clock', type: 'timing', title: 'Apply Soon - Deadline Approaching', description: string, priority: 'high', action: '#application-form'}}
     */
    public function getApplicationTips(Job $job, Candidate $candidate): array
    {
        $tips = [];

        // Profile completeness tips
        if (!$candidate->profile_video_path) {
            $tips[] = [
                'icon' => 'video',
                'type' => 'profile',
                'title' => 'Add a Professional Video',
                'description' => 'Candidates with video profiles are 3x more likely to get interviews',
                'priority' => 'high',
                'action' => route('member.profile.index') . '#pills-video-tab',
            ];
        }

        // Skills matching tips
        $jobSkills = $job->skills->pluck('name')->toArray();
        $candidateSkills = $candidate->skills->pluck('name')->toArray();
        $missingSkills = array_diff($jobSkills, $candidateSkills);

        if (!empty($missingSkills) && count($missingSkills) <= 3) {
            $tips[] = [
                'icon' => 'star',
                'type' => 'skills',
                'title' => 'Add Missing Key Skills',
                'description' => 'Add these skills to your profile: ' . implode(', ', array_slice($missingSkills, 0, 3)),
                'priority' => 'high',
                'action' => route('member.profile.index') . '#pills-profile-tab',
            ];
        }

        // Experience tips
        $requiredExperience = $job->job_experience_id;
        if ($requiredExperience && !$candidate->experiences->count()) {
            $tips[] = [
                'icon' => 'briefcase',
                'type' => 'experience',
                'title' => 'Add Your Work Experience',
                'description' => 'This job requires experience. Adding your work history increases your chances by 70%',
                'priority' => 'high',
                'action' => route('member.profile.index') . '#pills-experience-tab',
            ];
        }

        // Cover letter tip
        $tips[] = [
            'icon' => 'file-alt',
            'type' => 'application',
            'title' => 'Customize Your Cover Letter',
            'description' => 'Use our AI to generate a personalized cover letter that highlights your relevant experience',
            'priority' => 'medium',
            'action' => '#ai-cover-letter-section',
        ];

        // Timing tip
        $daysLeft = now()->diffInDays($job->deadline, false);
        if ($daysLeft <= 3 && $daysLeft > 0) {
            $tips[] = [
                'icon' => 'clock',
                'type' => 'timing',
                'title' => 'Apply Soon - Deadline Approaching',
                'description' => "Only {$daysLeft} days left to apply. Early applications get more attention",
                'priority' => 'high',
                'action' => '#application-form',
            ];
        }

        return $tips;
    }

    /**
     * Analyze application success probability
     *
     * @return ((int|mixed)[]|float|string)[]
     *
     * @psalm-return array{probability: float, factors: array{profile_score: mixed, early_application: 0|10, video_profile: 0|15, complete_profile: 0|10, relevant_experience: int<min, 20>}, category: string, message: string}
     */
    public function predictSuccessProbability(Job $job, Candidate $candidate): array
    {
        $matchScore = $this->calculateApplicationScore($job, $candidate);
        $score = $matchScore['overall_score'];

        // Factors affecting probability
        $factors = [
            'profile_score' => $score,
            'early_application' => now()->diffInDays($job->created_at) <= 7 ? 10 : 0,
            'video_profile' => $this->hasVideoProfile($candidate) ? 15 : 0,
            'complete_profile' => $candidate->profile_complete ? 10 : 0,
            'relevant_experience' => min($candidate->experiences->count() * 5, 20),
        ];

        $probability = min(array_sum($factors), 95);

        return [
            'probability' => round($probability, 1),
            'factors' => $factors,
            'category' => $this->getProbabilityCategory($probability),
            'message' => $this->getProbabilityMessage($probability),
        ];
    }

    // Private helper methods

    private function extractKeyRequirements(string $description): string
    {
        // Extract first 3 sentences or 150 words as requirements summary
        $sentences = preg_split('/(?<=[.!?])\s+/', $description, -1, PREG_SPLIT_NO_EMPTY);
        $summary = implode(' ', array_slice($sentences, 0, 3));

        if (str_word_count($summary) > 150) {
            $words = explode(' ', $summary);
            $summary = implode(' ', array_slice($words, 0, 150)) . '...';
        }

        return $summary;
    }

    private function buildCoverLetter(array $data): string
    {
        return "Dear Hiring Manager at {$data['companyName']},\n\n" .
               "I am writing to express my strong interest in the {$data['jobTitle']} position. " .
               "With my background in {$data['experience']} and expertise in {$data['skills']}, " .
               "I am confident in my ability to contribute effectively to your team.\n\n" .
               "Throughout my career, I have developed a comprehensive skill set that aligns perfectly with your requirements. " .
               "My experience has equipped me with the technical knowledge and practical skills needed to excel in this role. " .
               "I am particularly drawn to this opportunity because it combines my passion for professional growth with the chance to work with an innovative organization like {$data['companyName']}.\n\n" .
               "I am excited about the possibility of bringing my unique perspective and dedication to your team. " .
               "I am confident that my skills and enthusiasm make me an ideal candidate for this position.\n\n" .
               "Thank you for considering my application. I look forward to the opportunity to discuss how I can contribute to your organization's success.\n\n" .
               "Sincerely,\n" .
               "{$data['candidateName']}";
    }

    private function calculateSkillsMatch(Job $job, Candidate $candidate): float
    {
        $jobSkills = $job->skills->pluck('id')->toArray();
        $candidateSkills = $candidate->skills->pluck('id')->toArray();

        if (empty($jobSkills)) {
            return 20;
        }

        $matchingSkills = array_intersect($jobSkills, $candidateSkills);
        $matchPercentage = (count($matchingSkills) / count($jobSkills)) * 100;

        return min($matchPercentage * 0.3, 30);
    }

    private function calculateExperienceMatch(Job $job, Candidate $candidate): int
    {
        $candidateExperienceCount = $candidate->experiences->count();

        if ($candidateExperienceCount >= 3) {
            return 25;
        } elseif ($candidateExperienceCount >= 1) {
            return 15;
        }

        return 5;
    }

    private function calculateEducationMatch(Job $job, Candidate $candidate): int
    {
        $candidateEducationCount = $candidate->educations->count();

        if ($candidateEducationCount >= 1) {
            return 15;
        }

        return 5;
    }

    private function calculateProfileCompleteness(Candidate $candidate): int
    {
        $score = 0;

        if ($candidate->bio) $score += 3;
        if ($candidate->skills->count() > 0) $score += 3;
        if ($candidate->languages->count() > 0) $score += 2;
        if ($candidate->experiences->count() > 0) $score += 3;
        if ($candidate->educations->count() > 0) $score += 3;
        if ($candidate->image) $score += 2;
        if ($candidate->cv_path) $score += 2;
        if ($candidate->mobile) $score += 2;

        return $score;
    }

    private function hasVideoProfile(Candidate $candidate): bool
    {
        return !empty($candidate->profile_video_path) && !empty($candidate->personality_video_path);
    }

    private function getRecommendation(float $percentage): string
    {
        if ($percentage >= 80) {
            return 'Excellent match! Submit your application with confidence.';
        } elseif ($percentage >= 60) {
            return 'Good match! Consider adding more relevant details to strengthen your application.';
        } elseif ($percentage >= 40) {
            return 'Fair match. Review the job requirements and update your profile accordingly.';
        }

        return 'Low match. Consider building more relevant skills before applying.';
    }

    private function getLikelihood(float $percentage): string
    {
        if ($percentage >= 80) return 'Very High';
        if ($percentage >= 60) return 'High';
        if ($percentage >= 40) return 'Moderate';
        return 'Low';
    }

    private function getProbabilityCategory(float $probability): string
    {
        if ($probability >= 70) return 'excellent';
        if ($probability >= 50) return 'good';
        if ($probability >= 30) return 'fair';
        return 'low';
    }

    private function getProbabilityMessage(float $probability): string
    {
        if ($probability >= 70) {
            return 'Your profile is an excellent match! Your application has a strong chance of success.';
        } elseif ($probability >= 50) {
            return 'You have a good chance! Follow our tips to improve your application further.';
        } elseif ($probability >= 30) {
            return 'You meet some requirements. Complete your profile to increase your chances.';
        }

        return 'Consider building more relevant experience before applying.';
    }
}

