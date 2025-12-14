<?php

namespace App\Casts;

use App\Support\Messaging\ShareMetadataFormatter;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

final class ShareMetadataCast implements CastsAttributes
{
    #[\Override]
    public function get(Model $model, string $key, mixed $value, array $attributes): mixed
    {
        if ($value === null) {
            return null;
        }

        $decoded = is_array($value) ? $value : json_decode($value, true);

        if (!is_array($decoded)) {
            return $decoded;
        }

        return ShareMetadataFormatter::canonicalize($decoded);
    }

    #[\Override]
    public function set(Model $model, string $key, mixed $value, array $attributes): mixed
    {
        if ($value === null) {
            return null;
        }

        if (!is_array($value)) {
            return $value;
        }

        return json_encode(ShareMetadataFormatter::canonicalize($value));
    }
}

