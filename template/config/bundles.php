<?php

return [
    'categories' => [
        'mortgage' => [
            'label' => 'Mortgage & home loans',
            'default_monthly_cost' => 2200.00,
            'providers' => ['athena_home_lending', 'community_bank_alliance'],
            'priority' => 'critical',
        ],
        'phone' => [
            'label' => 'Mobile & connectivity',
            'default_monthly_cost' => 95.00,
            'providers' => ['resilient_mobile_coop', 'community_bank_alliance'],
            'priority' => 'essential',
        ],
        'electricity' => [
            'label' => 'Electricity & energy',
            'default_monthly_cost' => 180.00,
            'providers' => ['renew_her_energy'],
            'priority' => 'essential',
        ],
        'health' => [
            'label' => 'Health insurance',
            'default_monthly_cost' => 240.00,
            'providers' => ['care_collective_health'],
            'priority' => 'essential',
        ],
        'car_insurance' => [
            'label' => 'Car insurance',
            'default_monthly_cost' => 140.00,
            'providers' => ['guardian_mobility_cover'],
            'priority' => 'support',
        ],
        'entertainment' => [
            'label' => 'Entertainment & streaming',
            'default_monthly_cost' => 58.00,
            'providers' => ['calm_house_media'],
            'priority' => 'flex',
        ],
        'fuel' => [
            'label' => 'Fuel & mobility',
            'default_monthly_cost' => 210.00,
            'providers' => ['guardian_mobility_cover'],
            'priority' => 'essential',
        ],
    ],

    'providers' => [
        'athena_home_lending' => [
            'name' => 'Athena Home Lending Circle',
            'base_discount_percent' => 5.2,
            'stacking_bonus_percent' => 1.3,
            'referral_code_prefix' => 'ATH-HOME',
            'referral_url' => 'https://partners.athena.internal/home-lending?source=bundles',
            'negotiation_template' => 'Lead with the violence-free household policy and reference the {category_list} savings. Mention Athena concierge projection of {savings_per_year} per year when you quote {provider_name}.',
        ],
        'community_bank_alliance' => [
            'name' => 'Community Bank Alliance',
            'base_discount_percent' => 4.0,
            'stacking_bonus_percent' => 1.0,
            'referral_code_prefix' => 'CBA-ALLY',
            'referral_url' => 'https://communitybankalliancesafe.example/onboard',
            'negotiation_template' => 'Ask retention to match the Athena ally rate with a {bundle_span} service bundle and emphasise crisis-ready hardship clauses.',
        ],
        'resilient_mobile_coop' => [
            'name' => 'Resilient Mobile Cooperative',
            'base_discount_percent' => 18.0,
            'stacking_bonus_percent' => 2.5,
            'referral_code_prefix' => 'RMC-WAVE',
            'referral_url' => 'https://mobile.resilientcoop.au/signup',
            'negotiation_template' => 'Request the traveling-worker plan with Athena roaming guardrails. Reference {savings_per_month} monthly savings.',
        ],
        'renew_her_energy' => [
            'name' => 'Renew Her Energy',
            'base_discount_percent' => 12.0,
            'stacking_bonus_percent' => 3.0,
            'referral_code_prefix' => 'RHE-SPARK',
            'referral_url' => 'https://renewherenergy.example/athena',
            'negotiation_template' => 'Mention solar-readiness plus violence-interruption hotline priority with the bundled concierge.',
        ],
        'care_collective_health' => [
            'name' => 'Care Collective Health',
            'base_discount_percent' => 9.0,
            'stacking_bonus_percent' => 1.5,
            'referral_code_prefix' => 'CCH-CARE',
            'referral_url' => 'https://carecollective.health/join',
            'negotiation_template' => 'Highlight trauma-informed claims support and show how your Athena plan frees {savings_per_year} yearly.',
        ],
        'guardian_mobility_cover' => [
            'name' => 'Guardian Mobility Cover',
            'base_discount_percent' => 7.5,
            'stacking_bonus_percent' => 1.2,
            'referral_code_prefix' => 'GMC-RIDE',
            'referral_url' => 'https://guardianmobilitycover.au/athena',
            'negotiation_template' => 'Quote the multi-vehicle promise and request roadside upgrades citing the concierge projection.',
        ],
        'calm_house_media' => [
            'name' => 'Calm House Media Collective',
            'base_discount_percent' => 22.0,
            'stacking_bonus_percent' => 4.0,
            'referral_code_prefix' => 'CALM-WAVE',
            'referral_url' => 'https://calmhousemedia.com/athena',
            'negotiation_template' => 'Ask for annual billing relief plus safety content packs. Mention {category_list}.',
        ],
    ],

    'stacking' => [
        'multi_category_bonus_percent' => 2.5,
        'category_threshold' => 3,
    ],

    'success_thresholds' => [
        'good' => 600, // AUD per year
        'great' => 1200,
    ],
];
