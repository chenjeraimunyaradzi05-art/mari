<?php

return [
    'home' => [
        'pillar_band' => env('FEATURE_HOME_PILLAR_BAND', false),
        'vertical_gateway' => env('FEATURE_HOME_VERTICAL_GATEWAY', false),
    ],
    'candidate_dashboard' => [
        'welcome_pulse' => env('FEATURE_DASHBOARD_WELCOME_PULSE', false),
        'persona_echo' => env('FEATURE_DASHBOARD_PERSONA_ECHO', false),
        'opportunity_streams' => env('FEATURE_DASHBOARD_OPPORTUNITY_STREAMS', false),
    ],
    'social' => [
        'feed' => [
            'enabled' => env('FEATURE_SOCIAL_FEED', true),
            'following' => env('FEATURE_SOCIAL_FEED_FOLLOWING', true),
            'discovery' => env('FEATURE_SOCIAL_FEED_DISCOVERY', true),
            'sponsored' => env('FEATURE_SOCIAL_FEED_SPONSORED', true),
            'trending' => env('FEATURE_SOCIAL_FEED_TRENDING', true),
        ],
    ],
    'feed' => [
        'enabled' => env('FEATURE_FEED_ENABLED', true),
        'filters' => [
            'public' => env('FEATURE_FEED_FILTER_PUBLIC', true),
            'private' => env('FEATURE_FEED_FILTER_PRIVATE', false),
            'media' => env('FEATURE_FEED_FILTER_MEDIA', true),
        ],
    ],
    'leads' => [
        'recaptcha' => [
            'enabled' => env('FEATURE_LEAD_FORM_RECAPTCHA', false),
            'score_threshold' => (float) env('FEATURE_LEAD_FORM_RECAPTCHA_SCORE', 0.5),
            'site_key' => env('RECAPTCHA_SITE_KEY'),
        ],
    ],
    'growth' => [
        'referrals' => env('FEATURE_REFERRALS', true),
        'marketing_attribution' => env('FEATURE_MARKETING_ATTRIBUTION', true),
        'ab_testing' => env('FEATURE_AB_TESTING', true),
        'viral_loops' => env('FEATURE_VIRAL_LOOPS', true),
    ],
];
