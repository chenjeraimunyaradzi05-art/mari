<?php

return [
    'digests' => [
        'queue' => env('BUSINESS_DIGEST_QUEUE', 'business-digests'),
        'local_hours' => array_filter(explode(',', env('BUSINESS_DIGEST_LOCAL_HOURS', '7,19'))),
        'timezone_fallback' => env('BUSINESS_DIGEST_TIMEZONE', null),
        'timezone_sync' => [
            'lookback_hours' => (int) env('BUSINESS_TIMEZONE_SYNC_LOOKBACK_HOURS', 720),
        ],
    ],
];
