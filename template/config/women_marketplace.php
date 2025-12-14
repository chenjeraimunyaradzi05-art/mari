<?php

return [
    'stats' => [
        'community_requests' => '2.4k weekly searches',
    ],

    'categories' => [
        'fitness' => [
            'label' => 'Fitness & Movement',
            'summary' => 'Prenatal-safe strength clubs, Afrobeat dance labs, trauma-aware coaches.',
            'tone' => 'emerald',
            'proof' => '81% of bookings include childcare add-ons.',
        ],
        'beauty' => [
            'label' => 'Beauty & Rituals',
            'summary' => 'Textured-hair specialists, mobile glam squads, menopause-aware skin labs.',
            'tone' => 'rose',
            'proof' => '92% five-star satisfaction from verified members.',
        ],
        'pets' => [
            'label' => 'Pets & Calm Companions',
            'summary' => 'Ethical groomers, behaviourists, and women-led pet wellness buses.',
            'tone' => 'cyan',
            'proof' => 'Same-day help in every capital city.',
        ],
    ],

    'filters' => [
        'locations' => [
            ['value' => 'sydney_nsw', 'label' => 'Sydney, NSW'],
            ['value' => 'melbourne_vic', 'label' => 'Melbourne, VIC'],
            ['value' => 'brisbane_qld', 'label' => 'Brisbane, QLD'],
            ['value' => 'perth_wa', 'label' => 'Perth, WA'],
            ['value' => 'adelaide_sa', 'label' => 'Adelaide, SA'],
        ],
        'price_ranges' => [
            ['value' => 'accessible', 'label' => '$ – Community-funded', 'description' => 'Under $40 per session or flexible memberships.'],
            ['value' => 'standard', 'label' => '$$ – Studio rates', 'description' => '$40-$90 per booking.'],
            ['value' => 'premium', 'label' => '$$$ – Concierge care', 'description' => 'High-touch, mobile or bespoke packages.'],
        ],
        'modalities' => [
            ['value' => 'in-person', 'label' => 'In studio / on-site'],
            ['value' => 'virtual', 'label' => 'Virtual / telehealth'],
            ['value' => 'mobile', 'label' => 'Mobile to you'],
        ],
        'availability' => [
            ['value' => 'childcare', 'label' => 'Child-minding available'],
            ['value' => 'after-hours', 'label' => 'After-hours / late nights'],
            ['value' => 'ndis', 'label' => 'NDIS or assistive plans'],
            ['value' => 'weekend', 'label' => 'Weekend roster'],
        ],
    ],
];
