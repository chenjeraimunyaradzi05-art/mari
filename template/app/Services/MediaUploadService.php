<?php

namespace App\Services;

use App\Support\SocialMediaStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Intervention\Image\Facades\Image;

class MediaUploadService
{
	private const FALLBACK_PLACEHOLDER = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
	private static bool $imageDriverChecked = false;
	private static bool $imageDriverAvailable = false;
	private string $visibility;

	public function __construct(?string $visibility = null)
	{
		$this->visibility = $visibility ?? (string) config('social.media.visibility', 'public');
	}

	public function uploadAvatar(UploadedFile $file): string
	{
		$filename = $this->generateFilename($file);
		$path = $this->buildPath('avatars', $filename);

		if ($this->canProcessImages()) {
			try {
				$image = Image::make($file)
					->fit(
						config('social.media.image.avatar.width', 400),
						config('social.media.image.avatar.height', 400)
					)
					->encode($file->getClientOriginalExtension(), config('social.media.quality.avatar', 85));

				SocialMediaStorage::disk()->put($path, (string) $image, ['visibility' => $this->visibility]);
				return $path;
			} catch (\Throwable $exception) {
				Log::warning('Avatar processing failed, storing original file.', [
					'path' => $path,
					'error' => $exception->getMessage(),
				]);
			}
		}

		$this->storeRawFile($file, $path);

		return $path;
	}

	public function uploadCover(UploadedFile $file): string
	{
		$filename = $this->generateFilename($file);
		$path = $this->buildPath('covers', $filename);

		if ($this->canProcessImages()) {
			try {
				$image = Image::make($file)
					->fit(
						config('social.media.image.cover.width', 1500),
						config('social.media.image.cover.height', 500)
					)
					->encode($file->getClientOriginalExtension(), config('social.media.quality.cover', 85));

				SocialMediaStorage::disk()->put($path, (string) $image, ['visibility' => $this->visibility]);
				return $path;
			} catch (\Throwable $exception) {
				Log::warning('Cover processing failed, storing original file.', [
					'path' => $path,
					'error' => $exception->getMessage(),
				]);
			}
		}

		$this->storeRawFile($file, $path);

		return $path;
	}

	/**
	 * @return (false|int|mixed|null|string)[]
	 *
	 * @psalm-return array{media_type: 'image'|'video', file_path: string, mime_type: null|string, file_size: false|int, width?: int|mixed, height?: int|mixed, thumbnail_path?: string}
	 */
	public function uploadPostMedia(UploadedFile $file): array
	{
		$isVideo = Str::startsWith($file->getMimeType(), 'video/');
		$filename = $this->generateFilename($file);
		$bucket = $isVideo ? 'videos' : 'images';
		$path = $this->buildPath($bucket, $filename);

		if ($isVideo) {
			$thumbnailPath = $this->generateVideoThumbnail($path);

			SocialMediaStorage::disk()->putFileAs(
				$this->resolveDirectory($bucket),
				$file,
				$filename,
				['visibility' => $this->visibility]
			);

			return [
				'media_type' => 'video',
				'file_path' => $path,
				'thumbnail_path' => $thumbnailPath,
				'mime_type' => $file->getMimeType(),
				'file_size' => $file->getSize(),
			];
		}

		if ($this->canProcessImages()) {
			try {
				$image = Image::make($file);
				$width = $image->width();
				$height = $image->height();
				$maxDimension = config('social.media.image.max_dimension', 1080);

				if ($width > $maxDimension || $height > $maxDimension) {
					$image->resize($maxDimension, $maxDimension, function ($constraint): void {
						$constraint->aspectRatio();
						$constraint->upsize();
					});

					$width = $image->width();
					$height = $image->height();
				}

				$encoded = (string) $image->encode(
					$file->getClientOriginalExtension(),
					config('social.media.quality.post', 85)
				);

				SocialMediaStorage::disk()->put($path, $encoded, ['visibility' => $this->visibility]);

				return [
					'media_type' => 'image',
					'file_path' => $path,
					'mime_type' => $file->getMimeType(),
					'file_size' => $file->getSize(),
					'width' => $width,
					'height' => $height,
				];
			} catch (\Throwable $exception) {
				Log::warning('Post image processing failed, storing original file.', [
					'path' => $path,
					'error' => $exception->getMessage(),
				]);
			}
		}

		$this->storeRawFile($file, $path);
		[$width, $height] = $this->measureImage($file);

		return [
			'media_type' => 'image',
			'file_path' => $path,
			'mime_type' => $file->getMimeType(),
			'file_size' => $file->getSize(),
			'width' => $width,
			'height' => $height,
		];
	}

