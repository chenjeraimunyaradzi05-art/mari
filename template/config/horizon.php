<?php

use Illuminate\Support\Str;

return [
    'domain' => env('HORIZON_DOMAIN'),

    'path' => env('HORIZON_PATH', 'horizon'),

    'use' => env('HORIZON_USE', 'default'),

    'prefix' => env('HORIZON_PREFIX', env('REDIS_PREFIX', Str::slug(env('APP_NAME', 'laravel'), '_').'_horizon:')),

    'middleware' => ['web'],

    'waits' => [
        'redis:default' => 60,
        'redis:business-digests' => 60,
    ],

    'trim' => [
        'recent' => 60,
        'pending' => 60,
        'completed' => 60,
        'recent_failed' => 10080,
        'failed' => 10080,
        'monitored' => 10080,
    ],

    'fast_terminations' => [
        'redis:default' => 0,
        'redis:business-digests' => 0,
    ],

    'memory_limit' => env('HORIZON_MEMORY_LIMIT', 128),

    'defaults' => [
        'supervisor-default' => [
            'connection' => env('HORIZON_CONNECTION', 'redis'),
            'queue' => ['default'],
            'balance' => 'auto',
            'minProcesses' => 1,
            'maxProcesses' => 3,
            'balanceMaxShift' => 1,
            'balanceCooldown' => 3,
            'tries' => 3,
            'timeout' => 60,
            'nice' => 0,
        ],
        'business-digests' => [
            'connection' => env('HORIZON_CONNECTION', 'redis'),
            'queue' => ['business-digests'],
            'balance' => 'auto',
            'minProcesses' => 1,
            'maxProcesses' => env('HORIZON_BUSINESS_DIGEST_PROCESSES', 2),
            'balanceMaxShift' => 1,
            'balanceCooldown' => 3,
            'tries' => 3,
            'timeout' => 60,
            'nice' => 0,
        ],
    ],

    'environments' => [
        'production' => [
            'supervisor-default' => [
                'maxProcesses' => env('HORIZON_PROD_DEFAULT_PROCESSES', 5),
            ],
            'business-digests' => [
                'maxProcesses' => env('HORIZON_PROD_BUSINESS_DIGEST_PROCESSES', 4),
            ],
        ],

        'local' => [
            'supervisor-default' => [
                'maxProcesses' => 1,
            ],
            'business-digests' => [
                'maxProcesses' => 1,
            ],
        ],
    ],
];
