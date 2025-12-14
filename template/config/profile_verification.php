<?php

return [
    'queue_connection' => env('PROFILE_VERIFICATION_QUEUE_CONNECTION', env('QUEUE_CONNECTION', 'sync')),
    'reviewer_roles' => array_values(array_filter(array_map('trim', explode(',', env('PROFILE_VERIFICATION_REVIEWER_ROLES', 'Super Admin'))))),
    'notification_roles' => array_values(array_filter(array_map('trim', explode(',', env('PROFILE_VERIFICATION_NOTIFICATION_ROLES', env('PROFILE_VERIFICATION_REVIEWER_ROLES', 'Super Admin')))))),
    'notification_emails' => array_values(array_filter(array_map('trim', explode(',', env('PROFILE_VERIFICATION_NOTIFICATION_EMAILS', ''))))),
    'slack_webhook' => env('PROFILE_VERIFICATION_SLACK_WEBHOOK'),
    'analytics_source' => env('PROFILE_VERIFICATION_ANALYTICS_SOURCE', 'persona_verification'),
    'drafts' => [
        'ttl_days' => (int) env('PROFILE_VERIFICATION_DRAFT_TTL_DAYS', 14),
    ],
    'automation' => [
        'summary' => [
            'enabled' => (bool) env('PROFILE_VERIFICATION_SUMMARY_ENABLED', true),
            'queue' => env('PROFILE_VERIFICATION_SUMMARY_QUEUE', 'analytics'),
        ],
        'reminders' => [
            'enabled' => (bool) env('PROFILE_VERIFICATION_REMINDERS_ENABLED', true),
            'queue' => env('PROFILE_VERIFICATION_REMINDER_QUEUE', 'notifications'),
            'windows' => array_values(array_filter(array_map('intval', explode(',', env('PROFILE_VERIFICATION_REMINDER_WINDOWS', '90,30,7'))))),
        ],
        'auto_suspend' => [
            'enabled' => (bool) env('PROFILE_VERIFICATION_AUTO_SUSPEND_ENABLED', true),
            'queue' => env('PROFILE_VERIFICATION_AUTO_SUSPEND_QUEUE', 'moderation'),
            'grace_days' => (int) env('PROFILE_VERIFICATION_AUTO_SUSPEND_GRACE_DAYS', 7),
            'chunk' => (int) env('PROFILE_VERIFICATION_AUTO_SUSPEND_CHUNK', 100),
        ],
    ],
];
