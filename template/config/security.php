<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Security Configuration
    |--------------------------------------------------------------------------
    |
    | This file contains security-related configuration for your application.
    | Adjust these settings based on your security requirements.
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Rate Limiting
    |--------------------------------------------------------------------------
    |
    | Configure rate limits for different parts of your application to prevent
    | abuse and brute-force attacks.
    |
    */

    'rate_limits' => [
        // API requests per minute
        'api' => env('RATE_LIMIT_API', 60),

        // Login attempts per minute
        'login' => env('RATE_LIMIT_LOGIN', 5),

        // Registration attempts per hour
        'register' => env('RATE_LIMIT_REGISTER', 3),

        // Password reset requests per hour
        'password_reset' => env('RATE_LIMIT_PASSWORD_RESET', 3),

        // Job application submissions per hour
        'job_apply' => env('RATE_LIMIT_JOB_APPLY', 10),

        // Contact form submissions per hour
        'contact' => env('RATE_LIMIT_CONTACT', 3),

        // Newsletter subscriptions per hour
        'newsletter' => env('RATE_LIMIT_NEWSLETTER', 2),
    ],

    /*
    |--------------------------------------------------------------------------
    | File Upload Security
    |--------------------------------------------------------------------------
    |
    | Configure allowed file types and maximum file sizes for uploads.
    |
    */

    'uploads' => [
        'allowed_image_mimes' => ['jpeg', 'jpg', 'png', 'gif', 'webp'],
        'allowed_document_mimes' => ['pdf', 'doc', 'docx'],

        'max_sizes' => [
            // Maximum file sizes in kilobytes
            'logo' => env('MAX_LOGO_SIZE', 2048), // 2MB
            'banner' => env('MAX_BANNER_SIZE', 5120), // 5MB
            'profile_image' => env('MAX_PROFILE_IMAGE_SIZE', 3072), // 3MB
            'cv' => env('MAX_CV_SIZE', 10240), // 10MB
            'blog_image' => env('MAX_BLOG_IMAGE_SIZE', 3072), // 3MB
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Password Requirements
    |--------------------------------------------------------------------------
    |
    | Configure password strength requirements for user accounts.
    |
    */

    'password' => [
        'min_length' => env('PASSWORD_MIN_LENGTH', 8),
        'require_uppercase' => env('PASSWORD_REQUIRE_UPPERCASE', true),
        'require_lowercase' => env('PASSWORD_REQUIRE_LOWERCASE', true),
        'require_numbers' => env('PASSWORD_REQUIRE_NUMBERS', true),
        'require_special_chars' => env('PASSWORD_REQUIRE_SPECIAL', false),
    ],

    /*
    |--------------------------------------------------------------------------
    | Session Security
    |--------------------------------------------------------------------------
    |
    | Configure session security settings.
    |
    */

    'session' => [
        // Force logout after specified minutes of inactivity
        'idle_timeout' => env('SESSION_IDLE_TIMEOUT', 120),

        // Regenerate session ID on login (prevents session fixation)
        'regenerate_on_login' => true,

        // Require session validation per IP
        'validate_ip' => env('SESSION_VALIDATE_IP', false),

        // Require session validation per user agent
        'validate_user_agent' => env('SESSION_VALIDATE_USER_AGENT', false),
    ],

    'session_security' => [
        'window_minutes' => env('SESSION_SECURITY_WINDOW_MINUTES', 60),
        'known_device_days' => env('SESSION_SECURITY_KNOWN_DEVICE_DAYS', 30),
        'detect_country_hopping' => env('SESSION_SECURITY_COUNTRY_DRIFT', true),
        'detect_new_devices' => env('SESSION_SECURITY_NEW_DEVICES', true),
    ],

    'dlp' => [
        'enabled' => env('DLP_ENABLED', true),
        'methods' => ['POST', 'PUT', 'PATCH'],
        'ignore_fields' => ['password', 'password_confirmation', '_token'],
        'exempt_routes' => [
            'admin.auth0.*',
            // verification endpoints need to accept identifiers during company verification
            'company.verification.*',
        ],
        'inspect_uploads' => [
            'enabled' => env('DLP_SCAN_UPLOADS', true),
            'max_bytes' => env('DLP_UPLOAD_MAX_BYTES', 51200),
            'mime_allowlist' => [
                'text/*',
                'application/json',
                'application/xml',
                'application/pdf',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ],
            'field_exemptions' => [],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | CORS (Cross-Origin Resource Sharing)
    |--------------------------------------------------------------------------
    |
    | Configure which domains can access your API endpoints.
    |
    */

    'cors' => [
        'allowed_origins' => env('CORS_ALLOWED_ORIGINS', '*'),
        'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        'allowed_headers' => ['Content-Type', 'Authorization', 'X-Requested-With'],
        'expose_headers' => [],
        'max_age' => 86400, // 24 hours
        'supports_credentials' => false,
    ],

    /*
    |--------------------------------------------------------------------------
    | XSS Protection
    |--------------------------------------------------------------------------
    |
    | Configure XSS (Cross-Site Scripting) protection settings.
    |
    */

    'xss' => [
        // Automatically escape output in Blade templates (already default in Laravel)
        'auto_escape' => true,

        // Allowed HTML tags for user-generated content (if using HTML Purifier)
        'allowed_tags' => ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li'],
    ],

    /*
    |--------------------------------------------------------------------------
    | API Security
    |--------------------------------------------------------------------------
    |
    | Configure API authentication and security settings.
    |
    */

    'api' => [
        // Require API key for all API requests
        'require_api_key' => env('API_REQUIRE_KEY', false),

        // API key header name
        'api_key_header' => 'X-API-Key',

        // API rate limit per minute
        'rate_limit' => env('API_RATE_LIMIT', 60),

        // API version (for versioning)
        'version' => env('API_VERSION', 'v1'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Content Validation
    |--------------------------------------------------------------------------
    |
    | Configure validation rules for user-generated content.
    |
    */

    'validation' => [
        // Maximum length for text inputs
        'max_title_length' => 255,
        'max_description_length' => 5000,
        'max_bio_length' => 1000,

        // Minimum requirements
        'min_job_title_length' => 3,
        'min_company_name_length' => 2,

        // Regex patterns
        'phone_pattern' => '/^[0-9+\-\(\) ]+$/',
        'website_pattern' => '/^https?:\/\/.+\..+$/',
    ],

    /*
    |--------------------------------------------------------------------------
    | SQL Injection Protection
    |--------------------------------------------------------------------------
    |
    | Laravel's query builder automatically protects against SQL injection,
    | but these settings help enforce best practices.
    |
    */

    'sql' => [
        // Never use DB::raw() with user input
        'warn_raw_queries' => env('SQL_WARN_RAW_QUERIES', true),

        // Log all database queries in development
        'log_queries' => env('SQL_LOG_QUERIES', false),
    ],

    /*
    |--------------------------------------------------------------------------
    | Two-Factor Authentication
    |--------------------------------------------------------------------------
    |
    | Configure 2FA settings (if implemented).
    |
    */

    'two_factor' => [
        'enabled' => env('TWO_FACTOR_ENABLED', false),
        'required_for_admin' => env('TWO_FACTOR_REQUIRED_ADMIN', false),
    ],

    /*
    |--------------------------------------------------------------------------
    | Backup and Recovery
    |--------------------------------------------------------------------------
    |
    | Configure automatic backup settings.
    |
    */

    'backup' => [
        'enabled' => env('BACKUP_ENABLED', false),
        'frequency' => env('BACKUP_FREQUENCY', 'daily'), // daily, weekly, monthly
        'retention_days' => env('BACKUP_RETENTION_DAYS', 30),
        'disk' => env('BACKUP_DISK', 's3'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Security Monitoring
    |--------------------------------------------------------------------------
    |
    | Configure security event monitoring and logging.
    |
    */

    'monitoring' => [
        // Log failed login attempts
        'log_failed_logins' => env('LOG_FAILED_LOGINS', true),

        // Log suspicious activities
        'log_suspicious_activity' => env('LOG_SUSPICIOUS_ACTIVITY', true),

        // Email admin on security events
        'alert_admin_email' => env('SECURITY_ALERT_EMAIL', null),

        // Block IP after X failed login attempts
        'block_after_failed_attempts' => env('BLOCK_AFTER_ATTEMPTS', 10),
        'block_duration_minutes' => env('BLOCK_DURATION_MINUTES', 30),
    ],

    /*
    |--------------------------------------------------------------------------
    | IP Whitelist/Blacklist
    |--------------------------------------------------------------------------
    |
    | Configure IP-based access control (optional).
    |
    */

    'ip_control' => [
        'enabled' => env('IP_CONTROL_ENABLED', false),

        // Whitelist specific IPs for admin panel
        'admin_whitelist' => env('ADMIN_IP_WHITELIST', null), // Comma-separated IPs

        // Blacklist known malicious IPs
        'blacklist' => env('IP_BLACKLIST', null), // Comma-separated IPs
    ],

    'audit_export' => [
        'disk' => env('SECURITY_AUDIT_EXPORT_DISK', env('FILESYSTEM_DISK', 'local')),
        'path_prefix' => env('SECURITY_AUDIT_EXPORT_PATH', 'security/audit-logs'),
        'batch_size' => env('SECURITY_AUDIT_EXPORT_BATCH', 1000),
        'visibility' => env('SECURITY_AUDIT_EXPORT_VISIBILITY', 'private'),
        'schedule' => [
            'enabled' => env('SECURITY_AUDIT_EXPORT_SCHEDULED', true),
            'frequency' => env('SECURITY_AUDIT_EXPORT_FREQUENCY', 'fifteen'),
        ],
    ],

];
