<?php

return [
    'bypass_roles' => [
        'Super Admin',
        'Admin',
        'Moderator',
    ],

    'contexts' => [
        'jobs' => [
            'label' => 'Jobs & Careers',
            'description' => 'Career rituals, AI prep, and curated mentors.',
            'requirements' => [
                'intent:career_growth',
                'intent:launch_business',
            ],
            'public_default' => true,
            'navigation' => [
                ['label' => 'Dream Jobs Hub', 'route' => 'jobs.index'],
                ['label' => 'Member Dashboard', 'route' => 'member.dashboard', 'requires_auth' => true],
                ['label' => 'Mentor Connections', 'route' => 'member.social.feed', 'requires_auth' => true],
            ],
            'launcher' => [
                'label' => 'Career focus',
                'route' => 'jobs.index',
                'auth_route' => 'member.dashboard',
                'icon' => 'fas fa-briefcase',
                'description' => 'Track roles, AI recommendations, and applications.',
            ],
        ],

        'housing' => [
            'label' => 'Housing & Real Estate',
            'description' => 'Safe housing pathways and verified women agents.',
            'requirements' => [
                'portal:real_estate',
            ],
            'public_default' => false,
            'navigation' => [
                ['label' => 'Housing Dashboard', 'route' => 'women.real-estate.dashboard', 'requires_auth' => true],
                ['label' => 'Rental Matches', 'route' => 'women.real-estate.rentals.index', 'requires_auth' => true],
                ['label' => 'Agent Pulse', 'route' => 'women.real-estate.agents.pulse', 'requires_auth' => true],
            ],
            'launcher' => [
                'label' => 'Housing focus',
                'route' => 'women.real-estate.dashboard',
                'icon' => 'fas fa-house-chimney',
                'description' => 'List, match, and finance women-first homes.',
                'requires_auth' => true,
            ],
        ],

        'wellness' => [
            'label' => 'Wellness & Money',
            'description' => 'Financial calm, social rituals, and community care.',
            'requirements' => [
                'intent:wealth_building',
                'intent:community_support',
                'portal:financial_wellbeing',
            ],
            'public_default' => true,
            'navigation' => [
                ['label' => 'Wellness Rituals', 'route' => 'wellness.hub'],
                ['label' => 'Community Feed', 'route' => 'social.feed.index', 'requires_auth' => true],
                ['label' => 'Business & Wellness Partners', 'route' => 'business.network'],
                ['label' => 'Guides & Stories', 'route' => 'blogs.index'],
            ],
            'launcher' => [
                'label' => 'Wellness focus',
                'route' => 'wellness.hub',
                'auth_route' => 'wellness.dashboard',
                'icon' => 'fas fa-seedling',
                'description' => 'Drop into calm money and wellness spaces.',
            ],
        ],

        'business' => [
            'label' => 'Business & Capital',
            'description' => 'Partner briefs, growth rituals, and deal teams.',
            'requirements' => [
                'intent:launch_business|policy_impact',
                'portal:business',
            ],
            'public_default' => true,
            'navigation' => [
                ['label' => 'Business Network', 'route' => 'business.network'],
                ['label' => 'Company Console', 'route' => 'company.dashboard', 'requires_auth' => true],
                ['label' => 'Partner Updates', 'route' => 'business.dashboard', 'requires_auth' => true],
            ],
            'launcher' => [
                'label' => 'Business focus',
                'route' => 'business.network',
                'auth_route' => 'business.dashboard',
                'icon' => 'fas fa-handshake',
                'description' => 'Track partner briefs and capital rituals.',
                'requires_auth' => false,
            ],
        ],

        'education' => [
            'label' => 'Learning & Credentials',
            'description' => 'Micro-credentials, pathways, and study rituals.',
            'requirements' => [
                'portal:education',
            ],
            'public_default' => true,
            'navigation' => [
                ['label' => 'Learning Discovery', 'route' => 'education.discovery'],
                ['label' => 'TAFE Dashboard', 'route' => 'education.tafe.dashboard', 'requires_auth' => true],
                ['label' => 'Learning Paths', 'route' => 'women.learn.index', 'requires_auth' => true],
            ],
            'launcher' => [
                'label' => 'Learning focus',
                'route' => 'education.discovery',
                'auth_route' => 'education.tafe.dashboard',
                'icon' => 'fas fa-graduation-cap',
                'description' => 'Track micro-credentials and partner cohorts.',
                'requires_auth' => false,
            ],
        ],
    ],
];
