<?php
/**
 * queue Configuration
 * Developer: Munyaradzi Chenjerai
 */

$socialMediaConnection = [
    'driver' => env('SOCIAL_QUEUE_DRIVER', env('QUEUE_CONNECTION', 'redis')),
    'connection' => env('SOCIAL_QUEUE_REDIS_CONNECTION', 'default'),
    'table' => env('SOCIAL_QUEUE_TABLE', 'queue_jobs'),
    'queue' => env('SOCIAL_MEDIA_QUEUE', 'social-media'),
    'retry_after' => (int) env('SOCIAL_QUEUE_RETRY_AFTER', 120),
    'block_for' => env('SOCIAL_QUEUE_BLOCK_FOR', null),
    'after_commit' => filter_var(env('SOCIAL_QUEUE_AFTER_COMMIT', true), FILTER_VALIDATE_BOOLEAN),
];

return [

    /*
    |--------------------------------------------------------------------------
    | Default Queue Connection Name
    |--------------------------------------------------------------------------
    |
    | Laravel's queue API supports an assortment of back-ends via a single
    | API, giving you convenient access to each back-end using the same
    | syntax for every one. Here you may define a default connection.
    |
    */

    'default' => env('QUEUE_CONNECTION', 'sync'),

    /*
    |--------------------------------------------------------------------------
    | Queue Connections
    |--------------------------------------------------------------------------
    |
    | Here you may configure the connection information for each server that
    | is used by your application. A default configuration has been added
    | for each back-end shipped with Laravel. You are free to add more.
    |
    | Drivers: "sync", "database", "beanstalkd", "sqs", "redis", "null"
    |
    */

    'connections' => [

        'sync' => [
            'driver' => 'sync',
        ],

        'database' => [
            'driver' => 'database',
            'table' => env('QUEUE_TABLE', 'queue_jobs'),
            'queue' => 'default',
            'retry_after' => 90,
            'after_commit' => false,
        ],

        'beanstalkd' => [
            'driver' => 'beanstalkd',
            'host' => 'localhost',
            'queue' => 'default',
            'retry_after' => 90,
            'block_for' => 0,
            'after_commit' => false,
        ],

        'sqs' => [
            'driver' => 'sqs',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'prefix' => env('SQS_PREFIX', 'https://sqs.us-east-1.amazonaws.com/your-account-id'),
            'queue' => env('SQS_QUEUE', 'default'),
            'suffix' => env('SQS_SUFFIX'),
            'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
            'after_commit' => false,
        ],

        'redis' => [
            'driver' => 'redis',
            'connection' => 'default',
            'queue' => env('REDIS_QUEUE', 'default'),
            'retry_after' => 90,
            'block_for' => null,
            'after_commit' => false,
        ],

        'social_media' => $socialMediaConnection,

        // Alias for teams that prefer hyphenated connection names in QUEUE_CONNECTION/SOCIAL_QUEUE_CONNECTION
        'social-media' => $socialMediaConnection,

    ],

    /*
    |--------------------------------------------------------------------------
    | Job Batching
    |--------------------------------------------------------------------------
    |
    | The following options configure the database and table that store job
    | batching information. These options can be updated to any database
    | connection and table which has been defined by your application.
    |
    */

    'batching' => [
        'database' => env('DB_CONNECTION', 'mysql'),
        'table' => 'job_batches',
    ],

    /*
    |--------------------------------------------------------------------------
    | Failed Queue Jobs
    |--------------------------------------------------------------------------
    |
    | These options configure the behavior of failed queue job logging so you
    | can control which database and table are used to store the jobs that
    | have failed. You may change them to any database / table you wish.
    |
    */

    'failed' => [
        'driver' => env('QUEUE_FAILED_DRIVER', 'database-uuids'),
        'database' => env('DB_CONNECTION', 'mysql'),
        'table' => 'failed_jobs',
    ],

    'worker_priorities' => [
        'default' => [
            'critical',
            'notifications',
            'mortgage-intel',
            'social-feed',
            'social-media',
            'analytics',
            'revenue',
            'batch-processing',
            'default',
            'low',
        ],
        'redis' => [
            'social-feed',
            'social-media',
            'analytics',
            'revenue',
            'notifications',
            'default',
        ],
    ],

];
