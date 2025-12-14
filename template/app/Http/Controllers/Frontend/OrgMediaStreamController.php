<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\OrgMediaAsset;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class OrgMediaStreamController extends Controller
{
    public function stream(OrgMediaAsset $media, string $file = 'master.m3u8'): \Illuminate\Contracts\Routing\ResponseFactory|Response
    {
        abort_unless($media->type === 'video' && $media->status === 'ready', 404);
        abort_if(Str::lower($media->moderation_status) === 'flagged', 403);

        $base = Str::of($media->hls_playlist_path)->beforeLast('/')->trim('/')->value();

        if (! $base) {
            abort(404);
        }

        $path = trim($base.'/'.$file, '/');
        $disk = Storage::disk($media->disk);

        abort_unless($disk->exists($path), 404);

        $contents = $disk->get($path);

        if (Str::endsWith(Str::lower($file), '.m3u8')) {
            $contents = $this->rewritePlaylist($contents, $media);
        }

        return response($contents, 200, [
            'Content-Type' => $this->mimeFor($file),
            'Cache-Control' => 'public, max-age=60',
        ]);
    }

    private function rewritePlaylist(string $playlist, OrgMediaAsset $media): string
    {
        $lines = preg_split('/\r?\n/', $playlist);
        $rewritten = [];

        foreach ($lines as $line) {
            $trimmed = trim($line);

            if ($trimmed === '' || Str::startsWith($trimmed, '#') || Str::startsWith(Str::lower($trimmed), 'http')) {
                $rewritten[] = $line;
                continue;
            }

            $rewritten[] = route('organizations.media.stream', [
                'media' => $media->id,
                'file' => ltrim($trimmed, '/'),
            ]);
        }

        return implode("\n", $rewritten);
    }

    private function mimeFor(string $filename): string
    {
        $lower = Str::lower($filename);

        return match (true) {
            Str::endsWith($lower, '.m3u8') => 'application/vnd.apple.mpegurl',
            Str::endsWith($lower, '.ts') => 'video/mp2t',
            Str::endsWith($lower, '.m4s') => 'video/mp4',
            Str::endsWith($lower, '.mp4') => 'video/mp4',
            Str::endsWith($lower, '.vtt') => 'text/vtt; charset=utf-8',
            default => 'application/octet-stream',
        };
    }
}

