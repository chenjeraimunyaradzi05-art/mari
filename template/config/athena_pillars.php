<?php

return [
    'pillars' => [
        'housing' => [
            'label' => 'Housing stability',
            'stat' => '60% cite housing stress',
            'meta' => 'Critical Problems dossier · 2024 data',
            'description' => 'Mortgage relief concierge and relocation scouts monitor repayment spikes, rent hikes, and safe housing waitlists every week.',
            'cta' => [
                'label' => 'Open housing concierge',
                'route' => 'housing.index',
            ],
            'focus_summary' => 'Housing stress is trending up. Revisit relocation, mortgage relief, or co-ownership waitlists to keep cover stories ready.',
            'focus_cta' => [
                'label' => 'Review housing pathways',
                'route' => 'housing.preferences',
            ],
            'interest_tags' => ['housing', 'mortgage', 'rent', 'relocation', 'real estate', 'property', 'accommodation'],
            'gradient' => 'rose',
        ],
        'career' => [
            'label' => 'Career momentum',
            'stat' => '79% salary ratio post-degree',
            'meta' => 'WGEA graduate outcomes · 2025',
            'description' => 'Dream pathways keep job, study, and apprenticeship queues live so you can pivot quickly.',
            'cta' => [
                'label' => 'Browse open roles',
                'route' => 'jobs.index',
            ],
            'focus_summary' => 'Salary transparency and apprenticeship queues are primed—capture or update at least one pathway today.',
            'focus_cta' => [
                'label' => 'Explore study pathways',
                'route' => 'education.discovery',
            ],
            'interest_tags' => ['job', 'career', 'study', 'tafe', 'uni', 'apprenticeship', 'role', 'trade'],
            'gradient' => 'violet',
        ],
        'money' => [
            'label' => 'Money skills',
            'stat' => '11.5% gender pay gap',
            'meta' => 'WGEA · Feb 2025',
            'description' => 'Salary diagnostics, budgeting explainers, and debt relief prompts stay tied to your notifications.',
            'cta' => [
                'label' => 'Open money toolkit',
                'route' => 'financial.budget',
            ],
            'focus_summary' => 'Finances flag as high risk. Turn on notifications for salary diagnostics and budgeting explainers.',
            'focus_cta' => [
                'label' => 'Open money dashboard',
                'route' => 'money.dashboard',
            ],
            'interest_tags' => ['finance', 'money', 'budget', 'savings', 'debt', 'super', 'retirement', 'income'],
            'gradient' => 'teal',
        ],
        'business' => [
            'label' => 'Business safety',
            'stat' => 'Women-led startups underfunded',
            'meta' => 'StartupAus · 2025',
            'description' => 'Structure wizards, grant monitors, and legal templates reduce friction for women building companies.',
            'cta' => [
                'label' => 'See business concierge',
                'route' => 'grants.index',
            ],
            'focus_summary' => 'Your business interests trigger compliance reminders and capital alerts. Review grant monitors today.',
            'focus_cta' => [
                'label' => 'Open grant monitors',
                'route' => 'business.network',
            ],
            'interest_tags' => ['business', 'company', 'startup', 'grants', 'sole trader', 'mentor', 'partner'],
            'gradient' => 'amber',
        ],
    ],

    'signals' => [
        [
            'label' => 'Money & security',
            'stat' => '11.5% pay gap',
            'summary' => 'Salary transparency drives the wage diagnostic tiles across your dashboard.',
        ],
        [
            'label' => 'Housing & mortgages',
            'stat' => '60% cite housing stress',
            'summary' => 'Rent relief explainers and relocation waitlists sit inside Dream Pathways.',
        ],
        [
            'label' => 'Career & education',
            'stat' => '79% salary ratio post-degree',
            'summary' => 'TAFE, uni, and apprenticeship queues are pre-grouped for quick action.',
        ],
        [
            'label' => 'Business & grants',
            'stat' => 'Funding gap persists',
            'summary' => 'Grant alerts piggyback off the respectful monitoring engine used for jobs.',
        ],
    ],

    'micro_panels' => [
        'charter' => [
            'body' => 'Keeps the community charter visible and logs every boundary preference tied to your dreams.',
            'action' => [
                'label' => 'Jump to charter clauses',
                'url' => '#charter',
            ],
        ],
        'problem-map' => [
            'body' => 'Links Problem Map research to the widgets you see so evidence always drives prioritisation.',
            'action' => [
                'label' => 'View research signals',
                'url' => '#problem-map',
            ],
        ],
        'dream-pathways' => [
            'body' => 'Bundles jobs, study, and government pathways so respectful monitoring can stay on in the background.',
            'action' => [
                'label' => 'Manage dream wishlist',
                'route' => 'careers.wishlist',
                'anchor' => 'dream-pathways',
            ],
        ],
        'member-dashboard' => [
            'body' => 'Surfaces notification readiness and pauses so every dream stays on your terms.',
            'action' => [
                'label' => 'Tune notification settings',
                'route' => 'careers.wishlist',
                'anchor' => 'member-dashboard',
            ],
        ],
        'waitlists' => [
            'body' => 'Holds job, housing, and study leads quietly until you are ready for a warm nudge.',
            'action' => [
                'label' => 'Manage waitlists',
                'route' => 'careers.wishlist',
                'anchor' => 'waitlists',
            ],
        ],
    ],

    'charter_highlights' => [
        [
            'title' => 'Respectful monitoring',
            'copy' => 'Dream pathways stay private until you choose to surface them, and every notification is preference-driven.',
            'meta' => 'Charter clause 04',
        ],
        [
            'title' => 'Economic confidence',
            'copy' => 'Transparent salary stories, funding explainers, and apprenticeship routes are the baseline for every member.',
            'meta' => 'Charter clause 07',
        ],
        [
            'title' => 'Whole-of-life support',
            'copy' => 'Career, housing, business, and wellness pathways share a single planner so you can move between life stages easily.',
            'meta' => 'Charter clause 11',
        ],
    ],

    'problem_map' => [
        [
            'label' => 'Money & security',
            'stat' => '11.5% pay gap',
            'summary' => 'Salary transparency drives the wage diagnostic tiles across your dashboard.',
        ],
        [
            'label' => 'Housing & mortgages',
            'stat' => '60% cite housing stress',
            'summary' => 'Rent relief explainers and relocation waitlists sit inside Dream Pathways.',
        ],
        [
            'label' => 'Career & education',
            'stat' => '79% salary ratio post-degree',
            'summary' => 'TAFE, uni, and apprenticeship queues are pre-grouped for quick action.',
        ],
        [
            'label' => 'Business & grants',
            'stat' => 'Funding gap persists',
            'summary' => 'Grant alerts piggyback off the respectful monitoring engine used for jobs.',
        ],
    ],

    'focus_fallback' => 'career',
];
