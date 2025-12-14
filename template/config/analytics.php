<?php

return [
    'dashboard_cache' => [
        'pulse_ttl' => (int) env('DASHBOARD_PULSE_TTL', 600),
        'pulse_history_ttl' => (int) env('DASHBOARD_PULSE_HISTORY_TTL', 900),
        'payout_ttl' => (int) env('DASHBOARD_PAYOUT_TTL', 900),
        'streams_ttl' => (int) env('DASHBOARD_STREAMS_TTL', 600),
        'persona_ttl' => (int) env('DASHBOARD_PERSONA_TTL', 300),
    ],
    'ingestion' => [
        'async' => (bool) env('ANALYTICS_ASYNC', false),
        'queue' => env('ANALYTICS_QUEUE', 'analytics'),
        'queue_connection' => env('ANALYTICS_QUEUE_CONNECTION', env('QUEUE_CONNECTION', 'database')),
        'max_batch_size' => (int) env('ANALYTICS_BATCH_SIZE', 50),
        'log_channel' => env('ANALYTICS_LOG_CHANNEL', env('LOG_CHANNEL', 'stack')),
        'retention_days' => (int) env('ANALYTICS_RETENTION_DAYS', 90),
    ],
    // Optional SIEM / external ingestion settings used by StreamAdminLoginEvent.
    'siem_endpoint' => env('ANALYTICS_SIEM_ENDPOINT', null),
    'siem_api_key' => env('ANALYTICS_SIEM_API_KEY', null),
    // Optional HMAC secret used to sign payloads. When set, StreamAdminLoginEvent
    // will add X-Signature and X-Signature-Timestamp headers to outgoing requests.
    'siem_hmac_secret' => env('ANALYTICS_SIEM_HMAC_SECRET', null),
    // Timeout for outgoing HTTP calls to SIEM endpoints (seconds).
    'siem_timeout' => (int) env('ANALYTICS_SIEM_TIMEOUT', 5),
];
