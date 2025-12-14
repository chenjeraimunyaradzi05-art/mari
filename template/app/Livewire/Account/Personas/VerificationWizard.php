<?php

namespace App\Livewire\Account\Personas;

use App\Models\Profile;
use App\Models\ProfileVerificationDraft;
use App\Services\ProfileVerificationService;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Livewire\Component;
use Livewire\Features\SupportFileUploads\TemporaryUploadedFile;
use Livewire\WithFileUploads;
use Throwable;

final class VerificationWizard extends Component
{
    use WithFileUploads;

    private const REQUEST_TYPES = ['government_id', 'organization_email', 'document_upload'];

    public Profile $profile;

    public string $step = 'identity';

    public array $steps = ['identity', 'credentials', 'evidence', 'documents', 'review'];

    public array $stepLabels = [
        'identity' => 'About you',
        'credentials' => 'Credentials',
        'evidence' => 'Evidence & context',
        'documents' => 'Uploads',
        'review' => 'Review & submit',
    ];

    public array $form = [
        'identity' => [
            'full_name' => '',
            'preferred_name' => '',
            'contact_email' => '',
            'contact_phone' => '',
        ],
        'credentials' => [
            'request_type' => 'document_upload',
            'license_number' => '',
            'license_authority' => '',
            'license_expires_at' => '',
        ],
        'evidence' => [
            'notes' => '',
            'links' => ['', '', ''],
        ],
        'consent' => [
            'terms_confirmed' => false,
            'ai_updates' => true,
            'share_with_partners' => false,
        ],
    ];

    public array $uploads = [
        'government_id' => null,
        'proof_of_address' => null,
        'supporting' => [],
    ];

    public array $documentManifest = [
        'government_id' => null,
        'proof_of_address' => null,
        'supporting' => [],
    ];

    public bool $submissionComplete = false;

    public ?string $statusMessage = null;

    public ?ProfileVerificationDraft $draft = null;

    protected int $lastDraftSaveTimestamp = 0;

    public function mount(Profile $profile): void
    {
        $user = Auth::user();
        abort_unless($user && $profile->user_id === $user->id, 403);

        $this->profile = $profile->loadMissing('user');

        $this->form['identity']['full_name'] = (string) ($profile->display_name ?? $user->name ?? '');
        $this->form['identity']['preferred_name'] = (string) ($profile->personaMeta()['label'] ?? '');
        $this->form['identity']['contact_email'] = (string) ($user->email ?? '');
        $this->form['identity']['contact_phone'] = (string) ($user->phone ?? '');

        $this->restoreDraftState();
    }

    public function updated($propertyName): void
    {
        if (str_starts_with($propertyName, 'uploads')) {
            return;
        }

        $this->persistDraft();
    }

    public function goToStep(string $step): void
    {
        if (! in_array($step, $this->steps, true)) {
            return;
        }

        $target = array_search($step, $this->steps, true);
        $current = array_search($this->step, $this->steps, true);

        if ($target === false || $current === false) {
            return;
        }

        if ($target > $current) {
            $this->validateStep($this->step);
        }

        $this->step = $step;
        $this->persistDraft(true);
    }

    public function next(): void
    {
        $this->validateStep($this->step);

        $index = array_search($this->step, $this->steps, true);
        if ($index === false || $index >= count($this->steps) - 1) {
            return;
        }

        $this->step = $this->steps[$index + 1];
        $this->persistDraft(true);
    }

    public function previous(): void
    {
        $index = array_search($this->step, $this->steps, true);
        if ($index === false || $index === 0) {
            return;
        }

        $this->step = $this->steps[$index - 1];
        $this->persistDraft(true);
    }

    public function addEvidenceRow(): void
    {
        if (count($this->form['evidence']['links']) >= 5) {
            return;
        }

        $this->form['evidence']['links'][] = '';
    }

