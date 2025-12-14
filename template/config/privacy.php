<?php

return [
    'defaults' => [
        'tier' => env('PRIVACY_DEFAULT_TIER', 'network'),
    ],

    'tiers' => [
        'public' => [
            'label' => 'Public persona',
            'description' => 'Profile is visible to anyone and messages are open unless muted by other controls.',
            'policies' => [
                'privacy_level' => 'public',
                'dm_policy' => 'everyone',
                'tag_policy' => 'everyone',
                'mention_policy' => 'public',
                'location_visibility' => 'public',
            ],
            'social_profile_private' => false,
            'analytics' => [
                'ai_concierge' => ['member_name', 'pronouns'],
                'social_insights' => ['connection_recommendations', 'network_clusters', 'connection_names', 'trend_metrics'],
            ],
        ],
        'network' => [
            'label' => 'Network-only',
            'description' => 'Content is shown to followers/connections with limited data surfaced to strangers.',
            'policies' => [
                'privacy_level' => 'followers',
                'dm_policy' => 'connections_only',
                'tag_policy' => 'connections_only',
                'mention_policy' => 'followers',
                'location_visibility' => 'followers',
            ],
            'social_profile_private' => false,
            'analytics' => [
                'ai_concierge' => ['member_name'],
                'social_insights' => ['connection_recommendations', 'network_clusters', 'trend_metrics'],
            ],
        ],
        'invite_only' => [
            'label' => 'Invite-only',
            'description' => 'Locks persona visibility to trusted mentors and suspends AI/insight lookups.',
            'policies' => [
                'privacy_level' => 'private',
                'dm_policy' => 'mentors_only',
                'tag_policy' => 'trusted',
                'mention_policy' => 'trusted',
                'location_visibility' => 'hidden',
            ],
            'social_profile_private' => true,
            'analytics' => [
                'ai_concierge' => [],
                'social_insights' => [],
            ],
        ],
    ],

    'vulnerable_cohorts' => [
        'women_safety_mode' => true,
        'age_brackets' => ['teen'],
        'safety_overrides_flags' => ['vulnerable', 'mentee', 'survivor_circle'],
    ],
];