	/**
	 * @return (false|int|null|string)[]
	 *
	 * @psalm-return array{file_path: string, thumbnail_path: string, mime_type: null|string, file_size: false|int}
	 */
	public function uploadProfileVideo(UploadedFile $file): array
	{
		$filename = $this->generateFilename($file);
		$path = $this->buildPath('profile_videos', $filename);
		$directory = $this->resolveDirectory('profile_videos');

		SocialMediaStorage::disk()->putFileAs(
			$directory,
			$file,
			$filename,
			['visibility' => $this->visibility]
		);

		$thumbnailPath = $this->generateVideoThumbnail($path, 'profile_video_thumbnails');

		return [
			'file_path' => $path,
			'thumbnail_path' => $thumbnailPath,
			'mime_type' => $file->getMimeType(),
			'file_size' => $file->getSize(),
		];
	}

	private function generateVideoThumbnail(string $videoPath, string $bucket = 'thumbnails'): string
	{
		$filename = pathinfo($videoPath, PATHINFO_FILENAME) ?: Str::uuid()->toString();
		$thumbnailPath = $this->buildPath($bucket, $filename.'-preview.jpg');

		try {
			$placeholder = Image::canvas(640, 360, '#150424');
			$placeholder->circle(220, 320, 180, function ($draw): void {
				$draw->background('rgba(255,255,255,0.08)');
				$draw->border(4, 'rgba(255,255,255,0.18)');
			});

			$this->decorateVideoPlaceholder($placeholder);

			SocialMediaStorage::disk()->put(
				$thumbnailPath,
				(string) $placeholder->encode('jpg', 85),
				['visibility' => $this->visibility]
			);
		} catch (\Throwable $exception) {
			Log::warning('Video placeholder rendering failed, falling back to pixel stub.', [
				'path' => $videoPath,
				'error' => $exception->getMessage(),
			]);

			SocialMediaStorage::disk()->put(
				$thumbnailPath,
				base64_decode(self::FALLBACK_PLACEHOLDER) ?: '',
				['visibility' => $this->visibility]
			);
		}

		return $thumbnailPath;
	}

	private function decorateVideoPlaceholder(\Intervention\Image\Image $placeholder): void
	{
		try {
			$placeholder->text('▶', 320, 160, function ($font): void {
				$font->size(140);
				$font->color('#f8bbd0');
				$font->align('center');
				$font->valign('middle');
			});

			$placeholder->text('Processing video…', 320, 300, function ($font): void {
				$font->size(28);
				$font->color('#ffe6fb');
				$font->align('center');
			});
		} catch (\Throwable $exception) {
			Log::debug('Skipped text overlay on placeholder (missing font support).', [
				'error' => $exception->getMessage(),
			]);
		}
	}

	private function generateFilename(UploadedFile $file): string
	{
		return Str::uuid().'.'.$file->getClientOriginalExtension();
	}

	private function buildPath(string $bucket, string $filename): string
	{
		$directory = $this->resolveDirectory($bucket);

		return trim(($directory ? $directory.'/' : '').$filename, '/');
	}

	private function resolveDirectory(string $bucket): string
	{
		$paths = config('social.media.paths', []);
		$root = trim(config('social.media.root', 'social'), '/');
		$folder = trim($paths[$bucket] ?? $bucket, '/');
		$segments = array_filter([$root, $folder], fn ($segment) => $segment !== '');

		return implode('/', $segments);
	}

	private function canProcessImages(): bool
	{
		if (! self::$imageDriverChecked) {
			self::$imageDriverChecked = true;
			self::$imageDriverAvailable = extension_loaded('gd') || extension_loaded('imagick');
		}

		return self::$imageDriverAvailable;
	}

	private function storeRawFile(UploadedFile $file, string $path): void
	{
		$content = @file_get_contents($file->getRealPath());
		SocialMediaStorage::disk()->put($path, $content === false ? '' : $content, ['visibility' => $this->visibility]);
	}

	/**
	 * @return (int|null)[]
	 *
	 * @psalm-return list{int|null, int|null}
	 */
	private function measureImage(UploadedFile $file): array
	{
		$dimensions = @getimagesize($file->getRealPath());

		if (! $dimensions) {
			return [null, null];
		}

		return [$dimensions[0] ?? null, $dimensions[1] ?? null];
	}
}

