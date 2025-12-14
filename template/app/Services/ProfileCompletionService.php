<?php

namespace App\Services;

use App\Models\Candidate;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * AI-Powered Profile Completion Assistant
 * Analyzes candidate profiles and provides intelligent suggestions
 */
final class ProfileCompletionService
{
    /**
     * Calculate profile completion percentage
     *
     * @return (array|float|int)[]
     *
     * @psalm-return array{percentage: 0|float, sections: array, completed_count: int<0, max>, total_count: int<0, max>, level: array}
     */
    public function getCompletionPercentage(Candidate $candidate): array
    {
        $sections = $this->getCompletionSections($candidate);

        $totalWeight = array_sum(array_column($sections, 'weight'));
        $completedWeight = 0;

        foreach ($sections as $section) {
            if ($section['completed']) {
                $completedWeight += $section['weight'];
            }
        }

        $percentage = $totalWeight > 0 ? round(($completedWeight / $totalWeight) * 100) : 0;

        return [
            'percentage' => $percentage,
            'sections' => $sections,
            'completed_count' => count(array_filter($sections, fn($s) => $s['completed'])),
            'total_count' => count($sections),
            'level' => $this->getCompletionLevel($percentage),
        ];
    }

    /**
     * Get completion sections with status
     *
     * @return (bool|int|string|string[])[][]
     *
     * @psalm-return array{basic_info: array{name: 'Basic Information', weight: 10, completed: bool, fields: list{'Full Name', 'Email', 'Phone', 'Date of Birth', 'Gender'}, icon: 'fas fa-user', color: '#E91E8C'}, profile_image: array{name: 'Profile Photo', weight: 5, completed: bool, fields: list{'Professional Photo'}, icon: 'fas fa-camera', color: '#8B5CF6'}, location: array{name: 'Location Details', weight: 8, completed: bool, fields: list{'Country', 'State', 'City', 'Address'}, icon: 'fas fa-map-marker-alt', color: '#10B981'}, bio: array{name: 'Professional Summary', weight: 12, completed: bool, fields: list{'Bio (minimum 50 characters)'}, icon: 'fas fa-align-left', color: '#F59E0B'}, experience: array{name: 'Work Experience', weight: 20, completed: bool, fields: list{'At least one work experience'}, icon: 'fas fa-briefcase', color: '#3B82F6'}, education: array{name: 'Education', weight: 15, completed: bool, fields: list{'At least one education entry'}, icon: 'fas fa-graduation-cap', color: '#EC4899'}, skills: array{name: 'Skills', weight: 15, completed: bool, fields: list{'At least 3 skills'}, icon: 'fas fa-code', color: '#6366F1'}, languages: array{name: 'Languages', weight: 5, completed: bool, fields: list{'At least one language'}, icon: 'fas fa-language', color: '#14B8A6'}, profession: array{name: 'Profession & Status', weight: 5, completed: bool, fields: list{'Profession', 'Employment Status'}, icon: 'fas fa-id-badge', color: '#F97316'}, cv: array{name: 'CV/Resume Upload', weight: 5, completed: bool, fields: list{'Upload your CV'}, icon: 'fas fa-file-pdf', color: '#EF4444'}}
     */
    public function getCompletionSections(Candidate $candidate): array
    {
        return [
            'basic_info' => [
                'name' => 'Basic Information',
                'weight' => 10,
                'completed' => $this->isBasicInfoComplete($candidate),
                'fields' => ['Full Name', 'Email', 'Phone', 'Date of Birth', 'Gender'],
                'icon' => 'fas fa-user',
                'color' => '#E91E8C',
            ],
            'profile_image' => [
                'name' => 'Profile Photo',
                'weight' => 5,
                'completed' => !empty($candidate->image),
                'fields' => ['Professional Photo'],
                'icon' => 'fas fa-camera',
                'color' => '#8B5CF6',
            ],
            'location' => [
                'name' => 'Location Details',
                'weight' => 8,
                'completed' => $this->isLocationComplete($candidate),
                'fields' => ['Country', 'State', 'City', 'Address'],
                'icon' => 'fas fa-map-marker-alt',
                'color' => '#10B981',
            ],
            'bio' => [
                'name' => 'Professional Summary',
                'weight' => 12,
                'completed' => !empty($candidate->bio) && strlen($candidate->bio) >= 50,
                'fields' => ['Bio (minimum 50 characters)'],
                'icon' => 'fas fa-align-left',
                'color' => '#F59E0B',
            ],
            'experience' => [
                'name' => 'Work Experience',
                'weight' => 20,
                'completed' => $candidate->experiences->count() > 0,
                'fields' => ['At least one work experience'],
                'icon' => 'fas fa-briefcase',
                'color' => '#3B82F6',
            ],
            'education' => [
                'name' => 'Education',
                'weight' => 15,
                'completed' => $candidate->educations->count() > 0,
                'fields' => ['At least one education entry'],
                'icon' => 'fas fa-graduation-cap',
                'color' => '#EC4899',
            ],
            'skills' => [
                'name' => 'Skills',
                'weight' => 15,
                'completed' => $candidate->skills->count() >= 3,
                'fields' => ['At least 3 skills'],
                'icon' => 'fas fa-code',
                'color' => '#6366F1',
            ],
            'languages' => [
                'name' => 'Languages',
                'weight' => 5,
                'completed' => $candidate->languages->count() > 0,
                'fields' => ['At least one language'],
                'icon' => 'fas fa-language',
                'color' => '#14B8A6',
            ],
            'profession' => [
                'name' => 'Profession & Status',
                'weight' => 5,
                'completed' => !empty($candidate->profession_id) && !empty($candidate->status),
                'fields' => ['Profession', 'Employment Status'],
                'icon' => 'fas fa-id-badge',
                'color' => '#F97316',
            ],
            'cv' => [
                'name' => 'CV/Resume Upload',
                'weight' => 5,
                'completed' => !empty($candidate->cv),
                'fields' => ['Upload your CV'],
                'icon' => 'fas fa-file-pdf',
                'color' => '#EF4444',
            ],
        ];
    }

