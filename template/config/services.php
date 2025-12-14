<?php
/**
 * services Configuration
 * Developer: Munyaradzi Chenjerai
 */

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme' => 'https',
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'recaptcha' => [
        'secret' => env('RECAPTCHA_SECRET'),
    ],

    'career_intelligence' => [
        'base_url' => env('SERVICE_CAREER_INTELLIGENCE_URL'),
        'timeout' => (int) env('SERVICE_CAREER_INTELLIGENCE_TIMEOUT', 5),
    ],

    'onboarding_personas' => [
        'base_url' => env('SERVICE_ONBOARDING_URL'),
        'timeout' => (int) env('SERVICE_ONBOARDING_TIMEOUT', 5),
    ],

    'vertical_gateway' => [
        'base_url' => env('SERVICE_VERTICALS_URL'),
        'timeout' => (int) env('SERVICE_VERTICALS_TIMEOUT', 5),
    ],

    'opportunity_streams' => [
        'base_url' => env('SERVICE_OPPORTUNITY_STREAMS_URL'),
        'timeout' => (int) env('SERVICE_OPPORTUNITY_STREAMS_TIMEOUT', 5),
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI'),
    ],

    'openai' => [
        'api_key' => env('OPENAI_API_KEY', env('AI_OPENAI_API_KEY')),
        'organization' => env('OPENAI_ORGANIZATION', env('AI_OPENAI_ORG')),
        'chat_model' => env('OPENAI_CHAT_MODEL', env('AI_OPENAI_CHAT_MODEL', 'gpt-4.1-mini')),
        'base_url' => env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
        'timeout' => (int) env('OPENAI_TIMEOUT', 15),
    ],

    'ai' => [
        'enabled' => (bool) env('AI_SOCIAL_CONTENT_ENABLED', env('AI_ENABLED', false)),
        'default_provider' => env('AI_DEFAULT_PROVIDER', 'openai'),
        'log_channel' => env('AI_LOG_CHANNEL', 'stack'),
        'cache_ttl' => (int) env('AI_CACHE_TTL_DEFAULT', 900),
        'content' => [
            'max_tags' => (int) env('AI_SOCIAL_MAX_TAGS', 8),
            'fallback_score' => (float) env('AI_SOCIAL_FALLBACK_SCORE', 48),
        ],
        'document_limit' => [
            'attempts' => (int) env('AI_DOCUMENT_ATTEMPTS', 5),
            'decay' => (int) env('AI_DOCUMENT_DECAY', 60),
        ],
        'providers' => [
            'openai' => [
                'api_key' => env('AI_OPENAI_API_KEY', env('OPENAI_API_KEY')),
                'chat_model' => env('AI_OPENAI_CHAT_MODEL', env('OPENAI_CHAT_MODEL', 'gpt-4.1-mini')),
                'base_url' => env('AI_OPENAI_BASE_URL', env('OPENAI_BASE_URL', 'https://api.openai.com/v1')),
                'timeout' => (int) env('AI_OPENAI_TIMEOUT', env('OPENAI_TIMEOUT', 15)),
                'document_limit' => [
                    'attempts' => (int) env('AI_OPENAI_DOCUMENT_ATTEMPTS', env('AI_DOCUMENT_ATTEMPTS', 5)),
                    'decay' => (int) env('AI_OPENAI_DOCUMENT_DECAY', env('AI_DOCUMENT_DECAY', 60)),
                ],
            ],
            'anthropic' => [
                'api_key' => env('AI_ANTHROPIC_API_KEY'),
                'chat_model' => env('AI_ANTHROPIC_CHAT_MODEL', 'claude-3-5-sonnet-20241022'),
            ],
        ],
    ],

    'media_scan' => [
        'enabled' => (bool) env('MEDIA_SCAN_ENABLED', false),
        'base_url' => env('MEDIA_SCAN_BASE_URL'),
        'api_key' => env('MEDIA_SCAN_API_KEY'),
        'timeout' => (int) env('MEDIA_SCAN_TIMEOUT', 25),
        'alert_email' => env('MEDIA_SCAN_ALERT_EMAIL', env('SECURITY_ALERT_EMAIL')),
        'log_channel' => env('MEDIA_SCAN_LOG_CHANNEL', env('LOG_CHANNEL', 'stack')),
    ],

];
