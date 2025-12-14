<?php

declare(strict_types=1);

namespace App\Livewire\WomenRealEstate\Onboarding;

use App\Models\User;
use App\Models\WomenRealEstate\WomenUserMedia;
use Illuminate\Contracts\Filesystem\Cloud;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\View\View;
use Livewire\Component;
use Livewire\Features\SupportFileUploads\TemporaryUploadedFile;
use Livewire\WithFileUploads;

final class UserMediaLibrary extends Component
{
    use WithFileUploads;

    public const VISIBILITY_OPTIONS = [
        'private' => 'Private locker',
        'connections' => 'Trusted connections',
        'public' => 'Public spotlight',
    ];

    public array $media = [];

    public array $uploads = [];

    public string $visibility = 'private';

    protected array $rules = [
        'uploads.*' => 'file|max:51200|mimes:jpg,jpeg,png,webp,mp4,mov',
        'visibility' => 'in:private,connections,public',
    ];

    protected $listeners = [
        'refreshMediaLibrary' => 'refreshMedia',
    ];

    public function mount(): void
    {
        $this->refreshMedia();
    }

    public function updatedVisibility(): void
    {
        if (! array_key_exists($this->visibility, self::VISIBILITY_OPTIONS)) {
            $this->visibility = 'private';
        }

        $this->validateOnly('visibility');
    }

    public function updatedUploads(): void
    {
        $this->validateOnly('uploads.*');

        foreach ($this->uploads as $file) {
            if ($file instanceof TemporaryUploadedFile) {
                $this->storeUpload($file);
            }
        }

        $this->reset('uploads');
        $this->refreshMedia();
        session()->flash('mediaUploaded', 'Media uploaded successfully.');
    }

    public function deleteMedia(int $mediaId): void
    {
        $user = $this->resolveUser();

        if (! $user) {
            return;
        }

        $media = WomenUserMedia::query()
            ->where('user_id', $user->getKey())
            ->find($mediaId);

        if (! $media) {
            return;
        }

        Storage::disk($media->disk)->delete($media->path);
        $media->delete();

        $this->refreshMedia();
        session()->flash('mediaDeleted', 'Media removed.');
    }

    public function refreshMedia(): void
    {
        $user = $this->resolveUser();

        if (! $user) {
            $this->media = [];
            $this->broadcastMediaProgress(0);
            return;
        }

        $this->media = WomenUserMedia::query()
            ->where('user_id', $user->getKey())
            ->latest()
            ->limit(18)
            ->get()
            ->map(/**
             * @return (mixed|null|string)[]
             *
             * @psalm-return array{id: mixed, url: string, media_type: string, caption: null|string, visibility: string, created_at: null|string}
             */
            function (WomenUserMedia $media): array {
                return [
                    'id' => $media->getKey(),
                    'url' => $this->resolveMediaUrl($media),
                    'media_type' => $media->media_type,
                    'caption' => $media->caption,
                    'visibility' => $media->visibility,
                    'created_at' => optional($media->created_at)?->diffForHumans(),
                ];
            })
            ->all();

        $this->broadcastMediaProgress(count($this->media));
    }

    public function render(): View
    {
        return view('livewire.women-real-estate.onboarding.user-media-library', [
            'visibilityOptions' => self::VISIBILITY_OPTIONS,
        ]);
    }

    private function storeUpload(TemporaryUploadedFile $file): void
    {
        $user = $this->resolveUser();

        if (! $user) {
            return;
        }

        $disk = 'public';
        $directory = sprintf('women/real-estate/user-media/%d', $user->getKey());
        $filename = now()->format('Ymd_His').'-'.Str::random(8).'-'.Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME));
        $extension = $file->getClientOriginalExtension();
        $path = $file->storeAs($directory, $filename.'.'.$extension, $disk);

        WomenUserMedia::create([
            'user_id' => $user->getKey(),
            'disk' => $disk,
            'path' => $path,
            'media_type' => $this->mediaTypeFor($file),
            'visibility' => $this->visibility,
            'meta' => [
                'mime' => $file->getMimeType(),
                'size' => $file->getSize(),
                'original' => $file->getClientOriginalName(),
            ],
        ]);
    }

    private function mediaTypeFor(TemporaryUploadedFile $file): string
    {
        $mime = $file->getMimeType();

        return Str::startsWith($mime, 'video/') ? 'video' : 'image';
    }

    private function resolveMediaUrl(WomenUserMedia $media): string
    {
        $filesystem = Storage::disk($media->disk);

        return method_exists($filesystem, 'url')
            ? $filesystem->url($media->path)
            : Storage::url($media->path);
    }

    private function resolveUser(): ?User
    {
        $user = Auth::user();

        return $user instanceof User ? $user : null;
    }

    private function broadcastMediaProgress(int $count): void
    {
        $this->dispatch('realEstateMediaProgress', [
            'count' => $count,
            'complete' => $count > 0,
        ]);
    }
}

