<?php

return [
    'threads' => [
        'default_type' => 'direct',
        'default_request_mode' => 'followers',
        'max_participants' => [
            'direct' => 2,
            'group' => 25,
            'broadcast' => 200,
        ],
        'request_modes' => ['auto', 'followers', 'manual', 'closed'],
    ],
    'rate_limits' => [
        'send_per_minute' => (int) env('SOCIAL_DM_PER_MINUTE', 20),
        'send_per_hour' => (int) env('SOCIAL_DM_PER_HOUR', 200),
        'send_per_day' => (int) env('SOCIAL_DM_PER_DAY', 400),
        'attachments_per_day' => (int) env('SOCIAL_DM_ATTACHMENTS_PER_DAY', 60),
        'requests_per_day' => (int) env('SOCIAL_DM_REQUESTS_PER_DAY', 30),
        'request_accepts_per_hour' => (int) env('SOCIAL_DM_ACCEPTS_PER_HOUR', 40),
    ],
    'spam' => [
        'warn_threshold' => (float) env('SOCIAL_DM_SPAM_WARN', 45),
        'auto_hold_threshold' => (float) env('SOCIAL_DM_SPAM_HOLD', 70),
        'suspend_threshold' => (float) env('SOCIAL_DM_SPAM_SUSPEND', 85),
        'duplicate_interval_seconds' => (int) env('SOCIAL_DM_DUPLICATE_INTERVAL', 45),
        'max_links_per_message' => (int) env('SOCIAL_DM_MAX_LINKS', 5),
        'max_mentions_per_message' => (int) env('SOCIAL_DM_MAX_MENTIONS', 6),
    ],
    'templates' => [
        'ownership' => 'social_profile',
        'supports_organization_scope' => true,
        'default_visibility' => 'private',
        'max_per_owner' => (int) env('SOCIAL_DM_TEMPLATES_LIMIT', 200),
        'team_visibility_roles' => ['moderator', 'owner'],
    ],
    'requests' => [
        'auto_expire_days' => (int) env('SOCIAL_DM_REQUEST_EXPIRY_DAYS', 14),
        'auto_close_days' => (int) env('SOCIAL_DM_REQUEST_AUTO_CLOSE_DAYS', 30),
    ],
    'attachments' => [
        'allowed_mime_groups' => ['image', 'video', 'pdf', 'doc'],
        'max_total_per_thread' => (int) env('SOCIAL_DM_THREAD_ATTACHMENTS', 500),
    ],
    'reactions' => [
        'allowed' => env('SOCIAL_DM_REACTIONS', 'like,celebrate,support,love,insightful,curious')
            ? array_filter(array_map('trim', explode(',', env('SOCIAL_DM_REACTIONS', 'like,celebrate,support,love,insightful,curious'))))
            : ['like', 'celebrate', 'support', 'love', 'insightful', 'curious'],
    ],
    'queue' => [
        'connection' => env('SOCIAL_DM_QUEUE_CONNECTION', env('QUEUE_CONNECTION', 'sync')),
        'name' => env('SOCIAL_DM_QUEUE', 'notifications'),
    ],
    'respectful_messaging' => [
        'auto_response_template' => env('SOCIAL_DM_RESPECT_RESPONSE', 'We paused your note because it triggered our respectful messaging filters. Nothing was delivered.'),
        'incident_category' => 'messaging',
        'auto_report_user_id' => (int) env('SAFETY_SYSTEM_USER_ID', 0),
        'tone' => [
            'block_score' => (float) env('SOCIAL_DM_TONE_BLOCK_SCORE', 45),
            'negative_keywords' => [
                ['term' => 'idiot', 'weight' => 12],
                ['term' => 'stupid', 'weight' => 10],
                ['term' => 'hate you', 'weight' => 14],
                ['term' => 'shut up', 'weight' => 12],
                ['term' => 'kill', 'weight' => 16],
            ],
        ],
        'banned_patterns' => [
            [
                'pattern' => '/\\b(?:kill yourself|suicide|self\\s*harm)\\b/i',
                'reason' => 'self_harm_language',
                'escalate' => true,
            ],
            [
                'pattern' => '/\\b(?:rape|sexual assault|non-consensual)\\b/i',
                'reason' => 'sexual_violence',
                'escalate' => true,
            ],
            [
                'pattern' => '/(?:\bslur\b|\btrash\b|\bworthless\b)/i',
                'reason' => 'harassment_language',
                'escalate' => false,
            ],
            [
                'pattern' => '/\\b(?:threat|hurt you|destroy you)\\b/i',
                'reason' => 'violent_threat',
                'escalate' => true,
            ],
        ],
    ],
    'mentee_safeguards' => [
        'consent_notice' => env('SOCIAL_DM_MENTEE_CONSENT_NOTICE', 'I agree to honor WomenRise community guidelines before continuing this mentorship conversation.'),
        'read_receipts_enabled' => filter_var(env('SOCIAL_DM_MENTEE_READ_RECEIPTS', true), FILTER_VALIDATE_BOOL),
    ],
];