    /**
     * Get AI-powered suggestions for profile improvement
     */
    public function getSuggestions(Candidate $candidate): array
    {
        $suggestions = [];
        $sections = $this->getCompletionSections($candidate);

        // Prioritize incomplete sections by weight
        $incompleteSections = array_filter($sections, fn($s) => !$s['completed']);
        uasort($incompleteSections, fn($a, $b) => $b['weight'] <=> $a['weight']);

        foreach ($incompleteSections as $key => $section) {
            $suggestions[] = $this->generateSuggestion($candidate, $key, $section);
        }

        // Add AI-powered enhancement suggestions even for complete profiles
        if (count($suggestions) < 3) {
            $suggestions = array_merge($suggestions, $this->getEnhancementSuggestions($candidate));
        }

        return array_slice($suggestions, 0, 5); // Return top 5 suggestions
    }

    /**
     * Generate suggestion for a specific section
     *
     * @return (mixed|string|true)[]
     *
     * @psalm-return array{title?: string, description?: string, action?: string, url?: string, priority?: 'critical'|'high'|'medium', estimated_time?: string, ai_help?: true, section: mixed, icon: mixed, color: mixed}
     */
    protected function generateSuggestion(Candidate $candidate, string $sectionKey, array $section): array
    {
        $suggestions = [
            'basic_info' => [
                'title' => 'Complete Your Basic Information',
                'description' => 'Add missing details like phone number and date of birth to help employers contact you.',
                'action' => 'Complete Profile',
                'url' => route('member.profile.index'),
                'priority' => 'high',
                'estimated_time' => '2 minutes',
            ],
            'profile_image' => [
                'title' => 'Add a Professional Photo',
                'description' => 'Profiles with photos receive 40% more views. Upload a clear, professional headshot.',
                'action' => 'Upload Photo',
                'url' => route('member.profile.index'),
                'priority' => 'medium',
                'estimated_time' => '1 minute',
            ],
            'location' => [
                'title' => 'Set Your Location',
                'description' => 'Help employers find you by adding your city and country information.',
                'action' => 'Add Location',
                'url' => route('member.profile.index'),
                'priority' => 'high',
                'estimated_time' => '1 minute',
            ],
            'bio' => [
                'title' => 'Write Your Professional Summary',
                'description' => 'A compelling bio increases your chances by 3x. Tell employers what makes you unique.',
                'action' => 'Write Bio',
                'url' => route('member.profile.index'),
                'priority' => 'high',
                'estimated_time' => '5 minutes',
                'ai_help' => true,
            ],
            'experience' => [
                'title' => 'Add Your Work Experience',
                'description' => 'Showcase your professional background. Include job titles, companies, and achievements.',
                'action' => 'Add Experience',
                'url' => route('member.experience.create'),
                'priority' => 'critical',
                'estimated_time' => '10 minutes',
            ],
            'education' => [
                'title' => 'Add Your Education',
                'description' => 'List your degrees and certifications to strengthen your profile.',
                'action' => 'Add Education',
                'url' => route('member.education.create'),
                'priority' => 'high',
                'estimated_time' => '5 minutes',
            ],
            'skills' => [
                'title' => 'List Your Skills',
                'description' => 'Add at least 3 relevant skills. Our AI will suggest skills based on your experience.',
                'action' => 'Add Skills',
                'url' => route('member.profile.index') . '#skills',
                'priority' => 'high',
                'estimated_time' => '3 minutes',
                'ai_help' => true,
            ],
            'languages' => [
                'title' => 'Add Languages You Speak',
                'description' => 'Multilingual candidates have access to 50% more opportunities.',
                'action' => 'Add Languages',
                'url' => route('member.profile.index') . '#languages',
                'priority' => 'medium',
                'estimated_time' => '2 minutes',
            ],
            'profession' => [
                'title' => 'Set Your Profession',
                'description' => 'Select your current profession and employment status for better job matching.',
                'action' => 'Set Profession',
                'url' => route('member.profile.index'),
                'priority' => 'medium',
                'estimated_time' => '1 minute',
            ],
            'cv' => [
                'title' => 'Upload Your Resume',
                'description' => 'Upload your CV to auto-fill your profile and let employers download it.',
                'action' => 'Upload CV',
                'url' => route('member.resume-parser.index'),
                'priority' => 'medium',
                'estimated_time' => '2 minutes',
                'ai_help' => true,
            ],
        ];

        return array_merge($suggestions[$sectionKey] ?? [], [
            'section' => $section['name'],
            'icon' => $section['icon'],
            'color' => $section['color'],
        ]);
    }

