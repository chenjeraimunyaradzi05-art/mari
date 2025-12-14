<?php

namespace App\Support;

use Illuminate\Support\Str;

final class ContactHasher
{
    public static function hash(string $value): string
    {
        $normalized = strtolower(trim($value));
        $salt = config('social_invites.contact_sync.hash_salt')
            ?? config('app.key')
            ?? Str::random(16);

        return hash('sha256', $salt.$normalized);
    }
}

