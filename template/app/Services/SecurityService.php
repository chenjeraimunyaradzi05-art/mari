<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Security Service
 * Provides security-related utilities and helpers
 */
final class SecurityService
{
    /**
     * Sanitize user input to prevent XSS
     */
    public static function sanitizeInput(string $input): string
    {
        return htmlspecialchars($input, ENT_QUOTES, 'UTF-8');
    }

    /**
     * Sanitize filename to prevent directory traversal
     *
     * @return null|string
     */
    public static function sanitizeFilename(string $filename): string|null
    {
        // Remove any path components
        $filename = basename($filename);

        // Remove special characters except dots, dashes, underscores
        $filename = preg_replace('/[^a-zA-Z0-9._-]/', '', $filename);

        // Prevent double extensions (e.g., file.php.txt)
        $filename = preg_replace('/\.{2,}/', '.', $filename);

        return $filename;
    }

    /**
     * Generate a secure random token
     */
    public static function generateSecureToken(int $length = 32): string
    {
        return Str::random($length);
    }

    /**
     * Check if IP address is blacklisted
     */
    public static function isIpBlacklisted(string $ip): bool
    {
        $blacklist = config('security.ip_control.blacklist');

        if (!$blacklist) {
            return false;
        }

        $blacklistedIps = array_map('trim', explode(',', $blacklist));

        return in_array($ip, $blacklistedIps);
    }

    /**
     * Check if IP address is whitelisted for admin
     */
    public static function isIpWhitelisted(string $ip): bool
    {
        $whitelist = config('security.ip_control.admin_whitelist');

        if (!$whitelist) {
            return true; // If no whitelist, allow all
        }

        $whitelistedIps = array_map('trim', explode(',', $whitelist));

        return in_array($ip, $whitelistedIps);
    }

    /**
     * Rate limit check for specific action
     */
    public static function checkRateLimit(string $key, int $maxAttempts, int $decayMinutes = 1): bool
    {
        $cacheKey = 'rate_limit:' . $key;
        $attempts = Cache::get($cacheKey, 0);

        if ($attempts >= $maxAttempts) {
            return false; // Rate limit exceeded
        }

        Cache::put($cacheKey, $attempts + 1, now()->addMinutes($decayMinutes));

        return true;
    }

    /**
     * Log failed login attempt
     */
    public static function logFailedLogin(string $email, string $ip): void
    {
        if (config('security.monitoring.log_failed_logins')) {
            Log::warning('Failed login attempt', [
                'email' => $email,
                'ip' => $ip,
                'timestamp' => now(),
                'user_agent' => request()->userAgent(),
            ]);
        }

        // Increment failed attempts counter
        $cacheKey = 'failed_logins:' . $ip;
        $attempts = Cache::get($cacheKey, 0);
        Cache::put($cacheKey, $attempts + 1, now()->addMinutes(30));

        // Block IP after X failed attempts
        $maxAttempts = config('security.monitoring.block_after_failed_attempts', 10);
        if ($attempts >= $maxAttempts) {
            self::blockIp($ip);
        }
    }

    /**
     * Block an IP address temporarily
     */
    public static function blockIp(string $ip): void
    {
        $duration = config('security.monitoring.block_duration_minutes', 30);
        Cache::put('blocked_ip:' . $ip, true, now()->addMinutes($duration));

        Log::warning('IP address blocked', [
            'ip' => $ip,
            'duration_minutes' => $duration,
            'timestamp' => now(),
        ]);
    }

    /**
     * Check if IP is currently blocked
     */
    public static function isIpBlocked(string $ip): bool
    {
        return Cache::has('blocked_ip:' . $ip);
    }

    /**
     * Log suspicious activity
     */
    public static function logSuspiciousActivity(string $activity, array $context = []): void
    {
        if (config('security.monitoring.log_suspicious_activity')) {
            Log::warning('Suspicious activity detected', array_merge([
                'activity' => $activity,
                'ip' => request()->ip(),
                'timestamp' => now(),
                'user_agent' => request()->userAgent(),
                'url' => request()->fullUrl(),
            ], $context));
        }
    }

