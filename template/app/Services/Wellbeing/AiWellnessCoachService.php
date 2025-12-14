<?php

namespace App\Services\Wellbeing;

use App\Models\User;
use App\Models\WellbeingProfile;
use App\Models\WellbeingEvent;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;

final class AiWellnessCoachService
{
    /**
     * Generate a personalized wellness plan for the user.
     *
     * @return (Collection|array|null|string)[]
     *
     * @psalm-return array{summary?: string, focus_areas?: array, schedule?: array, recommended_events?: Collection, mentor_suggestion?: string, safety_note?: null|string, error?: 'Please complete your wellness profile first.'}
     */
    public function generatePlan(User $user): array
    {
        $profile = $user->wellbeingProfile;

        if (!$profile) {
            return ['error' => 'Please complete your wellness profile first.'];
        }

        // In a real implementation, this would call an LLM (OpenAI/Anthropic)
        // For now, we'll use a heuristic rule-based engine.

        $plan = [
            'summary' => $this->generateSummary($profile),
            'focus_areas' => $this->deriveFocusAreas($profile),
            'schedule' => $this->generateSchedule($profile),
            'recommended_events' => $this->findEvents($profile),
            'mentor_suggestion' => $this->generateMentorSuggestion($profile),
            'safety_note' => $this->generateSafetyNote($profile),
        ];

        return $plan;
    }

    protected function generateSummary(WellbeingProfile $profile): string
    {
        $summary = "Based on your energy pattern ({$profile->energy_pattern}) and goals, here is your weekly plan.";

        if ($profile->pref_body_positive) {
            $summary .= " We've prioritized body-neutral and inclusive activities.";
        }

        if ($profile->pref_adaptive) {
            $summary .= " All suggested exercises are adapted for your specific needs.";
        }

        return $summary;
    }

    /**
     * @return string[]
     *
     * @psalm-return list{0?: string, 1?: string, 2?: 'Body Neutrality & Self-Compassion'|'Maternal Health & Core Recovery'|'Social Connection', 3?: 'Body Neutrality & Self-Compassion'|'Maternal Health & Core Recovery', 4?: 'Maternal Health & Core Recovery'}
     */
    protected function deriveFocusAreas(WellbeingProfile $profile): array
    {
        $areas = [];
        if ($profile->pref_strength) {
            $areas[] = 'Strength & Conditioning';
        }
        if ($profile->pref_yoga || $profile->pref_meditation) {
            $areas[] = 'Mindfulness & Mobility';
        }
        if ($profile->pref_team_sport) {
            $areas[] = 'Social Connection';
        }
        if ($profile->pref_body_positive) {
            $areas[] = 'Body Neutrality & Self-Compassion';
        }
        if ($profile->pref_prenatal_postnatal) {
            $areas[] = 'Maternal Health & Core Recovery';
        }

        return $areas;
    }

    /**
     * @return string[]
     *
     * @psalm-return array{Monday: string, Wednesday: 'Adaptive strength training (seated or supported)'|'Bodyweight exercises'|'Strength training', Friday: 'Chair yoga or guided mobility'|'Stretching & Mobility'|'Yoga flow', Weekend: 'Group walk in a busy public park (if comfortable) or Home Rest'|'Nature walk or hike'|'Rest & Recovery'}
     */
    protected function generateSchedule(WellbeingProfile $profile): array
    {
        // Simple template based on movement level
        $intensity = $profile->movement_level === 'high' ? 'Vigorous' : 'Moderate';

        if ($profile->pref_prenatal_postnatal) {
            $intensity = 'Gentle/Safe';
        }

        $schedule = [
            'Monday' => "{$intensity} cardio session (30 mins)",
            'Wednesday' => $profile->pref_strength ? "Strength training" : "Bodyweight exercises",
            'Friday' => $profile->pref_yoga ? "Yoga flow" : "Stretching & Mobility",
            'Weekend' => $profile->pref_outdoors ? "Nature walk or hike" : "Rest & Recovery",
        ];

        if ($profile->pref_adaptive) {
            $schedule['Wednesday'] = "Adaptive strength training (seated or supported)";
            $schedule['Friday'] = "Chair yoga or guided mobility";
        }

        if ($profile->pref_dv_safe) {
            // Ensure activities can be done at home or in very public, safe spaces
            $schedule['Monday'] = "Home-based {$intensity} cardio (no equipment needed)";
            $schedule['Weekend'] = "Group walk in a busy public park (if comfortable) or Home Rest";
        }

        return $schedule;
    }

    protected function findEvents(WellbeingProfile $profile): Collection
    {
        // Find events matching preferences
        return WellbeingEvent::query()
            ->where('starts_at', '>', now())
            ->where(function ($q) use ($profile) {
                if ($profile->pref_yoga) $q->orWhere('type', 'yoga');
                if ($profile->pref_running) $q->orWhere('type', 'running');
                if ($profile->pref_strength) $q->orWhere('type', 'fitness_class');
                if ($profile->pref_meditation) $q->orWhere('type', 'meditation');
            })
            ->when($profile->pref_body_positive, function ($q) {
                $q->where('is_body_positive', true);
            })
            ->when($profile->pref_adaptive, function ($q) {
                $q->where('is_adaptive', true);
            })
            ->when($profile->pref_dv_safe, function ($q) {
                $q->where('is_dv_safe', true);
            })
            ->when($profile->pref_prenatal_postnatal, function ($q) {
                $q->where('is_prenatal_postnatal', true);
            })
            ->take(3)
            ->get();
    }

    protected function generateMentorSuggestion(WellbeingProfile $profile): string
    {
        $suggestion = "We recommend connecting with a mentor who enjoys " . ($profile->pref_outdoors ? "outdoor activities" : "mindfulness") . ".";

        if ($profile->pref_prenatal_postnatal) {
            $suggestion = "Connect with a mentor who is also navigating motherhood.";
        } elseif ($profile->pref_adaptive) {
            $suggestion = "Connect with a mentor from our adaptive sports community.";
        }

        return $suggestion;
    }

    protected function generateSafetyNote(WellbeingProfile $profile): string|null
    {
        if ($profile->pref_dv_safe) {
            return "Your safety is paramount. All suggested activities are designed to be discreet and safe. If you need immediate assistance, please use the 'Emergency Exit' button.";
        }
        return null;
    }
}