    /**
     * Get enhancement suggestions for already complete profiles
     *
     * @return (string|true)[][]
     *
     * @psalm-return list{0?: array{title: 'Add More Skills'|'Add More Work Experience'|'Expand Your Professional Summary', description: 'A detailed bio (200+ characters) helps employers understand your value better.'|'Adding multiple work experiences shows career progression and increases profile strength.'|'Candidates with 5+ skills get 60% more job matches. Let AI suggest relevant skills.', action: 'Add Another Experience'|'Add More Skills'|'Enhance Bio', url: string, priority: 'low'|'medium', estimated_time: '10 minutes'|'5 minutes', section: 'Enhancement', icon: 'fas fa-align-left'|'fas fa-code'|'fas fa-plus-circle', color: '#3B82F6'|'#6366F1'|'#F59E0B', ai_help?: true}, 1?: array{title: 'Add More Skills'|'Expand Your Professional Summary', description: 'A detailed bio (200+ characters) helps employers understand your value better.'|'Candidates with 5+ skills get 60% more job matches. Let AI suggest relevant skills.', action: 'Add More Skills'|'Enhance Bio', url: string, priority: 'low', estimated_time: '5 minutes', section: 'Enhancement', icon: 'fas fa-align-left'|'fas fa-code', color: '#6366F1'|'#F59E0B', ai_help: true}, 2?: array{title: 'Expand Your Professional Summary', description: 'A detailed bio (200+ characters) helps employers understand your value better.', action: 'Enhance Bio', url: string, priority: 'low', estimated_time: '5 minutes', section: 'Enhancement', icon: 'fas fa-align-left', color: '#F59E0B', ai_help: true}}
     */
    protected function getEnhancementSuggestions(Candidate $candidate): array
    {
        $suggestions = [];

        // Suggest more experiences
        if ($candidate->experiences->count() < 2) {
            $suggestions[] = [
                'title' => 'Add More Work Experience',
                'description' => 'Adding multiple work experiences shows career progression and increases profile strength.',
                'action' => 'Add Another Experience',
                'url' => route('member.experience.create'),
                'priority' => 'medium',
                'estimated_time' => '10 minutes',
                'section' => 'Enhancement',
                'icon' => 'fas fa-plus-circle',
                'color' => '#3B82F6',
            ];
        }

        // Suggest more skills
        if ($candidate->skills->count() < 5) {
            $suggestions[] = [
                'title' => 'Add More Skills',
                'description' => 'Candidates with 5+ skills get 60% more job matches. Let AI suggest relevant skills.',
                'action' => 'Add More Skills',
                'url' => route('member.profile.index') . '#skills',
                'priority' => 'low',
                'estimated_time' => '5 minutes',
                'section' => 'Enhancement',
                'icon' => 'fas fa-code',
                'color' => '#6366F1',
                'ai_help' => true,
            ];
        }

        // Suggest longer bio
        if (!empty($candidate->bio) && strlen($candidate->bio) < 200) {
            $suggestions[] = [
                'title' => 'Expand Your Professional Summary',
                'description' => 'A detailed bio (200+ characters) helps employers understand your value better.',
                'action' => 'Enhance Bio',
                'url' => route('member.profile.index'),
                'priority' => 'low',
                'estimated_time' => '5 minutes',
                'section' => 'Enhancement',
                'icon' => 'fas fa-align-left',
                'color' => '#F59E0B',
                'ai_help' => true,
            ];
        }

        return $suggestions;
    }