    /**
     * Validate file upload
     *
     * @return string[]
     *
     * @psalm-return list{0?: string, 1?: string, 2?: 'File type not allowed for security reasons'}
     */
    public static function validateFileUpload($file, string $type = 'image'): array
    {
        $errors = [];

        // Check if file exists
        if (!$file) {
            $errors[] = 'No file uploaded';
            return $errors;
        }

        // Check file size
        $maxSize = config("security.uploads.max_sizes.{$type}", 2048); // KB
        if ($file->getSize() > $maxSize * 1024) {
            $errors[] = "File size exceeds maximum of " . ($maxSize / 1024) . "MB";
        }

        // Check MIME type
        $allowedMimes = $type === 'document'
            ? config('security.uploads.allowed_document_mimes')
            : config('security.uploads.allowed_image_mimes');

        if (!in_array($file->getClientOriginalExtension(), $allowedMimes)) {
            $errors[] = 'Invalid file type. Allowed: ' . implode(', ', $allowedMimes);
        }

        // Additional security checks
        $extension = strtolower($file->getClientOriginalExtension());
        $dangerousExtensions = ['php', 'phtml', 'php3', 'php4', 'php5', 'exe', 'sh', 'bat'];

        if (in_array($extension, $dangerousExtensions)) {
            $errors[] = 'File type not allowed for security reasons';
        }

        return $errors;
    }

    /**
     * Mask sensitive data for logging
     */
    public static function maskSensitiveData(string $data, int $visibleChars = 4): string
    {
        $length = strlen($data);

        if ($length <= $visibleChars) {
            return str_repeat('*', $length);
        }

        return substr($data, 0, $visibleChars) . str_repeat('*', $length - $visibleChars);
    }

    /**
     * Validate password strength
     *
     * @return string[]
     *
     * @psalm-return list{0?: string, 1?: string, 2?: 'Password must contain at least one lowercase letter'|'Password must contain at least one number'|'Password must contain at least one special character', 3?: 'Password must contain at least one number'|'Password must contain at least one special character', 4?: 'Password must contain at least one special character'}
     */
    public static function validatePasswordStrength(string $password): array
    {
        $errors = [];
        $minLength = config('security.password.min_length', 8);

        if (strlen($password) < $minLength) {
            $errors[] = "Password must be at least {$minLength} characters";
        }

        if (config('security.password.require_uppercase') && !preg_match('/[A-Z]/', $password)) {
            $errors[] = 'Password must contain at least one uppercase letter';
        }

        if (config('security.password.require_lowercase') && !preg_match('/[a-z]/', $password)) {
            $errors[] = 'Password must contain at least one lowercase letter';
        }

        if (config('security.password.require_numbers') && !preg_match('/[0-9]/', $password)) {
            $errors[] = 'Password must contain at least one number';
        }

        if (config('security.password.require_special_chars') && !preg_match('/[^A-Za-z0-9]/', $password)) {
            $errors[] = 'Password must contain at least one special character';
        }

        return $errors;
    }

    /**
     * Generate Content Security Policy nonce for inline scripts
     */
    public static function generateCspNonce(): string
    {
        if (!session()->has('csp_nonce')) {
            session()->put('csp_nonce', base64_encode(random_bytes(16)));
        }

        return session()->get('csp_nonce');
    }

    /**
     * Clean HTML content to prevent XSS
     *
     * @return null|string
     */
    public static function cleanHtml(string $html): string|null
    {
        // Strip all script tags
        $html = preg_replace('#<script(.*?)>(.*?)</script>#is', '', $html);

        // Strip event handlers (onclick, onload, etc.)
        $html = preg_replace('/\s*on\w+\s*=\s*["\'].*?["\']/i', '', $html);

        // Strip javascript: protocol
        $html = preg_replace('/javascript:/i', '', $html);

        return $html;
    }
}

