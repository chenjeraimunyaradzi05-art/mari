<?php

namespace App\Jobs;

use App\Models\OrgMediaAsset;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use App\Services\OrgMedia\ContentModerator;
use App\Services\OrgMedia\HlsTranscoder;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class ProcessOrgMediaAsset implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $mediaId)
    {
        $this->onQueue(config('org.media_queue', 'default'));
    }

    private function makeDirectoryIfMissing(\Illuminate\Contracts\Filesystem\Filesystem $disk, string $path): void
    {
        $directory = (string) Str::of($path)->beforeLast('/');

        if ($directory !== '' && ! $disk->exists($directory)) {
            $disk->makeDirectory($directory);
        }
    }

    private function defaultProcessedPath(string $sourcePath): string
    {
        $sourcePath = Str::of($sourcePath)->ltrim('/');

        return 'stream/'.$sourcePath;
    }

    private function roundDuration($value): ?int
    {
        if ($value === null) {
            return null;
        }

        if (! is_numeric($value)) {
            return null;
        }

        return (int) round((float) $value);
    }
}

