<?php

declare(strict_types=1);

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;
use InvalidArgumentException;
use JsonException;
use RuntimeException;
use Illuminate\Contracts\Encryption\DecryptException;

final class EncryptedJson implements CastsAttributes
{
    #[\Override]
    public function get(Model $model, string $key, mixed $value, array $attributes): mixed
    {
        if ($value === null) {
            return null;
        }

        if (! is_string($value)) {
            return $this->extractFromEnvelope($value, $key);
        }

        $decrypted = $this->attemptDecrypt($value);

        if ($decrypted !== null) {
            return $this->decodeJson($decrypted, $key);
        }

        $decoded = $this->decodeJson($value, $key);

        if ($this->isEnvelope($decoded)) {
            return $this->extractFromEnvelope($decoded, $key);
        }

        return $decoded;
    }

    #[\Override]
    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }

        if (is_string($value)) {
            if ($this->attemptDecrypt($value) !== null) {
                return $value;
            }

            $decoded = $this->decodeJson($value, $key);

            if ($this->isEnvelope($decoded)) {
                return json_encode($decoded, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }

            $value = $decoded;
        }

        if ($value instanceof Arrayable) {
            $value = $value->toArray();
        }

        if (! is_array($value)) {
            throw new InvalidArgumentException(sprintf('EncryptedJson cast for %s expects an array or null.', $key));
        }

        $encoded = $this->encodeJson($value, $key);

        $payload = [
            '_encrypted' => true,
            'ciphertext' => Crypt::encryptString($encoded),
        ];

        return json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function attemptDecrypt(string $value): ?string
    {
        try {
            return Crypt::decryptString($value);
        } catch (DecryptException) {
            return null;
        }
    }

    private function decodeJson(string $value, string $key): array
    {
        try {
            $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException(sprintf('Unable to decode JSON for %s: %s', $key, $exception->getMessage()), (int) $exception->getCode(), $exception);
        }

        if ($decoded === null) {
            return [];
        }

        if (! is_array($decoded)) {
            throw new RuntimeException(sprintf('Decoded JSON for %s did not produce an array.', $key));
        }

        return $decoded;
    }

    private function encodeJson(array $value, string $key): string
    {
        try {
            return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (JsonException $exception) {
            throw new RuntimeException(sprintf('Unable to encode JSON for %s: %s', $key, $exception->getMessage()), (int) $exception->getCode(), $exception);
        }
    }

    private function isEnvelope(array $value): bool
    {
        return isset($value['_encrypted'], $value['ciphertext']) && $value['_encrypted'] === true && is_string($value['ciphertext']);
    }

    private function extractFromEnvelope(array $value, string $key): array
    {
        if (! $this->isEnvelope($value)) {
            return $value;
        }

        $decrypted = $this->attemptDecrypt($value['ciphertext']);

        if ($decrypted === null) {
            return [];
        }

        return $this->decodeJson($decrypted, $key);
    }
}

