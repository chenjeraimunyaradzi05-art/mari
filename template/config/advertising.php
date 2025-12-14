<?php

return [
    'frontend_preview' => [
        [
            'label' => 'STEM re-entry partner',
            'title' => 'Nebula Systems · Returnships for coders',
            'description' => 'A six-month re-skilling runway with paid lab hours and senior mentors, rebuilt for carers rejoining product teams.',
            'cta_text' => 'Review talent brief',
            'cta_route' => 'business.network',
            'media' => 'frontend/assets/imgs/page/homepage6/img1.png',
        ],
        [
            'label' => 'Rapid housing alliance',
            'title' => 'Hearthstone Co-Living · Safe leases fast',
            'description' => 'Pre-approved studio clusters with wraparound security deposits so relocations happen in days, not months.',
            'cta_text' => 'Explore vacancies',
            'cta_route' => 'housing.index',
            'media' => 'frontend/assets/imgs/page/homepage6/img3.png',
        ],
        [
            'label' => 'Digital freedom fund',
            'title' => 'Brightwave Fiber · Unlimited care data',
            'description' => 'Underwritten broadband, devices and tech concierges so survivors can work, study and access clinicians remotely.',
            'cta_text' => 'View connectivity kit',
            'cta_route' => 'education.discovery',
            'media' => 'frontend/assets/imgs/page/homepage4/img-big5.png',
        ],
        [
            'label' => 'Whole-health coalition',
            'title' => 'Solace Clinics · Mobile calm suites',
            'description' => 'High-resolution diagnostics, trauma-informed telehealth and on-site decompression pods inside community hubs.',
            'cta_text' => 'See care model',
            'cta_route' => 'wellness.hub',
            'media' => 'frontend/assets/imgs/page/homepage4/img-big6.png',
        ],
    ],
    'brand_safety' => [
        'disallowed_categories' => ['gambling', 'adult', 'tobacco', 'crypto', 'politics'],
        'required_attestations' => [
            'trauma_informed_creative',
            'women_led_delivery_team',
            'privacy_disclosures_signed',
        ],
        'latency_budget_ms' => 150,
    ],
];