    public function removeEvidenceRow(int $index): void
    {
        if (! isset($this->form['evidence']['links'][$index])) {
            return;
        }

        unset($this->form['evidence']['links'][$index]);
        $this->form['evidence']['links'] = array_values($this->form['evidence']['links']);
    }

    public function updatedUploadsGovernmentId(?TemporaryUploadedFile $file): void
    {
        if (! $file) {
            return;
        }

        $this->ingestUpload('government_id', $file);
    }

    public function updatedUploadsProofOfAddress(?TemporaryUploadedFile $file): void
    {
        if (! $file) {
            return;
        }

        $this->ingestUpload('proof_of_address', $file);
    }

    public function updatedUploadsSupporting($files): void
    {
        if (! is_array($files)) {
            return;
        }

        foreach ($files as $file) {
            if ($file instanceof TemporaryUploadedFile) {
                $this->ingestUpload('supporting', $file);
            }
        }

        $this->uploads['supporting'] = [];
    }

    public function removeDocument(string $field, ?int $index = null): void
    {
        if (! array_key_exists($field, $this->documentManifest)) {
            return;
        }

        if ($field === 'supporting') {
            if ($index === null || ! isset($this->documentManifest[$field][$index])) {
                return;
            }

            $this->deleteStoredDocument($this->documentManifest[$field][$index]);
            unset($this->documentManifest[$field][$index]);
            $this->documentManifest[$field] = array_values($this->documentManifest[$field]);
        } else {
            if (! $this->documentManifest[$field]) {
                return;
            }

            $this->deleteStoredDocument($this->documentManifest[$field]);
            $this->documentManifest[$field] = null;
        }

        $this->persistDraft(true);
    }

    public function saveDraft(): void
    {
        $this->persistDraft(true);
        session()->flash('status', 'Draft saved. We will keep it for two weeks.');
    }

    public function submit(ProfileVerificationService $service): void
    {
        foreach ($this->steps as $step) {
            $this->validateStep($step);
        }

        $documents = $this->preparedDocuments();

        if ($documents === []) {
            throw ValidationException::withMessages([
                'documents' => 'Upload at least one document before submitting.',
            ]);
        }

        $payload = $this->buildPayload();

        try {
            $service->submit($this->profile->fresh(), Auth::user(), $payload, $documents);
        } catch (Throwable $exception) {
            Log::error('Failed to submit persona verification wizard', [
                'profile_id' => $this->profile->getKey(),
                'user_id' => Auth::id(),
                'error' => $exception->getMessage(),
            ]);

            throw ValidationException::withMessages([
                'form.review.submit' => 'We could not submit your verification right now. Please try again shortly.',
            ]);
        }

        $this->submissionComplete = true;
        $this->statusMessage = 'Thanks! Your verification is now in the reviewer queue.';
        $this->clearDraft();
        $this->step = 'review';
    }

    public function render(): View
    {
        return view('livewire.account.personas.verification-wizard', [
            'evidenceLinks' => $this->sanitizedEvidenceLinks(),
            'documentSummary' => $this->documentSummary(),
        ]);
    }

    private function restoreDraftState(): void
    {
        $draft = ProfileVerificationDraft::query()
            ->where('profile_id', $this->profile->getKey())
            ->where('user_id', Auth::id())
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->first();

        if (! $draft) {
            return;
        }

        $this->draft = $draft;
        $this->form = array_replace_recursive($this->form, $draft->payload ?? []);
        $this->documentManifest = array_replace_recursive($this->documentManifest, $draft->document_manifest ?? []);
        $this->documentManifest['supporting'] = array_values($this->documentManifest['supporting'] ?? []);

        if ($draft->current_step && in_array($draft->current_step, $this->steps, true)) {
            $this->step = $draft->current_step;
        }
    }

