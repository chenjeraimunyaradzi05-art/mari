<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Jobs\WomenRealEstate\ProcessWomenListingMedia;
use App\Jobs\WomenRealEstate\ProcessWomenListingPhoto;
use App\Models\WomenHousingListing;
use App\Models\WomenListingPhoto;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenListingMedia;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use App\Services\WomenRealEstate\Contracts\WomenListingAnalyticsServiceContract;

final class WomenListingMediaPipeline
{
    private WomenListingAnalyticsServiceContract $analytics;

    public function __construct(WomenListingAnalyticsServiceContract $analytics)
    {
        $this->analytics = $analytics;
    }

    /**
     * @return WomenListingMedia|WomenListingPhoto
     */
    public function upload(WomenListing|WomenHousingListing $listing, UploadedFile $file, array $attributes = []): Model
    {
        if ($listing instanceof WomenHousingListing) {
            return $this->uploadHousingListing($listing, $file, $attributes);
        }

        return $this->uploadWomenListing($listing, $file, $attributes);
    }

    /**
     * @return WomenListingMedia|WomenListingPhoto
     */
    public function updateMeta(WomenListingMedia|WomenListingPhoto $media, array $attributes): Model
    {
        if ($media instanceof WomenListingPhoto) {
            return $this->updateHousingPhoto($media, $attributes);
        }

        return $this->updateListingMedia($media, $attributes);
    }

    public function reorder(WomenListing|WomenHousingListing $listing, array $orderedIds): void
    {
        if ($listing instanceof WomenHousingListing) {
            $this->reorderHousingListing($listing, $orderedIds);

            return;
        }

        $this->reorderWomenListing($listing, $orderedIds);
    }

    public function remove(WomenListingMedia|WomenListingPhoto $media): void
    {
        if ($media instanceof WomenListingPhoto) {
            $this->removeHousingPhoto($media);

            return;
        }

        $this->removeListingMedia($media);
    }

    private function uploadWomenListing(WomenListing $listing, UploadedFile $file, array $attributes = []): WomenListingMedia
    {
        $this->assertMediaCap($listing);

        $disk = $this->disk();
        $directory = $this->directory($listing);

        $filename = $this->generateFilename($file);
        $storedPath = $file->storeAs($directory, $filename, ['disk' => $disk]);

        $position = $attributes['position'] ?? ($listing->media()->max('position') ?? 0) + 1;

        /** @var WomenListingMedia $media */
        $media = $listing->media()->create([
            'type' => $attributes['type'] ?? $this->inferType($file),
            'path' => $storedPath,
            'caption' => $attributes['caption'] ?? null,
            'position' => $position,
            'meta' => Arr::get($attributes, 'meta', []),
        ]);

        $this->queueProcessing($media);
        $this->analytics->invalidateMetricsCache();

        return $media;
    }

    private function uploadHousingListing(WomenHousingListing $listing, UploadedFile $file, array $attributes = []): WomenListingPhoto
    {
        $this->assertHousingMediaCap($listing);

        $disk = $this->disk();
        $directory = $this->housingDirectory($listing);

        $filename = $this->generateFilename($file);
        $storedPath = $file->storeAs($directory, $filename, ['disk' => $disk]);

        $position = $attributes['position'] ?? ($listing->photos()->max('position') ?? 0) + 1;

        /** @var WomenListingPhoto $photo */
        $photo = $listing->photos()->create([
            'storage_path' => $storedPath,
            'cdn_url' => $attributes['cdn_url'] ?? null,
            'caption' => $attributes['caption'] ?? null,
            'position' => $position,
            'is_primary' => (bool) ($attributes['is_primary'] ?? false),
            'meta' => Arr::get($attributes, 'meta', [
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getClientMimeType(),
                'size_bytes' => $file->getSize(),
            ]),
        ]);

        if (! $photo->is_primary) {
            $this->ensureHousingListingPrimaryPhoto($listing);
        } else {
            $listing->photos()
                ->where('id', '!=', $photo->id)
                ->update(['is_primary' => false]);
        }

        $this->queueProcessing($photo);

        return $photo;
    }

    private function updateListingMedia(WomenListingMedia $media, array $attributes): WomenListingMedia
    {
        $media->fill(Arr::only($attributes, ['caption', 'meta']));

        if (array_key_exists('position', $attributes)) {
            $media->position = (int) $attributes['position'];
        }

        $media->save();

        return $media->refresh();
    }

    private function updateHousingPhoto(WomenListingPhoto $photo, array $attributes): WomenListingPhoto
    {
        $photo->fill(Arr::only($attributes, ['caption', 'meta']));

        if (array_key_exists('position', $attributes)) {
            $photo->position = (int) $attributes['position'];
        }

        if (array_key_exists('is_primary', $attributes)) {
            $photo->is_primary = (bool) $attributes['is_primary'];
        }

        $photo->save();

        if ($photo->is_primary && $photo->listing !== null) {
            $photo->listing->photos()
                ->where('id', '!=', $photo->id)
                ->update(['is_primary' => false]);
        } elseif ($photo->listing !== null) {
            $this->ensureHousingListingPrimaryPhoto($photo->listing);
        }

        return $photo->refresh();
    }