    /**
     * Get skill suggestions based on experience
     *
     * @return string[]
     *
     * @psalm-return list<'Adobe XD'|'Analytics'|'CAD'|'CRM'|'CSS'|'Communication'|'Content Marketing'|'Content Writing'|'Creativity'|'Curriculum Development'|'Customer Service'|'Data Analysis'|'Digital Marketing'|'Editing'|'Excel'|'Figma'|'Git'|'HTML'|'Illustrator'|'JavaScript'|'Leadership'|'Mentoring'|'MySQL'|'Negotiation'|'PHP'|'Patience'|'Photoshop'|'Planning'|'PowerBI'|'Problem Solving'|'Project Management'|'Project Planning'|'Python'|'Research'|'SEO Writing'|'SEO'|'SQL'|'Sales Strategy'|'Social Media'|'Statistics'|'Team Building'|'Technical Writing'|'UI/UX Design'>
     */
    public function suggestSkills(Candidate $candidate, int $limit = 10): array
    {
        $suggestedSkills = [];

        // Extract keywords from job titles and descriptions
        $keywords = [];
        foreach ($candidate->experiences as $experience) {
            $text = $experience->designation . ' ' . ($experience->responsibilities ?? '');
            $words = str_word_count(strtolower($text), 1);
            $keywords = array_merge($keywords, $words);
        }

        // Common skill mappings
        $skillMappings = [
            'developer' => ['PHP', 'JavaScript', 'HTML', 'CSS', 'Git', 'MySQL'],
            'designer' => ['Photoshop', 'Illustrator', 'Figma', 'UI/UX Design', 'Adobe XD'],
            'manager' => ['Leadership', 'Project Management', 'Team Building', 'Communication', 'Planning'],
            'marketing' => ['Digital Marketing', 'SEO', 'Social Media', 'Content Marketing', 'Analytics'],
            'sales' => ['Negotiation', 'Customer Service', 'Communication', 'CRM', 'Sales Strategy'],
            'analyst' => ['Data Analysis', 'Excel', 'SQL', 'PowerBI', 'Statistics', 'Python'],
            'engineer' => ['Problem Solving', 'Technical Writing', 'CAD', 'Project Planning'],
            'teacher' => ['Curriculum Development', 'Communication', 'Mentoring', 'Patience'],
            'writer' => ['Content Writing', 'SEO Writing', 'Editing', 'Research', 'Creativity'],
        ];

        // Match keywords to skill mappings
        foreach ($skillMappings as $role => $skills) {
            if (in_array($role, $keywords)) {
                $suggestedSkills = array_merge($suggestedSkills, $skills);
            }
        }

        // Remove duplicates and already added skills
        $suggestedSkills = array_unique($suggestedSkills);
        $existingSkills = $candidate->skills->pluck('skill.name')->toArray();
        $suggestedSkills = array_diff($suggestedSkills, $existingSkills);

        return array_slice(array_values($suggestedSkills), 0, $limit);
    }

