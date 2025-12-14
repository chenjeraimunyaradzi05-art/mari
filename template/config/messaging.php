<?php

return [
    'meta_updated_at' => env('MESSAGING_META_UPDATED_AT', '2025-11-17T00:00:00Z'),
    'cdn' => [
        'status' => env('MESSAGING_CDN_STATUS', 'online'),
        'rolling_latency_ms' => (int) env('MESSAGING_CDN_LATENCY_MS', 120),
        'latency_window_seconds' => (int) env('MESSAGING_CDN_LATENCY_WINDOW_SECONDS', 300),
        'degraded_above_latency_ms' => (int) env('MESSAGING_CDN_DEGRADED_THRESHOLD_MS', 400),
        'latency_trend' => env('MESSAGING_CDN_LATENCY_TREND', 'steady'),
        'latency_trend_delta_ms' => (int) env('MESSAGING_CDN_LATENCY_TREND_DELTA_MS', 25),
        'latency_sample_size' => (int) env('MESSAGING_CDN_LATENCY_SAMPLE_SIZE', 12),
        'latency_percentiles' => (static function (): array {
            $raw = explode(',', (string) env('MESSAGING_CDN_LATENCY_PERCENTILES', '50,95'));
            $values = array_values(array_filter(
                array_map(
                    static fn ($value) => (int) trim((string) $value),
                    $raw
                ),
                static fn (int $value) => $value > 0 && $value < 100
            ));

            return $values ?: [50, 95];
        })(),
        'latency_histogram_buckets_ms' => (static function (): array {
            $raw = explode(',', (string) env('MESSAGING_CDN_LATENCY_HISTOGRAM_MS', '150,300,600'));
            $values = array_values(array_filter(
                array_map(
                    static fn ($value) => (int) trim((string) $value),
                    $raw
                ),
                static fn (int $value) => $value > 0
            ));

            sort($values);

            if (!$values) {
                return [200, 400, 800];
            }

            return array_values(array_unique($values));
        })(),
        'latency_probe_url' => env('MESSAGING_CDN_LATENCY_PROBE_URL'),
        'latency_probe_method' => strtoupper(env('MESSAGING_CDN_LATENCY_PROBE_METHOD', 'HEAD')),
        'latency_probe_timeout' => (float) env('MESSAGING_CDN_LATENCY_PROBE_TIMEOUT', 2.5),
        'latency_probe_connect_timeout' => (float) env('MESSAGING_CDN_LATENCY_PROBE_CONNECT_TIMEOUT', 1.5),
        'latency_probe_retries' => (int) env('MESSAGING_CDN_LATENCY_PROBE_RETRIES', 1),
        'latency_probe_frequency_minutes' => (int) env('MESSAGING_CDN_LATENCY_PROBE_FREQUENCY_MINUTES', 5),
        'latency_probe_batch' => (int) env('MESSAGING_CDN_LATENCY_PROBE_BATCH', 1),
        'latency_retention_minutes' => (int) env('MESSAGING_CDN_LATENCY_RETENTION_MINUTES', 1440),
        'latency_stale_threshold_minutes' => (int) env('MESSAGING_CDN_LATENCY_STALE_THRESHOLD_MINUTES', 15),
        'latency_success_ratio_target' => (float) env('MESSAGING_CDN_LATENCY_SUCCESS_RATIO_TARGET', 0.9),
        'latency_failure_streak_threshold' => (int) env('MESSAGING_CDN_LATENCY_FAILURE_STREAK_THRESHOLD', 3),
        'max_attachments_per_message' => (int) env('MESSAGING_MAX_ATTACHMENTS', 5),
        'video_uploads_enabled' => filter_var(env('MESSAGING_VIDEO_ENABLED', false), FILTER_VALIDATE_BOOL),
        'supported_video_formats' => array_values(array_filter(array_map(
            'trim',
            explode(',', env('MESSAGING_VIDEO_FORMATS', 'mp4,webm'))
        ))),
        'per_type_upload_limits' => [
            'image' => [
                'per_message' => (int) env('MESSAGING_IMAGE_ATTACHMENTS_PER_MESSAGE', 5),
                'per_day' => (int) env('MESSAGING_IMAGE_ATTACHMENTS_PER_DAY', 40),
            ],
            'file' => [
                'per_message' => (int) env('MESSAGING_FILE_ATTACHMENTS_PER_MESSAGE', 2),
                'per_day' => (int) env('MESSAGING_FILE_ATTACHMENTS_PER_DAY', 15),
            ],
            'video' => [
                'per_message' => (int) env('MESSAGING_VIDEO_ATTACHMENTS_PER_MESSAGE', 1),
                'per_day' => (int) env('MESSAGING_VIDEO_ATTACHMENTS_PER_DAY', 8),
                'max_duration_seconds' => (int) env('MESSAGING_VIDEO_MAX_DURATION_SECONDS', 90),
            ],
        ],
    ],
];
