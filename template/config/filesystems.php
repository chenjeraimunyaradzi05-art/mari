<?php
/**
 * filesystems Configuration
 * Developer: Munyaradzi Chenjerai
 */

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application. Just store away!
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Here you may configure as many filesystem "disks" as you wish, and you
    | may even configure multiple disks of the same driver. Defaults have
    | been set up for each driver as an example of the required values.
    |
    | Supported Drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app'),
            'throw' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => '/storage',
            'visibility' => 'public',
            'throw' => false,
        ],

        'org_media' => [
            'driver' => env('ORG_MEDIA_DISK_DRIVER', env('ORG_MEDIA_DISK', 'public') === 's3' ? 's3' : 'local'),
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('ORG_MEDIA_S3_BUCKET', env('AWS_BUCKET')),
            'url' => env('ORG_MEDIA_URL', env('APP_URL').'/storage/org-media'),
            'endpoint' => env('ORG_MEDIA_S3_ENDPOINT', env('AWS_ENDPOINT')),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'root' => env('ORG_MEDIA_LOCAL_ROOT', storage_path('app/org-media')),
            'visibility' => 'public',
            'throw' => false,
        ],

        'social_media' => [
            'driver' => env('SOCIAL_MEDIA_DISK_DRIVER', 'local'),
            'key' => env('SOCIAL_MEDIA_S3_KEY', env('AWS_ACCESS_KEY_ID')),
            'secret' => env('SOCIAL_MEDIA_S3_SECRET', env('AWS_SECRET_ACCESS_KEY')),
            'region' => env('SOCIAL_MEDIA_S3_REGION', env('AWS_DEFAULT_REGION')),
            'bucket' => env('SOCIAL_MEDIA_S3_BUCKET', env('AWS_BUCKET')),
            'url' => env('SOCIAL_MEDIA_URL', env('APP_URL').'/storage/social'),
            'endpoint' => env('SOCIAL_MEDIA_S3_ENDPOINT', env('AWS_ENDPOINT')),
            'use_path_style_endpoint' => filter_var(env('SOCIAL_MEDIA_S3_PATH_STYLE', env('AWS_USE_PATH_STYLE_ENDPOINT', false)), FILTER_VALIDATE_BOOLEAN),
            'root' => env('SOCIAL_MEDIA_LOCAL_ROOT', storage_path('app/public/social')),
            'visibility' => env('SOCIAL_MEDIA_VISIBILITY', 'public'),
            'throw' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
        public_path('storage/org-media') => storage_path('app/org-media'),
    ],

];
