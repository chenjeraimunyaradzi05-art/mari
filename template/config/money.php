<?php

return [
    'subscription_import_disk' => env('SUBSCRIPTION_IMPORT_DISK', 'local'),
    'subscription_import_status_ttl' => (int) env('SUBSCRIPTION_IMPORT_STATUS_TTL', 6 * 60 * 60),
    'subscription_import_notification_cooldown' => (int) env('SUBSCRIPTION_IMPORT_NOTIFICATION_COOLDOWN', 15 * 60),
];
