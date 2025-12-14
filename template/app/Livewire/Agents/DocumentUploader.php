<?php

namespace App\Livewire\Agents;

use App\Support\Livewire\FallbackComponent;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Livewire\Attributes\Modelable;
use Livewire\Features\SupportFileUploads\TemporaryUploadedFile;
use Livewire\WithFileUploads;
use Throwable;

trait DocumentUploaderBehavior
{
    use WithFileUploads;

    public string $field;

    public string $label;

    public ?string $description = null;

    public array $accepted = [];

    #[Modelable]
    public ?array $document = null;

    public ?TemporaryUploadedFile $file = null;

    public bool $uploading = false;

    public ?string $errorMessage = null;

    public function mount(string $field, string $label, ?string $description = null, array $accepted = [], ?array $existing = null): void
    {
        $this->field = $field;
        $this->label = $label;
        $this->description = $description;
        $this->accepted = $accepted;
        $this->document = $existing;
    }

    public function updatedFile(): void
    {
        $this->resetErrorBag('file');
        $this->errorMessage = null;

        $this->validate([
            'file' => ['required', 'file', 'max:10240', 'mimes:pdf,jpg,jpeg,png'],
        ]);

        if ($this->existingPath()) {
            Storage::disk('local')->delete($this->existingPath());
        }

        $this->uploading = true;

        try {
            $storedPath = $this->storeFile($this->file);
        } catch (Throwable $exception) {
            Log::warning('Failed to store verification document upload', [
                'field' => $this->field,
                'exception' => $exception->getMessage(),
            ]);

            $this->errorMessage = 'We could not upload this document right now. Please try again.';
            $this->uploading = false;

            return;
        }

        $document = [
            'path' => $storedPath,
            'disk' => 'local',
            'original_name' => $this->file?->getClientOriginalName(),
            'mime_type' => $this->file?->getClientMimeType(),
            'size' => $this->file?->getSize(),
            'uploaded_at' => now()->toIso8601String(),
        ];

        $this->document = $document;

        $this->reset('file');
        $this->uploading = false;
    }

    public function removeExisting(): void
    {
        if ($this->existingPath()) {
            Storage::disk('local')->delete($this->existingPath());
        }

        $this->document = null;
        $this->reset('file');
    }

    public function render()
    {
        return view('livewire.agents.document-uploader');
    }

    private function storeFile(?TemporaryUploadedFile $file): string
    {
        if (! $file) {
            throw new \RuntimeException('No file provided for upload.');
        }

        $userId = Auth::id() ?? 'guest';
        $directory = sprintf('women-agent-verifications/temp/%s', $userId);
        $filename = Str::uuid()->toString().'_'.str_replace([' ', '#'], '-', $file->getClientOriginalName());

        return $file->storeAs($directory, $filename, 'local');
    }

    private function existingPath(): ?string
    {
        return Arr::get($this->document, 'path');
    }
}

if (! class_exists(__NAMESPACE__.'\\LivewireComponent', false)) {
    if (class_exists('Livewire\\Component')) {
        class_alias('Livewire\\Component', __NAMESPACE__.'\\LivewireComponent');
    } else {
        class LivewireComponent extends FallbackComponent
        {
        }
    }
}

final class DocumentUploader extends LivewireComponent
{
    use DocumentUploaderBehavior;
}

