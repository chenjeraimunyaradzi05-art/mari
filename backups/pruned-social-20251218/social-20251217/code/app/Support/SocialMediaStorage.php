<?php

namespace App\Support;

use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use function asset;

final class SocialMediaStorage
{
	public static function diskName(): string
	{
		return config('social.media.disk', config('filesystems.default', 'public'));
	}

	public static function disk(): FilesystemAdapter
	{
		return Storage::disk(static::diskName());
	}

	public static function normalize(?string $path): ?string
	{
		if (! $path) {
			return null;
		}

		$candidate = parse_url($path, PHP_URL_PATH) ?: $path;
		$trimmed = ltrim($candidate, '/');

		if ($trimmed === '') {
			return null;
		}

		if (Str::startsWith($trimmed, 'storage/')) {
			$trimmed = ltrim(Str::after($trimmed, 'storage/'), '/');
		}

		return $trimmed;
	}

	public static function exists(?string $path): bool
	{
		$normalized = static::normalize($path);

		return $normalized !== null && static::disk()->exists($normalized);
	}

	public static function delete(?string $path): void
	{
		$normalized = static::normalize($path);

		if ($normalized && static::disk()->exists($normalized)) {
			static::disk()->delete($normalized);
		}
	}

	public static function url(?string $path): ?string
	{
		if (! $path) {
			return null;
		}

		if (Str::startsWith($path, ['http://', 'https://', '//'])) {
			return $path;
		}

		if (Str::startsWith($path, '/storage/')) {
			return $path;
		}

		$normalized = static::normalize($path);

		if ($normalized && static::disk()->exists($normalized)) {
			return static::disk()->url($normalized);
		}

		if ($normalized) {
			return asset('storage/'.ltrim($normalized, '/'));
		}

		return asset(ltrim($path, '/'));
	}
}

