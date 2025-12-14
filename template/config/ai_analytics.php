<?php

return [
    'sla' => [
        'warning_minutes' => env('AI_CLIENT_ALERT_SLA_WARNING_MINUTES', 15),
        'critical_minutes' => env('AI_CLIENT_ALERT_SLA_CRITICAL_MINUTES', 45),
    ],
    'resolution_trend' => [
        // Number of lookback windows (hourly) to compute for percentile charts
        'points' => env('AI_CLIENT_ALERT_RESOLUTION_TREND_POINTS', 12),
        // Window size in minutes for each trend point
        'window_minutes' => env('AI_CLIENT_ALERT_RESOLUTION_TREND_WINDOW_MINUTES', 60),
    ],
];
