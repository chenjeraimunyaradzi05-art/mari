<?php

namespace App\Support;

use Illuminate\Support\Str;

final class FeatureFlag
{
    /**
     * Determine if a feature flag is enabled.
     */
    public static function enabled(string $flag, bool $default = false): bool
    {
        $value = config('features.' . $flag);

        if ($value === null) {
            return $default;
        }

        if (is_bool($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (bool) $value;
        }

        if (is_string($value)) {
            $normalized = Str::lower($value);
            if (in_array($normalized, ['1', 'true', 'yes', 'on'], true)) {
                return true;
            }
            if (in_array($normalized, ['0', 'false', 'no', 'off'], true)) {
                return false;
            }
        }

        return (bool) $value;
    }

    /**
     * Abort the request if the feature flag is disabled.
     */
    public static function ensure(string $flag, int $status = 404, ?string $message = null): void
    {
        if (! self::enabled($flag)) {
            abort($status, $message ?? 'This feature is currently unavailable.');
        }
    }
}

