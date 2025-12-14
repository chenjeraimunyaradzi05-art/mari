<?php

namespace App\Livewire\Agents;

use App\Enums\WomenRealEstate\VerificationStage;
use App\Models\User;
use App\Models\WomenRealEstate\WomenVerifiedAgent;
use App\Support\Livewire\FallbackComponent;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

trait VerificationWizardBehavior
{
    protected array $allowedDocumentMimeTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
    ];

    protected array $blockedDocumentExtensions = [
        'php',
        'js',
        'exe',
        'sh',
        'bat',
        'cmd',
    ];

    public string $step = 'profile';

    public array $steps = [
        'profile',
        'license',
        'documents',
        'references',
        'review',
    ];

    public array $stepLabels = [
        'profile' => 'About You',
        'license' => 'License & Coverage',
        'documents' => 'Supporting Documents',
        'references' => 'Client References',
        'review' => 'Review & Submit',
    ];

    public array $form = [
        'profile' => [
            'legal_name' => '',
            'preferred_name' => '',
            'phone' => '',
            'email' => '',
            'agency_name' => '',
            'website' => '',
            'experience_years' => null,
            'professional_profile_url' => '',
        ],
        'license' => [
            'license_number' => '',
            'license_type' => '',
            'regulator' => '',
            'license_expires_at' => '',
            'regions_served' => '',
            'specialisations' => '',
        ],
        'references' => [],
        'consent' => [
            'terms_accepted' => false,
            'share_with_partners' => false,
            'ai_followups_opt_in' => true,
        ],
    ];

    public array $documents = [
        'license_certificate' => null,
        'photo_id' => null,
        'insurance' => null,
    ];

    public array $regulators = [
        'NSW Fair Trading',
        'VIC Consumer Affairs',
        'QLD Housing Authority',
        'WA Consumer Protection',
        'SA Consumer and Business Services',
        'TAS Property Agents Board',
        'ACT Access Canberra',
        'NT Agents Licensing Board',
    ];

    public bool $submissionComplete = false;

    public ?string $statusMessage = null;

    public function mount(): void
    {
        $user = Auth::user();

        $this->form['profile']['email'] = (string) $user->email;
        $this->form['profile']['legal_name'] = (string) ($user->name ?? $user->email);
        $this->form['profile']['preferred_name'] = (string) ($user->preferred_name ?? '');

        $agent = WomenVerifiedAgent::query()
            ->where('user_id', $user->id)
            ->first();

        if ($agent) {
            $this->hydrateFromAgent($agent);
        }

        if (empty($this->form['references'])) {
            $this->form['references'] = [$this->blankReference()];
        }
    }

    public function goToStep(string $step): void
    {
        if (! in_array($step, $this->steps, true)) {
            return;
        }

        $targetIndex = array_search($step, $this->steps, true);
        $currentIndex = array_search($this->step, $this->steps, true);

        if ($targetIndex > $currentIndex) {
            $this->validateStep($this->step);
        }

        $this->step = $step;
    }

    public function next(): void
    {
        $this->validateStep($this->step);

        $index = array_search($this->step, $this->steps, true);
        if ($index === false || $index >= count($this->steps) - 1) {
            return;
        }

        $this->step = $this->steps[$index + 1];
    }

    public function previous(): void
    {
        $index = array_search($this->step, $this->steps, true);
        if ($index === false || $index === 0) {
            return;
        }

        $this->step = $this->steps[$index - 1];
    }

    public function addReferenceRow(): void
    {
        $this->form['references'][] = $this->blankReference();
    }

    public function removeReferenceRow(int $index): void
    {
        if (count($this->form['references']) <= 1) {
            return;
        }

        unset($this->form['references'][$index]);
        $this->form['references'] = array_values($this->form['references']);
    }

    public function submit(): void
    {
        foreach ($this->steps as $step) {
            $this->validateStep($step);
        }

        $documents = $this->finaliseDocuments();
        $user = Auth::user();

        try {
            DB::transaction(function () use ($user, $documents): void {
                $agent = WomenVerifiedAgent::query()
                    ->lockForUpdate()
                    ->firstOrNew(['user_id' => $user->id]);

                $agent->license_number = $this->form['license']['license_number'];
                $agent->regulator = $this->form['license']['regulator'];
                $agent->license_expires_at = $this->normalisedLicenseExpiry();
                $agent->status = $agent->status === 'verified' ? $agent->status : 'pending';
                $agent->verification_stage ??= VerificationStage::INITIAL;
                $agent->trust_badge_level ??= 0;

                $payload = $this->buildPayload($agent, $documents);
                $agent->verification_payload = $payload;
                $agent->save();
            });
        } catch (Throwable $exception) {
            Log::error('Failed to submit women agent verification', [
                'user_id' => $user->id,
                'exception' => $exception->getMessage(),
            ]);

            throw ValidationException::withMessages([
                'form.review.submit' => 'We could not submit your verification right now. Please try again shortly.',
            ]);
        }

            $this->markPolicyAcceptance($user);

        $this->submissionComplete = true;
        $this->statusMessage = 'Thanks! Your verification details are in review. We will follow up via email soon.';

        session()->flash('status', $this->statusMessage);

        $agent = WomenVerifiedAgent::query()->where('user_id', $user->id)->first();
        if ($agent) {
            $this->hydrateFromAgent($agent);
        }

        $this->step = 'review';
    }

    public function render()
    {
        return view('livewire.agents.verification-wizard', [
            'assistantEnabled' => $this->assistantEnabled(),
            'assistantContext' => $this->assistantSnapshot(),
        ]);
    }

    private function validateStep(string $step): void
    {
        $rules = $this->rulesForStep($step);

        if (! empty($rules)) {
            $this->validate($rules);
        }

        if ($step === 'documents') {
            $this->validateDocuments();
        }

        if ($step === 'review' && ! ($this->form['consent']['terms_accepted'] ?? false)) {
            throw ValidationException::withMessages([
                'form.consent.terms_accepted' => 'Please confirm your declaration before submitting.',
            ]);
        }
    }

    private function rulesForStep(string $step): array
    {
        return match ($step) {
            'profile' => [
                'form.profile.legal_name' => ['required', 'string', 'max:160'],
                'form.profile.preferred_name' => ['nullable', 'string', 'max:160'],
                'form.profile.phone' => ['required', 'string', 'max:40'],
                'form.profile.agency_name' => ['nullable', 'string', 'max:160'],
                'form.profile.website' => ['nullable', 'url', 'max:255'],
                'form.profile.professional_profile_url' => ['nullable', 'url', 'max:255'],
                'form.profile.experience_years' => ['nullable', 'integer', 'min:0', 'max:60'],
            ],
            'license' => [
                'form.license.license_number' => ['required', 'string', 'max:120'],
                'form.license.license_type' => ['nullable', 'string', 'max:120'],
                'form.license.regulator' => ['required', 'string', 'max:160'],
                'form.license.license_expires_at' => ['nullable', 'date', 'after:today'],
                'form.license.regions_served' => ['nullable', 'string', 'max:500'],
                'form.license.specialisations' => ['nullable', 'string', 'max:500'],
            ],
            'references' => [
                'form.references' => ['required', 'array', 'min:1'],
                'form.references.*.name' => ['required', 'string', 'max:160'],
                'form.references.*.relationship' => ['required', 'string', 'max:160'],
                'form.references.*.email' => ['required', 'email', 'max:160'],
                'form.references.*.phone' => ['nullable', 'string', 'max:40'],
            ],
            default => [],
        };
    }

    private function validateDocuments(): void
    {
        if (! Arr::get($this->documents, 'license_certificate.path')) {
            throw ValidationException::withMessages([
                'documents.license_certificate' => 'Please upload your current license certificate.',
            ]);
        }

        if (! Arr::get($this->documents, 'photo_id.path')) {
            throw ValidationException::withMessages([
                'documents.photo_id' => 'Please upload a valid photo identification document.',
            ]);
        }
    }

    private function markPolicyAcceptance(User $user): void
    {
        $updates = [];

        if (! $user->accepted_women_only_policy_at) {
            $updates['accepted_women_only_policy_at'] = now();
        }

        if (empty($user->participant_profile_type) || $user->participant_profile_type === 'member') {
            $updates['participant_profile_type'] = 'women_real_estate_agent';
        }

        if (! empty($updates)) {
            $user->forceFill($updates)->save();
        }
    }

    private function finaliseDocuments(): array
    {
        $userId = Auth::id() ?? 'guest';
        $targetDirectory = sprintf('women-agent-verifications/%s', $userId);
        Storage::disk('local')->makeDirectory($targetDirectory);

        $finalised = [];

        foreach ($this->documents as $key => $document) {
            if (! is_array($document) || empty($document)) {
                $this->documents[$key] = null;
                continue;
            }

            $this->assertDocumentSafe($document, (string) $key, (string) $userId);

            $currentPath = Arr::get($document, 'path');
            if (! $currentPath) {
                $this->documents[$key] = null;
                continue;
            }

            if (str_contains($currentPath, '/temp/')) {
                $extension = pathinfo($currentPath, PATHINFO_EXTENSION) ?: 'dat';
                $filename = Str::uuid()->toString().sprintf('_%s.%s', $key, $extension);
                $finalPath = $targetDirectory.'/'.$filename;

                if (Storage::disk('local')->exists($currentPath)) {
                    Storage::disk('local')->move($currentPath, $finalPath);
                    $document['path'] = $finalPath;
                }

                $document['uploaded_at'] = now()->toIso8601String();
            }

            $document['disk'] = Arr::get($document, 'disk', 'local');
            $finalised[$key] = $document;
            $this->documents[$key] = $document;
        }

        return $finalised;
    }

    private function buildPayload(WomenVerifiedAgent $agent, array $documents): array
    {
        $existing = $agent->verification_payload ?? [];
        $documentMap = collect($this->documents)
            ->filter(fn ($document) => is_array($document) && Arr::get($document, 'path'))
            ->map(function (array $document) {
                $document['disk'] = Arr::get($document, 'disk', 'local');

                return $document;
            })
            ->all();

        $profile = [
            'legal_name' => trim((string) ($this->form['profile']['legal_name'] ?? '')),
            'preferred_name' => $this->nullIfEmpty($this->form['profile']['preferred_name'] ?? null),
            'phone' => trim((string) ($this->form['profile']['phone'] ?? '')),
            'email' => trim((string) ($this->form['profile']['email'] ?? '')),
            'agency_name' => $this->nullIfEmpty($this->form['profile']['agency_name'] ?? null),
            'website' => $this->nullIfEmpty($this->form['profile']['website'] ?? null),
            'professional_profile_url' => $this->nullIfEmpty($this->form['profile']['professional_profile_url'] ?? null),
            'experience_years' => $this->form['profile']['experience_years'] !== null
                ? (int) $this->form['profile']['experience_years']
                : null,
        ];

        $license = [
            'number' => trim((string) ($this->form['license']['license_number'] ?? '')),
            'type' => $this->nullIfEmpty($this->form['license']['license_type'] ?? null),
            'regulator' => trim((string) ($this->form['license']['regulator'] ?? '')),
            'expires_at' => $this->normalisedLicenseExpiry()?->toIso8601String(),
            'regions_served' => $this->normaliseList($this->form['license']['regions_served'] ?? null),
            'specialisations' => $this->normaliseList($this->form['license']['specialisations'] ?? null),
        ];

        $payload = array_merge($existing, [
            'application' => [
                'profile' => $profile,
                'license' => $license,
                'documents' => $documentMap,
                'references' => $this->sanitiseReferences($this->form['references']),
                'consent' => [
                    'share_with_partners' => (bool) ($this->form['consent']['share_with_partners'] ?? false),
                    'ai_followups_opt_in' => (bool) ($this->form['consent']['ai_followups_opt_in'] ?? false),
                    'terms_accepted_at' => now()->toIso8601String(),
                ],
            ],
            'last_submission_at' => now()->toIso8601String(),
        ]);

        return $payload;
    }

    private function assertDocumentSafe(array $document, string $field, string $userId): void
    {
        $path = (string) Arr::get($document, 'path', '');

        if ($path === '') {
            return;
        }

        if (str_contains($path, '..')) {
            throw ValidationException::withMessages([
                'documents.'.$field => 'We detected a problem with your '.$this->documentLabel($field).' upload. Please choose the original file and try again.',
            ]);
        }

        $allowedPrefixes = [
            "women-agent-verifications/temp/{$userId}/",
            "women-agent-verifications/{$userId}/",
        ];

        if (! Str::startsWith($path, $allowedPrefixes)) {
            throw ValidationException::withMessages([
                'documents.'.$field => 'That upload location looks unusual. For your safety please upload the original document again.',
            ]);
        }

        $mime = strtolower((string) Arr::get($document, 'mime_type', ''));
        if ($mime !== '' && ! in_array($mime, $this->allowedDocumentMimeTypes, true)) {
            throw ValidationException::withMessages([
                'documents.'.$field => 'This file type is not supported. Upload a PDF or image of the original document.',
            ]);
        }

        $originalName = strtolower((string) Arr::get($document, 'original_name', ''));
        foreach ($this->blockedDocumentExtensions as $extension) {
            if ($extension !== '' && Str::endsWith($originalName, '.'.$extension)) {
                throw ValidationException::withMessages([
                    'documents.'.$field => 'We blocked a potentially unsafe file. Please export the original document and upload it again.',
                ]);
            }
        }

        $size = (int) Arr::get($document, 'size', 0);
        if ($size > 15 * 1024 * 1024) {
            throw ValidationException::withMessages([
                'documents.'.$field => 'Files must be 15MB or smaller. Please compress the document or choose a lighter scan.',
            ]);
        }
    }

    private function documentLabel(string $field): string
    {
        return match ($field) {
            'license_certificate' => 'license certificate',
            'photo_id' => 'photo ID',
            'insurance' => 'insurance document',
            default => 'document',
        };
    }

    private function assistantEnabled(): bool
    {
        return (bool) Arr::get($this->form, 'consent.ai_followups_opt_in', true);
    }

    private function assistantSnapshot(): array
    {
        $present = [];

        $user = Auth::user();

        if ($user instanceof User) {
            $updates = [];

            if (! $user->accepted_women_only_policy_at) {
                $updates['accepted_women_only_policy_at'] = now();
            }

            if (empty($user->participant_profile_type) || $user->participant_profile_type === 'member') {
                $updates['participant_profile_type'] = 'women_real_estate_agent';
            }

            if (! empty($updates)) {
                $user->forceFill($updates)->save();
            }
        }

        foreach ($this->documents as $key => $document) {
            if (is_array($document) && Arr::get($document, 'path')) {
                $present[] = $key;
            }
        }

        $missing = array_values(array_diff(array_keys($this->documents), $present));

        return [
            'step' => $this->step,
            'regulator' => $this->form['license']['regulator'] ?? null,
            'license_expires_at' => $this->form['license']['license_expires_at'] ?? null,
            'documents_present' => $present,
            'documents_missing' => $missing,
        ];
    }

    private function hydrateFromAgent(WomenVerifiedAgent $agent): void
    {
        $payload = $agent->verification_payload ?? [];
        $application = Arr::get($payload, 'application', []);
        $profile = Arr::get($application, 'profile', []);
        $license = Arr::get($application, 'license', []);
        $references = Arr::get($application, 'references', []);
        $documents = Arr::get($application, 'documents', []);
        $consent = Arr::get($application, 'consent', []);

        foreach ($profile as $key => $value) {
            if (array_key_exists($key, $this->form['profile'])) {
                $this->form['profile'][$key] = $value;
            }
        }

        $this->form['profile']['experience_years'] = $profile['experience_years'] ?? $this->form['profile']['experience_years'];

        foreach ($license as $key => $value) {
            if (array_key_exists($key, $this->form['license'])) {
                if (is_array($value)) {
                    $this->form['license'][$key] = implode(', ', $value);
                } else {
                    $this->form['license'][$key] = $value;
                }
            }
        }

        $this->form['license']['license_number'] = (string) ($agent->license_number ?? $this->form['license']['license_number']);
        $this->form['license']['regulator'] = (string) ($agent->regulator ?? $this->form['license']['regulator']);

        $expiresAt = null;

        if ($agent->license_expires_at) {
            $expiryCarbon = Carbon::make($agent->license_expires_at);
            if ($expiryCarbon) {
                $expiresAt = $expiryCarbon->format('Y-m-d');
            }
        }

        if (! $expiresAt && ! empty($license['expires_at'])) {
            try {
                $expiresAt = Carbon::parse($license['expires_at'])->format('Y-m-d');
            } catch (Throwable) {
                $expiresAt = '';
            }
        }

        $this->form['license']['license_expires_at'] = $expiresAt;

        if (! empty($references)) {
            $this->form['references'] = collect($references)
                ->map(function (array $reference) {
                    return [
                        'name' => $reference['name'] ?? '',
                        'relationship' => $reference['relationship'] ?? '',
                        'email' => $reference['email'] ?? '',
                        'phone' => $reference['phone'] ?? '',
                    ];
                })
                ->values()
                ->all();
        }

        foreach ($this->documents as $key => $value) {
            if (isset($documents[$key])) {
                $this->documents[$key] = $documents[$key];
            }
        }

        $this->form['consent']['share_with_partners'] = (bool) ($consent['share_with_partners'] ?? false);
        $this->form['consent']['ai_followups_opt_in'] = (bool) ($consent['ai_followups_opt_in'] ?? true);
        $this->form['consent']['terms_accepted'] = true;
    }

    private function blankReference(): array
    {
        return [
            'name' => '',
            'relationship' => '',
            'email' => '',
            'phone' => '',
        ];
    }

    private function normaliseList(?string $value): ?array
    {
        if ($value === null) {
            return null;
        }

        $items = collect(preg_split('/[\n,]+/', (string) $value))
            ->map(static fn (string $item) => trim($item))
            ->filter()
            ->unique()
            ->values()
            ->all();

        return empty($items) ? null : $items;
    }

    private function sanitiseReferences(array $references): array
    {
        return collect($references)
            ->map(function (array $reference) {
                return [
                    'name' => trim((string) ($reference['name'] ?? '')),
                    'relationship' => trim((string) ($reference['relationship'] ?? '')),
                    'email' => trim((string) ($reference['email'] ?? '')),
                    'phone' => $this->nullIfEmpty($reference['phone'] ?? null),
                ];
            })
            ->filter(fn (array $reference) => $reference['name'] !== '' && $reference['email'] !== '')
            ->values()
            ->all();
    }

    private function normalisedLicenseExpiry(): ?Carbon
    {
        $value = $this->form['license']['license_expires_at'] ?? null;
        if (! $value) {
            return null;
        }

        try {
            return Carbon::parse($value)->startOfDay();
        } catch (Throwable) {
            return null;
        }
    }

    private function nullIfEmpty($value): ?string
    {
        $value = $value === null ? null : trim((string) $value);

        return $value === '' ? null : $value;
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

final class VerificationWizard extends LivewireComponent
{
    use VerificationWizardBehavior;
}