    /**
     * Generate AI-powered bio suggestions
     *
     * @return string[][]
     *
     * @psalm-return list{0?: array{template: 'achievement'|'learning'|'professional', text: string}, 1?: array{template: 'achievement'|'learning', text: string}, 2?: array{template: 'learning', text: string}}
     */
    public function suggestBio(Candidate $candidate): array
    {
        $suggestions = [];

        // Get candidate data
        $latestExperience = $candidate->experiences->first();
        $latestEducation = $candidate->educations->first();
        $skillCount = $candidate->skills->count();
        $experienceYears = $candidate->experience?->name ?? 'experienced';

        // Template 1: Professional focus
        if ($latestExperience) {
            $suggestions[] = [
                'template' => 'professional',
                'text' => "Experienced {$latestExperience->designation} with a proven track record in {$latestExperience->department}. " .
                         "Passionate about delivering high-quality results and driving organizational success. " .
                         ($skillCount > 0 ? "Proficient in " . $candidate->skills->take(3)->pluck('skill.name')->join(', ') . ". " : "") .
                         "Seeking opportunities to leverage my expertise and contribute to innovative projects.",
            ];
        }

        // Template 2: Achievement focus
        if ($latestExperience) {
            $suggestions[] = [
                'template' => 'achievement',
                'text' => "Results-driven professional with {$experienceYears} experience in {$latestExperience->department}. " .
                         "Known for exceeding targets and delivering exceptional outcomes. " .
                         "Strong problem-solver with excellent communication and team collaboration skills. " .
                         "Looking for challenging roles that allow me to make a meaningful impact.",
            ];
        }

        // Template 3: Learning focus
        if ($latestEducation) {
            $suggestions[] = [
                'template' => 'learning',
                'text' => "Motivated professional with a {$latestEducation->level} in {$latestEducation->degree}. " .
                         "Continuously expanding my skillset and staying current with industry trends. " .
                         ($skillCount > 0 ? "Skilled in " . $candidate->skills->take(3)->pluck('skill.name')->join(', ') . ". " : "") .
                         "Eager to apply my knowledge and grow within a dynamic organization.",
            ];
        }

        return $suggestions;
    }

    /**
     * Check if basic info is complete
     */
    protected function isBasicInfoComplete(Candidate $candidate): bool
    {
        return !empty($candidate->user->name) &&
               !empty($candidate->user->email) &&
               !empty($candidate->birth_date) &&
               !empty($candidate->gender) &&
               !empty($candidate->phone_one);
    }

    /**
     * Check if location is complete
     */
    protected function isLocationComplete(Candidate $candidate): bool
    {
        return !empty($candidate->country) &&
               !empty($candidate->state) &&
               !empty($candidate->city);
    }

    /**
     * Get completion level badge
     *
     * @return string[]
     *
     * @psalm-return array{name: string, color: string, icon: string}
     */
    protected function getCompletionLevel(int $percentage): array
    {
        if ($percentage >= 90) {
            return ['name' => 'Expert', 'color' => '#10B981', 'icon' => 'fas fa-star'];
        } elseif ($percentage >= 70) {
            return ['name' => 'Advanced', 'color' => '#3B82F6', 'icon' => 'fas fa-award'];
        } elseif ($percentage >= 50) {
            return ['name' => 'Intermediate', 'color' => '#F59E0B', 'icon' => 'fas fa-medal'];
        } elseif ($percentage >= 30) {
            return ['name' => 'Beginner', 'color' => '#EF4444', 'icon' => 'fas fa-flag'];
        } else {
            return ['name' => 'Getting Started', 'color' => '#9CA3AF', 'icon' => 'fas fa-seedling'];
        }
    }

    /**
     * Get completion rewards/benefits
     *
     * @return (bool|string)[][]
     *
     * @psalm-return array{25: array{title: 'Profile Visible', description: 'Your profile is now visible to employers', icon: 'fas fa-eye', unlocked: bool}, 50: array{title: 'Job Recommendations', description: 'Unlock AI-powered job matching', icon: 'fas fa-magic', unlocked: bool}, 75: array{title: 'Priority in Search', description: 'Appear higher in employer searches', icon: 'fas fa-arrow-up', unlocked: bool}, 90: array{title: 'Profile Badge', description: 'Get "Complete Profile" badge', icon: 'fas fa-certificate', unlocked: bool}, 100: array{title: 'Premium Features', description: 'Access advanced career insights', icon: 'fas fa-crown', unlocked: bool}}
     */
    public function getCompletionBenefits(int $percentage): array
    {
        $benefits = [
            25 => [
                'title' => 'Profile Visible',
                'description' => 'Your profile is now visible to employers',
                'icon' => 'fas fa-eye',
                'unlocked' => $percentage >= 25,
            ],
            50 => [
                'title' => 'Job Recommendations',
                'description' => 'Unlock AI-powered job matching',
                'icon' => 'fas fa-magic',
                'unlocked' => $percentage >= 50,
            ],
            75 => [
                'title' => 'Priority in Search',
                'description' => 'Appear higher in employer searches',
                'icon' => 'fas fa-arrow-up',
                'unlocked' => $percentage >= 75,
            ],
            90 => [
                'title' => 'Profile Badge',
                'description' => 'Get "Complete Profile" badge',
                'icon' => 'fas fa-certificate',
                'unlocked' => $percentage >= 90,
            ],
            100 => [
                'title' => 'Premium Features',
                'description' => 'Access advanced career insights',
                'icon' => 'fas fa-crown',
                'unlocked' => $percentage >= 100,
            ],
        ];

        return $benefits;
    }
}

