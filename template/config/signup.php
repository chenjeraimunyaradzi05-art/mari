<?php

return [
    'primary_purposes' => [
        'public_sector' => [
            'title' => 'Public Sector',
            'summary' => 'Unlock civic labs, procurement missions, and agency dashboards.',
            'icon' => 'fas fa-landmark',
            'role' => 'company',
            'feature_flags' => ['public_sector_dashboard', 'civic_missions', 'public_sector_dashboard_v1'],
        ],
        'member' => [
            'title' => 'Member',
            'summary' => 'Search women-first roles, programs, pathways, and wraparound care.',
            'icon' => 'fas fa-user-astronaut',
            'role' => 'member',
            'feature_flags' => ['candidate_feed', 'pathway_builder', 'candidate_dashboard_v1'],
        ],
        'company' => [
            'title' => 'Company',
            'summary' => 'Showcase your workplace, roles, and equity commitments.',
            'icon' => 'fas fa-building',
            'role' => 'company',
            'feature_flags' => ['employer_tools', 'talent_pipeline', 'company_dashboard_v1'],
        ],
        'mentor' => [
            'title' => 'Mentor',
            'summary' => 'Support women with guidance, coaching, and sponsorship.',
            'icon' => 'fas fa-hands-holding-heart',
            'role' => 'member',
            'feature_flags' => ['mentor_network', 'mentor_dashboard_v1'],
        ],
        'tafe_university' => [
            'title' => 'TAFE / University',
            'summary' => 'Partner on learning pathways, cohorts, and wraparound support.',
            'icon' => 'fas fa-graduation-cap',
            'role' => 'company',
            'feature_flags' => ['education_dashboard', 'education_dashboard_v1'],
        ],
        'business_network' => [
            'title' => 'Business Network',
            'summary' => 'Connect founders, suppliers, ecosystem partners, and buyers.',
            'icon' => 'fas fa-network-wired',
            'role' => 'company',
            'feature_flags' => ['business_network', 'business_network_dashboard_v1'],
        ],
        'real_estate' => [
            'title' => 'Real Estate',
            'summary' => 'List women-first housing, relocation, and property pathways.',
            'icon' => 'fas fa-house-chimney',
            'role' => 'company',
            'feature_flags' => ['real_estate_labs', 'real_estate_dashboard_v1'],
        ],
        'trades' => [
            'title' => 'Trades',
            'summary' => 'Champion women entering trades with jobs and apprenticeships.',
            'icon' => 'fas fa-hard-hat',
            'role' => 'member',
            'feature_flags' => ['trades_hub', 'trades_dashboard_v1'],
        ],
        'financial_literacy' => [
            'title' => 'Financial Literacy & Wellbeing',
            'summary' => 'Deliver holistic money education, wellbeing programs, and confidence labs.',
            'icon' => 'fas fa-piggy-bank',
            'role' => 'company',
            'feature_flags' => ['financial_wellbeing', 'financial_dashboard_v1'],
        ],
    ],

    'secondary_intents' => [
        'career_growth' => [
            'title' => 'Career momentum',
            'summary' => 'Unlock sponsors, rituals, and roles for your next leap.',
        ],
        'launch_business' => [
            'title' => 'Launch or grow a venture',
            'summary' => 'Match with mentors, capital allies, and distribution partners.',
        ],
        'wealth_building' => [
            'title' => 'Build wealth & money confidence',
            'summary' => 'Tap into financial wellbeing hubs, coaches, and literacy labs.',
        ],
        'community_support' => [
            'title' => 'Find community & support',
            'summary' => 'Curate safe spaces, masterminds, and accountability circles.',
        ],
        'policy_impact' => [
            'title' => 'Shape policy & public impact',
            'summary' => 'Collaborate with civic partners and public sector coalitions.',
        ],
    ],

    'identity_alignment_options' => [
        'woman_identifying' => 'I identify as a woman or femme-aligned person',
        'gender_diverse' => 'I am gender-diverse / non-binary and align with Athena’s values',
        'ally_male_employer' => 'I am a male ally/employer setting up verified spaces only',
    ],
];
