<?php

namespace App\Http\Middleware;

use App\Services\Security\DlpService;
use App\Services\SecurityAuditService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

final class ScanForSensitiveData
{
    /**
     * Scan incoming requests for sensitive content and block or log violations.
     */
    public function handle(Request $request, Closure $next)
    {
        if (! $this->shouldScan($request)) {
            return $next($request);
        }

        // Use service locator to avoid constructor change everywhere
        $dlp = app(DlpService::class);
        $audit = app(SecurityAuditService::class);

        [$violations, $critical] = $this->scanRequest($request);

        if (! empty($violations)) {
            // Record in the security audit
            try {
                $audit->log('dlp.violation', [
                    'user' => $request->user(),
                    'request' => $request,
                    'severity' => $critical ? 'critical' : 'warning',
                    'metadata' => ['violations' => $violations],
                ]);
            } catch (\Throwable $e) {
                report($e);
            }

            // Block the request and inform the caller
            return $this->blockResponse($request, $violations);
        }

        return $next($request);
    }


    /**
     * @return (array[]|bool)[]
     *
     * @psalm-return list{array<array>, bool}
     */
    private function scanRequest(Request $request): array
    {
        $violations = [];
        $critical = false;

        $targets = array_merge(
            $this->stringInputs($request),
            $this->fileInputs($request)
        );

        $dlp = app(DlpService::class);

        foreach ($targets as $field => $value) {
            $value = trim($value);

            if ($value === '') {
                continue;
            }

            $fieldViolations = $dlp->scan($value);

            if (! empty($fieldViolations)) {
                $violations[$field] = $fieldViolations;

                if (! $critical) {
                    $critical = collect($fieldViolations)->contains(fn ($violation) => ($violation['severity'] ?? 'info') === 'critical');
                }
            }
        }

        return [$violations, $critical];
    }

    /**
     * @return string[]
     *
     * @psalm-return array<string>
     */
    private function stringInputs(Request $request): array
    {
        $ignored = (array) config('security.dlp.ignore_fields', []);
        $payload = Arr::except($request->all(), $ignored);
        $flattened = Arr::dot($payload);

        $strings = [];

        foreach ($flattened as $key => $value) {
            if (is_string($value)) {
                $strings[$key] = mb_substr($value, 0, 10000);
            }
        }

        return $strings;
    }

    /**
     * @return string[]
     *
     * @psalm-return array<string, string>
     */
    private function fileInputs(Request $request): array
    {
        $config = (array) config('security.dlp.inspect_uploads', []);

        if (! (bool) ($config['enabled'] ?? false)) {
            return [];
        }

        $maxBytes = max(1024, (int) ($config['max_bytes'] ?? 51200));
        $mimeAllowlist = (array) ($config['mime_allowlist'] ?? ['text/*', 'application/json']);
        $exemptFields = (array) ($config['field_exemptions'] ?? []);
        $files = Arr::dot($request->allFiles());
        $payloads = [];

        foreach ($files as $key => $file) {
            if (! $file instanceof UploadedFile) {
                continue;
            }

            if ($this->isExemptUploadField($key, $file, $exemptFields)) {
                continue;
            }

            $mime = (string) $file->getMimeType();

            if (! $this->mimeAllowed($mime, $mimeAllowlist)) {
                continue;
            }

            $path = $file->getRealPath();

            if (! $path || ! is_readable($path)) {
                continue;
            }

            $contents = @file_get_contents($path, false, null, 0, $maxBytes);

            if ($contents === false) {
                continue;
            }

            $contents = trim($contents);

            if ($contents === '') {
                continue;
            }

            $payloads['file:'.$key] = $contents;
        }

        return $payloads;
    }

    private function mimeAllowed(?string $mime, array $allowlist): bool
    {
        if (! $mime) {
            return false;
        }

        foreach ($allowlist as $pattern) {
            if (Str::is($pattern, $mime)) {
                return true;
            }
        }

        return false;
    }

    private function isExemptUploadField(string $key, UploadedFile $file, array $patterns): bool
    {
        $original = $file->getClientOriginalName();

        foreach ($patterns as $pattern) {
            if (Str::is($pattern, $key) || ($original && Str::is($pattern, $original))) {
                return true;
            }
        }

        return false;
    }

    private function shouldScan(Request $request): bool
    {
        if (! config('security.dlp.enabled', true)) {
            return false;
        }

        $method = strtoupper($request->method());
        $allowedMethods = array_map('strtoupper', (array) config('security.dlp.methods', ['POST', 'PUT', 'PATCH']));

        if (! in_array($method, $allowedMethods, true)) {
            return false;
        }

        $routeName = $request->route()?->getName();

        foreach ((array) config('security.dlp.exempt_routes', []) as $pattern) {
            if ($routeName && Str::is($pattern, $routeName)) {
                return false;
            }
        }

        return true;
    }

    private function blockResponse(Request $request, array $violations): \Illuminate\Http\RedirectResponse|\Illuminate\Http\JsonResponse
    {
        $message = 'Your submission contains sensitive information that cannot be stored. Please remove personal identifiers before trying again.';

        if ($request->expectsJson()) {
            return response()->json([
                'message' => $message,
                'violations' => $violations,
            ], 422);
        }

        return redirect()->back()->withErrors(['dlp' => $message]);
    }
}

