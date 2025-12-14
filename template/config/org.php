<?php

return [
    'media_disk' => env('ORG_MEDIA_DISK', env('FILESYSTEM_DISK', 'public')),
    'media_queue' => env('ORG_MEDIA_QUEUE', env('QUEUE_CONNECTION', 'database')),
    'max_upload_size' => (int) env('ORG_MEDIA_MAX_UPLOAD', 512 * 1024),

    'hls' => [
        'enabled' => env('ORG_MEDIA_HLS_ENABLED', true),
        'ffmpeg_binary' => env('FFMPEG_PATH', 'ffmpeg'),
        'ffprobe_binary' => env('FFPROBE_PATH', 'ffprobe'),
        'segment_length' => env('ORG_MEDIA_HLS_SEGMENT_LENGTH', 6),
        'playlist_prefix' => env('ORG_MEDIA_HLS_PREFIX', 'hls/org_media'),
        'variants' => [
            [
                'name' => '1080p',
                'height' => 1080,
                'bitrate' => 8000,
                'audio_bitrate' => 192,
            ],
            [
                'name' => '720p',
                'height' => 720,
                'bitrate' => 5000,
                'audio_bitrate' => 160,
            ],
            [
                'name' => '480p',
                'height' => 480,
                'bitrate' => 2500,
                'audio_bitrate' => 128,
            ],
        ],
    ],

    'moderation' => [
        'provider' => env('ORG_MEDIA_MODERATION_PROVIDER', 'aws'),
        'confidence_threshold' => (float) env('ORG_MEDIA_MODERATION_CONFIDENCE', 0.7),
        'flagged_labels' => [
            'explicit nudity',
            'suggestive',
            'violence',
            'hate symbols',
            'guns',
            'alcohol',
            'gambling',
        ],
        'openai' => [
            'api_key' => env('OPENAI_API_KEY'),
            'model' => env('ORG_MEDIA_MODERATION_MODEL', 'omni-moderation-latest'),
        ],
        'blocklist' => [
            'hate',
            'racist',
            'terrorist',
            'bomb',
            'kill',
            'nazi',
            'suicide',
            'self-harm',
            'slur',
        ],
    ],
];