    private function validateStep(string $step): void
    {
        $rules = match ($step) {
            'identity' => [
                'form.identity.full_name' => ['required', 'string', 'max:160'],
                'form.identity.preferred_name' => ['nullable', 'string', 'max:160'],
                'form.identity.contact_email' => ['required', 'email', 'max:190'],
                'form.identity.contact_phone' => ['nullable', 'string', 'max:60'],
            ],
            'credentials' => [
                'form.credentials.request_type' => ['required', Rule::in(self::REQUEST_TYPES)],
                'form.credentials.license_number' => ['nullable', 'string', 'max:120'],
                'form.credentials.license_authority' => ['nullable', 'string', 'max:160'],
                'form.credentials.license_expires_at' => ['nullable', 'date', 'after:today'],
            ],
            'evidence' => [
                'form.evidence.notes' => ['nullable', 'string', 'max:500'],
                'form.evidence.links' => ['nullable', 'array', 'max:5'],
                'form.evidence.links.*' => ['nullable', 'url', 'max:2048'],
            ],
            default => [],
        };

        if ($rules !== []) {
            $this->validate($rules);
        }

        if ($step === 'documents') {
            $this->validateDocuments();
        }

        if ($step === 'review' && ! ($this->form['consent']['terms_confirmed'] ?? false)) {
            throw ValidationException::withMessages([
                'form.consent.terms_confirmed' => 'Please confirm the declaration before submitting.',
            ]);
        }
    }

    private function validateDocuments(): void
    {
        if (! $this->documentManifest['government_id']) {
            throw ValidationException::withMessages([
                'documents.government_id' => 'Upload a government issued ID.',
            ]);
        }

        if (! $this->documentManifest['proof_of_address']) {
            throw ValidationException::withMessages([
                'documents.proof_of_address' => 'Upload a supporting credential or address proof.',
            ]);
        }
    }

    private function ingestUpload(string $field, TemporaryUploadedFile $file): void
    {
        $document = $this->storeTemporaryUpload($file, $field);

        if ($field === 'supporting') {
            $this->documentManifest[$field][] = $document;
        } else {
            if ($this->documentManifest[$field]) {
                $this->deleteStoredDocument($this->documentManifest[$field]);
            }

            $this->documentManifest[$field] = $document;
        }

        $this->uploads[$field] = null;
        $this->persistDraft(true);
    }

    /**
     * @return (false|int|string|string[])[]
     *
     * @psalm-return array{disk: string, path: false|string, mime_type: string, size_bytes: int, checksum: false|string, metadata: array{original_name: string, field: string}}
     */
    private function storeTemporaryUpload(TemporaryUploadedFile $file, string $field): array
    {
        $disk = $this->uploadDisk();
        $directory = sprintf('profile-verifications/drafts/%d', $this->profile->getKey());
        $filename = Str::uuid()->toString().'_'.$field.'.'.$file->getClientOriginalExtension();
        $path = $file->storeAs($directory, $filename, $disk);

        return [
            'disk' => $disk,
            'path' => $path,
            'mime_type' => $file->getMimeType(),
            'size_bytes' => $file->getSize(),
            'checksum' => hash_file('sha256', $file->getRealPath()),
            'metadata' => [
                'original_name' => $file->getClientOriginalName(),
                'field' => $field,
            ],
        ];
    }

    private function uploadDisk(): string
    {
        return config('filesystems.disks.private') ? 'private' : config('filesystems.default', 'local');
    }

    private function deleteStoredDocument($document): void
    {
        if (! is_array($document) || empty($document['path'])) {
            return;
        }

        try {
            Storage::disk($document['disk'] ?? $this->uploadDisk())->delete($document['path']);
        } catch (Throwable) {
            // Best effort cleanup only.
        }
    }

