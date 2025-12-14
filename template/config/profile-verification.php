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
];
