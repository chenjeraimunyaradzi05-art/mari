<?php

return [
    'primary' => [
        ['label' => 'Home', 'route' => 'home'],
        ['label' => 'Find Your Next Role', 'route' => 'jobs.index'],
        ['label' => 'Recruiter Hub', 'url' => '/recruiters'],
        ['label' => 'Member Hub', 'route' => 'members.index'],
        ['label' => 'Pricing', 'route' => 'pricing.index'],
        ['label' => 'Playbook', 'url' => '/playbook'],
        ['label' => 'Insights', 'route' => 'blogs.index'],
        ['label' => 'Feed', 'route' => 'feed.index'],
    ],

    'ecosystem' => [
        [
            'title' => 'Glow boldly',
            'items' => [
                ['label' => 'Company Lounge', 'route' => 'company.dashboard'],
                ['label' => 'Business Network', 'url' => '/business-network'],
                ['label' => 'Curated partners & mentors', 'url' => '/business-network#mentors'],
            ],
        ],
        [
            'title' => 'Company',
            'items' => [
                ['label' => 'Employer console & briefs', 'route' => 'company.dashboard'],
            ],
        ],
        [
            'title' => 'Government',
            'items' => [
                ['label' => 'Funding & procurement', 'url' => '/government'],
            ],
        ],
        [
            'title' => 'Public Sector',
            'items' => [
                ['label' => 'Government & civic roles', 'route' => 'public-sector.dashboard'],
            ],
        ],
        [
            'title' => 'Member',
            'items' => [
                ['label' => 'Personalised career hub', 'route' => 'member.dashboard'],
            ],
        ],
        [
            'title' => 'Real Estate',
            'items' => [
                ['label' => 'Property pathways & leadership', 'route' => 'women.real-estate.dashboard'],
            ],
        ],
        [
            'title' => 'TAFE & University',
            'items' => [
                ['label' => 'Pathways & upskilling', 'route' => 'education.tafe.dashboard'],
            ],
        ],
        [
            'title' => 'Trades',
            'items' => [
                ['label' => 'Licences & traineeships', 'url' => '/trades'],
            ],
        ],
    ],
];