    private function reorderWomenListing(WomenListing $listing, array $orderedIds): void
    {
        $mapping = array_values(array_filter($orderedIds, static fn ($id) => is_numeric($id)));

        if ($mapping === []) {
            return;
        }

        $position = 1;

        foreach ($mapping as $mediaId) {
            $listing->media()->whereKey((int) $mediaId)->update(['position' => $position]);
            $position++;
        }

        $listing->unsetRelation('media');
    }

    private function reorderHousingListing(WomenHousingListing $listing, array $orderedIds): void
    {
        $mapping = array_values(array_filter($orderedIds, static fn ($id) => is_numeric($id)));

        if ($mapping === []) {
            return;
        }

        $position = 1;

        foreach ($mapping as $photoId) {
            $listing->photos()->whereKey((int) $photoId)->update(['position' => $position]);
            $position++;
        }

        $listing->unsetRelation('photos');
    }

    private function removeListingMedia(WomenListingMedia $media): void
    {
        $disk = $this->disk();

        if (Storage::disk($disk)->exists($media->path)) {
            Storage::disk($disk)->delete($media->path);
        }

        $listing = $media->listing;
        $media->delete();

        if ($listing !== null) {
            $this->resequenceListingPositions($listing);
            $this->analytics->invalidateMetricsCache();
        }
    }

    private function removeHousingPhoto(WomenListingPhoto $photo): void
    {
        $disk = $this->disk();

        if ($photo->storage_path && Storage::disk($disk)->exists($photo->storage_path)) {
            Storage::disk($disk)->delete($photo->storage_path);
        }

        $listing = $photo->listing;
        $photo->delete();

        if ($listing !== null) {
            $this->resequenceHousingPositions($listing);
            $this->ensureHousingListingPrimaryPhoto($listing);
        }
    }

    private function resequenceListingPositions(WomenListing $listing): void
    {
        $position = 1;
        $listing->media()->orderBy('position')->get()->each(function (WomenListingMedia $media) use (&$position): void {
            if ($media->position !== $position) {
                $media->update(['position' => $position]);
            }

            $position++;
        });
    }

    private function resequenceHousingPositions(WomenHousingListing $listing): void
    {
        $position = 1;

        $listing->photos()->orderBy('position')->get()->each(function (WomenListingPhoto $photo) use (&$position): void {
            if ($photo->position !== $position) {
                $photo->update(['position' => $position]);
            }

            $position++;
        });
    }

    private function ensureHousingListingPrimaryPhoto(WomenHousingListing $listing): void
    {
        $hasPrimary = $listing->photos()->where('is_primary', true)->exists();

        if ($hasPrimary) {
            return;
        }

        $firstPhoto = $listing->photos()->orderBy('position')->first();

        if ($firstPhoto) {
            $firstPhoto->update(['is_primary' => true]);
        }
    }

    private function queueProcessing(WomenListingMedia|WomenListingPhoto $media): void
    {
        if ($media instanceof WomenListingPhoto) {
            ProcessWomenListingPhoto::dispatch($media->id)->onQueue($this->mediaQueue());

            return;
        }

        ProcessWomenListingMedia::dispatch($media->id)->onQueue($this->mediaQueue());
    }

    private function inferType(UploadedFile $file): string
    {
        $extension = strtolower((string) $file->extension());

        return match (true) {
            in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true) => 'image',
            in_array($extension, ['mp4', 'mov', 'avi', 'mkv'], true) => 'video',
            default => 'document',
        };
    }

    private function generateFilename(UploadedFile $file): string
    {
        $timestamp = now()->format('YmdHis');
        $slug = Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME));
        $extension = $file->getClientOriginalExtension();

        return sprintf('%s_%s.%s', $timestamp, $slug ?: Str::random(8), $extension);
    }

    private function assertMediaCap(WomenListing $listing): void
    {
        $cap = (int) config('women_real_estate.media.max_files_per_listing', 12);
        $current = $listing->media()->count();

        if ($current >= $cap) {
            throw new \RuntimeException('Media limit reached for this listing.');
        }
    }

    private function assertHousingMediaCap(WomenHousingListing $listing): void
    {
        $cap = (int) config('women_real_estate.media.max_files_per_listing', 12);
        $current = $listing->photos()->count();

        if ($current >= $cap) {
            throw new \RuntimeException('Media limit reached for this listing.');
        }
    }

    private function disk(): string
    {
        return (string) config('women_real_estate.media.disk', 'public');
    }

    private function directory(WomenListing $listing): string
    {
        $base = trim((string) config('women_real_estate.media.directory', 'women/listings'), '/');

        return $base . '/' . $listing->uuid;
    }

    private function housingDirectory(WomenHousingListing $listing): string
    {
        $base = 'women-listings';

        return trim($base, '/') . '/' . $listing->uuid;
    }

    private function mediaQueue(): string
    {
        return (string) config('women_real_estate.media.queue', 'media');
    }
}

