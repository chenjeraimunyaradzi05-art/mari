<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Security Headers Middleware
 * Adds comprehensive security headers to all responses
 */
final class SecurityHeaders
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Prevent clickjacking attacks
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');

        // Prevent MIME type sniffing
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        // Enable XSS protection in browsers
        $response->headers->set('X-XSS-Protection', '1; mode=block');

        // Strict Transport Security (HSTS) - Force HTTPS
        // Only enable in production with valid SSL certificate
        if (config('app.env') === 'production') {
            $response->headers->set(
                'Strict-Transport-Security',
                'max-age=31536000; includeSubDomains; preload'
            );
        }

        // Content Security Policy (CSP)
        // Adjust based on your CDN and third-party scripts
        $csp = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://www.google.com https://www.gstatic.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: https: http:",
            "connect-src 'self' https://www.youtube.com https://www.instagram.com https://www.facebook.com https://twitframe.com",
            "frame-src 'self' https://www.google.com https://www.youtube.com https://player.vimeo.com https://www.instagram.com https://www.facebook.com https://twitframe.com https://www.threads.net",
            "object-src 'none'",
            "base-uri 'self'",
        ];
        $response->headers->set('Content-Security-Policy', implode('; ', $csp));

        // Referrer Policy - Protect user privacy
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Permissions Policy (formerly Feature Policy)
        $permissions = [
            'geolocation=()',
            'microphone=(self)',
            'camera=(self)',
            'payment=(self)',
            'usb=()',
            'magnetometer=()',
            'gyroscope=()',
            'accelerometer=()',
        ];
        $response->headers->set('Permissions-Policy', implode(', ', $permissions));

        // Remove sensitive server information
        $response->headers->remove('X-Powered-By');
        $response->headers->remove('Server');

        return $response;
    }
}

