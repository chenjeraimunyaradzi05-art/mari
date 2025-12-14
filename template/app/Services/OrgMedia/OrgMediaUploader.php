<?php

namespace App\Services\OrgMedia;

use App\Jobs\ProcessOrgMediaAsset;
use App\Models\OrgMediaAsset;
use App\Models\OrganizationPage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class OrgMediaUploader
{
    public function upload(OrganizationPage $page, UploadedFile $file, string $type, ?int $uploaderId = null): OrgMediaAsset
    {
        $disk = config('org.media_disk', 'org_media');
        $maxSize = (int) config('org.max_upload_size', 524288);

        if ($file->getSize() / 1024 > $maxSize) {
            throw new \RuntimeException('Uploaded file exceeds configured limit.');
        }

        $directory = 'source/'.$page->id;
        $filename = Str::uuid()->toString().'.'.$file->getClientOriginalExtension();
        $path = $file->storeAs($directory, $filename, $disk);

        if ($uploaderId === null) {
            $uploaderId = Auth::id();
        }

        $media = OrgMediaAsset::create([
            'org_page_id' => $page->id,
            'uploaded_by' => $uploaderId,
            'type' => $type,
            'disk' => $disk,
            'original_filename' => $file->getClientOriginalName(),
            'storage_path' => $path,
            'status' => 'uploaded',
            'moderation_status' => 'pending',
        ]);

        ProcessOrgMediaAsset::dispatch($media->id);

        return $media;
    }

    public function delete(OrgMediaAsset $asset): void
    {
        $disk = Storage::disk($asset->disk);

        foreach ([$asset->storage_path, $asset->processed_path, $asset->thumbnail_path, $asset->captions_path, $asset->hls_playlist_path] as $path) {
            if ($path && $disk->exists($path)) {
                $disk->delete($path);
            }
        }

        if ($asset->hls_playlist_path) {
            $base = Str::of($asset->hls_playlist_path)->beforeLast('/')->value();

            if ($base && $disk->exists($base)) {
                $files = $disk->allFiles($base);

                if (! empty($files)) {
                    $disk->delete($files);
                }

                $disk->deleteDirectory($base);
            }
        }

        $asset->delete();
    }
}