    private function persistDraft(bool $force = false): void
    {
        if (! Auth::check()) {
            return;
        }

        if (! $force && ! $this->shouldPersistDraft()) {
            return;
        }

        $payload = $this->form;
        $payload['evidence']['links'] = $this->sanitizedEvidenceLinks();

        $this->draft = ProfileVerificationDraft::updateOrCreate(
            [
                'profile_id' => $this->profile->getKey(),
                'user_id' => Auth::id(),
            ],
            [
                'payload' => $payload,
                'document_manifest' => $this->documentManifest,
                'current_step' => $this->step,
                'expires_at' => now()->addDays((int) config('profile_verification.drafts.ttl_days', 14)),
            ]
        );

        $this->lastDraftSaveTimestamp = now()->getTimestamp();
    }

    private function shouldPersistDraft(): bool
    {
        $now = now()->getTimestamp();

        if ($this->lastDraftSaveTimestamp !== 0 && ($now - $this->lastDraftSaveTimestamp) < 5) {
            return false;
        }

        return true;
    }

    private function clearDraft(): void
    {
        if ($this->draft) {
            $this->draft->delete();
        }

        $this->draft = null;
        $this->documentManifest = [
            'government_id' => null,
            'proof_of_address' => null,
            'supporting' => [],
        ];
    }

    /**
     * @return array[]
     *
     * @psalm-return list{0?: array{path: mixed,...},...}
     */
    private function preparedDocuments(): array
    {
        $documents = [];

        foreach ($this->documentManifest as $field => $entry) {
            if ($field === 'supporting') {
                foreach ($entry as $doc) {
                    if (is_array($doc) && isset($doc['path'])) {
                        $documents[] = $doc;
                    }
                }

                continue;
            }

            if (is_array($entry) && isset($entry['path'])) {
                $documents[] = $entry;
            }
        }

        return $documents;
    }

    /**
     * @return (array|mixed|null|string)[]
     *
     * @psalm-return array{request_type: mixed, notes: null|string, evidence_urls: array, license_expires_at: mixed|null, identity: array{full_name: string, preferred_name: string, contact_email: string, contact_phone: string}, credentials: array{license_number: null|string, license_authority: null|string}, consent: array{terms_confirmed: bool, ai_updates: bool, share_with_partners: bool}}
     */
    private function buildPayload(): array
    {
        $identity = $this->form['identity'];
        $credentials = $this->form['credentials'];

        return [
            'request_type' => $credentials['request_type'],
            'notes' => trim((string) ($this->form['evidence']['notes'] ?? '')) ?: null,
            'evidence_urls' => $this->sanitizedEvidenceLinks(),
            'license_expires_at' => $credentials['license_expires_at'] ?: null,
            'identity' => [
                'full_name' => trim((string) ($identity['full_name'] ?? '')),
                'preferred_name' => trim((string) ($identity['preferred_name'] ?? '')),
                'contact_email' => trim((string) ($identity['contact_email'] ?? '')),
                'contact_phone' => trim((string) ($identity['contact_phone'] ?? '')),
            ],
            'credentials' => [
                'license_number' => trim((string) ($credentials['license_number'] ?? '')) ?: null,
                'license_authority' => trim((string) ($credentials['license_authority'] ?? '')) ?: null,
            ],
            'consent' => [
                'terms_confirmed' => (bool) ($this->form['consent']['terms_confirmed'] ?? false),
                'ai_updates' => (bool) ($this->form['consent']['ai_updates'] ?? false),
                'share_with_partners' => (bool) ($this->form['consent']['share_with_partners'] ?? false),
            ],
        ];
    }

    /**
     * @return string[]
     *
     * @psalm-return array<int, string>
     */
    private function sanitizedEvidenceLinks(): array
    {
        return collect($this->form['evidence']['links'] ?? [])
            ->map(fn ($link) => trim((string) $link))
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @psalm-return array{government_id: mixed, proof_of_address: mixed, supporting: mixed}
     */
    private function documentSummary(): array
    {
        return [
            'government_id' => $this->documentManifest['government_id'],
            'proof_of_address' => $this->documentManifest['proof_of_address'],
            'supporting' => $this->documentManifest['supporting'],
        ];
    }
}

