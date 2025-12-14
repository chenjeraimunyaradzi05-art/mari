<?php

return [
    'personas' => [
        'caregiver' => [
            'label' => 'Caregiver balancing transitions',
            'icon' => '💞',
            'description' => 'You are supporting family or community while preparing for new roles.',
            'journey_prompts' => [
                'Explore flexible or hybrid programs that adapt to caregiving schedules.',
                'Check verified housing listings near support networks.',
                'Book mentorship focused on resilience and boundaries.',
            ],
            'recommended_supports' => ['housing', 'mentorship'],
        ],
        'career-shifter' => [
            'label' => 'Career shifter',
            'icon' => '🔄',
            'description' => 'You are pivoting into a new industry and need clarity on pathways.',
            'journey_prompts' => [
                'Review foundational courses and bridge programs recommended for your pivot.',
                'Bookmark roles that accept transferable experience and offer on-the-job training.',
                'Schedule mentorship to map your transferable skills into the new sector.',
            ],
            'recommended_supports' => ['courses', 'jobs', 'mentorship'],
        ],
        'early-career' => [
            'label' => 'Early career builder',
            'icon' => '🚀',
            'description' => 'You are taking first steps into the workforce and building confidence.',
            'journey_prompts' => [
                'Complete profile basics so hiring partners can understand your strengths.',
                'Browse curated roles with structured onboarding and support.',
                'Join mentorship circles to practise interviews and workplace scenarios.',
            ],
            'recommended_supports' => ['jobs', 'mentorship'],
        ],
        'entrepreneur' => [
            'label' => 'Entrepreneur / founder',
            'icon' => '💡',
            'description' => 'You are building ventures, collectives, or new projects.',
            'journey_prompts' => [
                'Review courses that unlock capital, operations, and leadership tooling.',
                'Connect with mentors experienced in fundraising and inclusive hiring.',
                'Identify housing or workspace options that keep you and your team safe.',
            ],
            'recommended_supports' => ['mentorship', 'courses', 'housing'],
        ],
        'student' => [
            'label' => 'Student / learner',
            'icon' => '🎓',
            'description' => 'You are studying and want pathways into safe workplaces.',
            'journey_prompts' => [
                'Explore scholarships and intakes that include wrap-around care.',
                'Check mentorship programs that focus on industry introductions.',
                'Track housing matches that reduce commute stress during study.',
            ],
            'recommended_supports' => ['courses', 'mentorship', 'housing'],
        ],
    ],
    'supports' => [
        'courses' => [
            'label' => 'Courses & intakes',
            'description' => 'Structured learning pathways, bridge programs, and WomenRise-backed scholarships.',
            'icon' => '📚',
            'cta_label' => 'Explore courses',
            'nudges' => [
                'caregiver' => [
                    'Prioritise hybrid or flexible delivery that adapts around caregiving windows.',
                ],
                'career-shifter' => [
                    'Use bridge programs that translate your existing experience into a new industry.',
                ],
                'early-career' => [
                    'Start with foundational cohorts that build confidence and core workplace skills.',
                ],
                'entrepreneur' => [
                    'Pick accelerators covering capital, operations, and inclusive leadership systems.',
                ],
                'student' => [
                    'Stack wrap-around scholarships and study support to keep your pathway sustainable.',
                ],
                'default' => [
                    'Explore WomenRise-backed learning pathways tailored to your journey.',
                ],
            ],
        ],
        'housing' => [
            'label' => 'Verified housing',
            'description' => 'Safe, vetted accommodation and relocation support matched to your placements.',
            'icon' => '🏡',
            'cta_label' => 'Review housing support',
            'nudges' => [
                'caregiver' => [
                    'Search for locations close to care networks and reliable transport.',
                ],
                'career-shifter' => [
                    'Plan relocation near internships or apprenticeships that support your pivot.',
                ],
                'early-career' => [
                    'Choose verified housing that keeps commute times low for entry roles.',
                ],
                'entrepreneur' => [
                    'Secure safe live-work spaces that give your collective room to prototype.',
                ],
                'student' => [
                    'Prioritise housing with study-friendly amenities and wrap-around care.',
                ],
                'default' => [
                    'Review WomenRise vetted housing to anchor your next step safely.',
                ],
            ],
        ],
        'mentorship' => [
            'label' => 'Mentorship circles',
            'description' => 'Curated mentors and peer pods focused on resilience, leadership, and transitions.',
            'icon' => '🤝',
            'cta_label' => 'Book mentorship',
            'nudges' => [
                'caregiver' => [
                    'Connect with mentors who understand boundary setting and resilience.',
                ],
                'career-shifter' => [
                    'Match with mentors who have navigated similar industry pivots.',
                ],
                'early-career' => [
                    'Join circles to practise interviews and decode workplace expectations.',
                ],
                'entrepreneur' => [
                    'Find founders who can coach you on fundraising and inclusive hiring.',
                ],
                'student' => [
                    'Pair with mentors offering industry introductions and placement prep.',
                ],
                'default' => [
                    'Tap into WomenRise mentors who guide your progression with care.',
                ],
            ],
        ],
        'jobs' => [
            'label' => 'Career opportunities',
            'description' => 'Employer roles with wage transparency, verified safety practices, and structured onboarding.',
            'icon' => '💼',
            'cta_label' => 'View roles',
            'nudges' => [
                'caregiver' => [
                    'Filter for roles with flexible hours and caregiver-friendly policies.',
                ],
                'career-shifter' => [
                    'Target employers investing in paid training and transferable skills.',
                ],
                'early-career' => [
                    'Focus on entry roles that include structured onboarding and coaching.',
                ],
                'entrepreneur' => [
                    'Explore contracts that fund your venture while expanding networks.',
                ],
                'student' => [
                    'Seek internships or safe workplaces that integrate with study loads.',
                ],
                'default' => [
                    'Browse transparent roles from vetted WomenRise employers.',
                ],
            ],
        ],
    ],
];
