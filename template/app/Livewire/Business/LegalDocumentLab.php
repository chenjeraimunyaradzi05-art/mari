<?php

declare(strict_types=1);

namespace App\Livewire\Business;

use App\Models\LegalDocument;
use App\Models\User;
use App\Services\Business\LegalDocumentLabService;
use App\Support\Livewire\FallbackComponent;
use Illuminate\Contracts\Validation\Validator as ValidatorContract;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator as IlluminateValidator;

if (! class_exists(__NAMESPACE__.'\\LivewireComponent', false)) {
    if (class_exists('Livewire\\Component')) {
        class_alias('Livewire\\Component', __NAMESPACE__.'\\LivewireComponent');
    } else {
        class LivewireComponent extends FallbackComponent
        {
        }
    }
}

final class LegalDocumentLab extends LivewireComponent
{
    public ?User $user = null;

    public array $documents = [];

    public array $grantPacks = [];

    public string $selectedDocument = 'constitution';

    public string $currentStep = '';

    /** @var array<int, array<string, mixed>> */
    public array $wizardSteps = [];

    /** @var array<string, mixed> */
    public array $formData = [];

    public ?int $activeDocumentId = null;

    public ?string $previewHtml = null;

    public string $statusMessage = '';

    public ?string $selectedGrantPack = null;

    /** @var array<int, array<string, mixed>> */
    public array $savedDocuments = [];

    public string $disclaimer = '';

    public string $aiEntryUrl = '';

    /** @var array<int, array<string, mixed>> */
    public array $grantPackAssets = [];

    public array $grantPackSyncMeta = [];

    public bool $grantPackAutoUpdateEnabled = false;

    protected LegalDocumentLabService $lab;

    public function boot(LegalDocumentLabService $labService): void
    {
        $this->lab = $labService;
    }

    public function mount(): void
    {
        $this->user = Auth::user();
        $this->documents = $this->lab->documents();
        $this->grantPacks = $this->lab->grantPacks();
        $this->disclaimer = $this->lab->disclaimer();
        $this->aiEntryUrl = (string) config('ai.entry_url');
        $this->grantPackSyncMeta = $this->lab->grantPackSyncMeta();
        $this->grantPackAutoUpdateEnabled = $this->lab->grantPackAutoUpdateEnabled();

        $this->selectedDocument = array_key_first($this->documents) ?? 'constitution';
        $this->hydrateWizard($this->selectedDocument);
        $this->refreshSavedDocuments();
    }

    public function render()
    {
        return view('livewire.business.legal-document-lab');
    }

    public function selectDocument(string $documentType): void
    {
        if (! array_key_exists($documentType, $this->documents)) {
            return;
        }

        $this->selectedDocument = $documentType;
        $this->activeDocumentId = null;
        $this->selectedGrantPack = null;
        $this->statusMessage = '';
        $this->previewHtml = null;
        $this->formData = [];
        $this->hydrateWizard($documentType);
    }

    public function goToStep(string $stepKey): void
    {
        if (! collect($this->wizardSteps)->pluck('key')->contains($stepKey)) {
            return;
        }

        $this->currentStep = $stepKey;
    }

    public function selectGrantPack(?string $pack): void
    {
        $this->selectedGrantPack = $pack ?: null;
        $this->hydrateGrantPackAssets();
    }

    public function hydrateExisting(int $documentId): void
    {
        $document = LegalDocument::query()
            ->whereKey($documentId)
            ->where('user_id', $this->user?->id)
            ->first();

        if (! $document) {
            return;
        }

        $this->activeDocumentId = $document->id;
        $this->selectedDocument = $document->document_type;
        $this->selectedGrantPack = $document->grant_pack;
        $this->formData = (array) ($document->wizard_payload ?? []);
        $this->hydrateWizard($document->document_type);
        $this->hydrateGrantPackAssets();
        $this->statusMessage = 'Draft loaded.';
    }

    public function generatePreview(): void
    {
        $this->validatePayload();

        $this->previewHtml = $this->lab->generatePreview(
            $this->selectedDocument,
            $this->formData,
            $this->user,
            $this->selectedGrantPack
        );

        if ($this->user) {
            $this->lab->recordAiContext(
                $this->user,
                'preview_generated',
                $this->selectedDocument,
                $this->formData,
                $this->selectedGrantPack,
                $this->previewHtml ?? ''
            );
        }

        $this->statusMessage = 'Preview refreshed at '.now()->format('H:i');
    }

    public function saveDraft(): void
    {
        $this->validatePayload();

        $html = $this->lab->generatePreview(
            $this->selectedDocument,
            $this->formData,
            $this->user,
            $this->selectedGrantPack
        );

        $document = $this->lab->storeDraft(
            $this->requireUser(),
            $this->selectedDocument,
            $this->formData,
            $this->selectedGrantPack,
            $html,
            $this->activeDocumentId ? LegalDocument::find($this->activeDocumentId) : null
        );

        $this->activeDocumentId = $document->id;
        $this->previewHtml = $html;
        $this->statusMessage = 'Draft stored securely.';
        $this->refreshSavedDocuments();
    }

    public function refreshGrantPacks(): void
    {
        try {
            $manifest = $this->lab->refreshGrantPacks();
            $this->grantPacks = $manifest['packs'] ?? $this->grantPacks;
            $this->grantPackSyncMeta = [
                'synced_at' => $manifest['synced_at'] ?? null,
                'source' => $manifest['source'] ?? null,
            ];
            $this->statusMessage = 'Grant packs synced at '.now()->format('H:i');
        } catch (\Throwable $exception) {
            report($exception);
            $this->statusMessage = 'Grant pack sync failed. Using cached values.';
        }
    }

    public function refreshSavedDocuments(): void
    {
        if (! $this->user) {
            $this->savedDocuments = [];

            return;
        }

        $this->savedDocuments = $this->lab->savedDocuments($this->user)->toArray();
    }

    private function hydrateWizard(string $documentType): void
    {
        $this->wizardSteps = $this->lab->wizardStepsForDocument($documentType);
        $this->currentStep = $this->wizardSteps[0]['key'] ?? '';
    }

    private function hydrateGrantPackAssets(): void
    {
        $this->grantPackAssets = $this->selectedGrantPack
            ? $this->lab->grantPackAssets($this->selectedGrantPack)
            : [];
    }

    private function validatePayload(): void
    {
        $rules = [];
        $attributes = [];

        foreach ($this->wizardSteps as $step) {
            foreach ($step['fields'] ?? [] as $field) {
                $key = 'formData.'.$field['key'];
                $rules[$key] = $field['rules'] ?? 'nullable';
                $attributes[$key] = $field['label'] ?? Str::headline($field['key']);
            }
        }

        /** @var ValidatorContract|IlluminateValidator $validator */
        $validator = validator(['formData' => $this->formData], $rules, [], $attributes);
        $validator->validate();
    }

    private function requireUser(): User
    {
        if (! $this->user) {
            abort(403, 'Authentication required');
        }

        return $this->user;
    }
}

