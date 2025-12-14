<?php

declare(strict_types=1);

namespace App\Livewire\WomenRealEstate\Listings;

use App\Enums\WomenRealEstate\ListingAudience;
use App\Enums\WomenRealEstate\ListingIntent;
use App\Enums\WomenRealEstate\PartnerIntentionStatus;
use App\Enums\WomenRealEstate\PartnerIntentType;
use App\Events\WomenRealEstate\WomenListingPublished;
use App\Http\Resources\WomenRealEstate\WomenListingResource;
use App\Models\User;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenListingPartnerIntention;
use App\Services\WomenRealEstate\Contracts\WomenListingAnalyticsServiceContract as WomenListingAnalyticsService;
use App\Services\WomenRealEstate\WomenListingMediaPipeline;
use App\Services\WomenRealEstate\WomenListingPartnerIntentService;
use App\Services\WomenRealEstate\WomenListingSocialShareService;
use App\Support\Livewire\FallbackComponent;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Livewire\WithFileUploads;
use Livewire\Features\SupportFileUploads\TemporaryUploadedFile;

trait WizardBehavior
{
    use WithFileUploads;

    public ?int $listingId = null;

    public string $step = 'basics';

    /**
     * @var array<int, string>
     */
    public array $steps = ['basics', 'media', 'partnerships', 'review'];

    /**
     * @var array<string, string>
     */
    public array $stepLabels = [
        'basics' => 'Listing Basics',
        'media' => 'Media & Visuals',
        'partnerships' => 'Partner Intents',
        'review' => 'Review & Publish',
    ];

    /** @var array<string, mixed> */
    public array $basics = [
        'title' => '',
        'summary' => '',
        'description' => '',
        'intent' => null,
        'primary_audience' => null,
        'audience_overrides' => [],
        'features_input' => '',
        'bedrooms' => null,
        'bathrooms' => null,
        'car_spaces' => null,
        'price' => null,
        'price_frequency' => null,
        'currency' => 'AUD',
        'agent_id' => null,
        'category_id' => null,
        'location_id' => null,
        'expires_at' => null,
        'ai_safe' => true,
    ];

    /** @var array<int, array<string, mixed>> */
    public array $media = [];

    /** @var array<int, array<string, mixed>> */
    public array $partnerIntents = [];

    /** @var array<int, array<string, mixed>> */
    public array $socialShares = [];

    /** @var array<int, TemporaryUploadedFile> */
    public array $mediaUploads = [];

    /** @var array<string, mixed> */
    public array $partnerForm = [
        'intent' => 'co_purchase',
        'invitee_id' => null,
        'message' => '',
        'expires_at' => null,
    ];

    /** @var array<string, mixed> */
    public array $socialForm = [
        'platform' => '',
        'share_url' => '',
        'shared_at' => '',
        'meta' => '',
    ];

    public bool $isSaving = false;

    public bool $isUploadingMedia = false;

    public ?string $statusMessage = null;

    public bool $submissionComplete = false;

    /** @var array<int, string> */
    public array $audienceOptions = [];

    /** @var array<int, string> */
    public array $intentOptions = [];

    /** @var array<int, string> */
    public array $partnerIntentOptions = [];

    /** @var array<int, string> */
    public array $priceFrequencyOptions = ['weekly', 'fortnightly', 'monthly', 'annual', 'total'];

    /** @var array<int, string> */
    public array $currencyOptions = ['AUD', 'NZD', 'USD', 'GBP'];

    protected ?WomenListing $listing = null;

    protected WomenListingMediaPipeline $mediaPipeline;

    protected WomenListingPartnerIntentService $partnerIntentService;

    protected WomenListingSocialShareService $socialShareService;

    protected WomenListingAnalyticsService $analytics;

    public function boot(
        WomenListingMediaPipeline $mediaPipeline,
        WomenListingPartnerIntentService $partnerIntentService,
        WomenListingSocialShareService $socialShareService,
        WomenListingAnalyticsService $analytics,
    ): void {
        $this->mediaPipeline = $mediaPipeline;
        $this->partnerIntentService = $partnerIntentService;
        $this->socialShareService = $socialShareService;
        $this->analytics = $analytics;
    }

    public function mount(?int $listingId = null): void
    {
        $this->listingId = $listingId;
        $this->intentOptions = array_map(static fn (ListingIntent $intent) => $intent->value, ListingIntent::cases());
        $this->audienceOptions = array_map(static fn (ListingAudience $audience) => $audience->value, ListingAudience::cases());
        $this->partnerIntentOptions = array_map(static fn (PartnerIntentType $intent) => $intent->value, PartnerIntentType::cases());

        if ($listingId !== null) {
            $this->loadListing($listingId);
        } else {
            Gate::authorize('create', WomenListing::class);
        }
    }

    public function updatedStep(string $value): void
    {
        if (! in_array($value, $this->steps, true)) {
            $this->step = $this->steps[0];
        }
    }

    public function goToStep(string $step): void
    {
        if (! in_array($step, $this->steps, true)) {
            return;
        }

        $currentIndex = array_search($this->step, $this->steps, true);
        $targetIndex = array_search($step, $this->steps, true);

        if ($targetIndex > $currentIndex && $this->step === 'basics') {
            $this->saveBasics();
        }

        $this->step = $step;
    }

    public function next(): void
    {
        $index = array_search($this->step, $this->steps, true);
        if ($index === false || $index >= count($this->steps) - 1) {
            return;
        }

        if ($this->step === 'basics') {
            $this->saveBasics();
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

    public function saveBasics(): void
    {
        if ($this->isSaving) {
            return;
        }

        $this->isSaving = true;
        $this->resetErrorBag();

        try {
            $data = $this->validate($this->basicsRules());
            $payload = $this->prepareBasicsPayload($data['basics']);

            if ($this->listingId === null) {
                $this->createListing($payload);
            } else {
                $this->updateListing($payload);
            }

            $this->statusMessage = 'Listing basics saved.';
            $this->submissionComplete = false;
        } catch (ValidationException $exception) {
            throw $exception;
        } catch (\Throwable $exception) {
            Log::error('women.listings.wizard.basics_failed', [
                'user_id' => Auth::id(),
                'listing_id' => $this->listingId,
                'message' => $exception->getMessage(),
            ]);

            $this->addError('basics', 'We could not save your listing basics. Please try again.');
        } finally {
            $this->isSaving = false;
        }
    }

    public function uploadMedia(): void
    {
        if ($this->listingId === null || $this->listing === null) {
            $this->addError('media_uploads', 'Save your basics before adding media.');

            return;
        }

        $this->validate($this->mediaRules());

        if ($this->mediaUploads === []) {
            return;
        }

        $this->isUploadingMedia = true;
        $listing = $this->getListing();

        try {
            foreach ($this->mediaUploads as $upload) {
                /** @var \Illuminate\Http\UploadedFile $file */
                $file = $upload;
                $this->mediaPipeline->upload($listing, $file);
            }

            $this->mediaUploads = [];
            $this->refreshListing();
            $this->statusMessage = 'Media uploaded successfully.';
        } catch (\Throwable $exception) {
            Log::error('women.listings.wizard.media_failed', [
                'listing_id' => $this->listingId,
                'user_id' => Auth::id(),
                'message' => $exception->getMessage(),
            ]);

            $this->addError('media_uploads', 'Unable to upload media. Please try again or use smaller files.');
        } finally {
            $this->isUploadingMedia = false;
        }
    }

    public function updateMedia(int $mediaId, ?string $caption = null): void
    {
        $listing = $this->getListing();
        $media = collect($listing->media)->firstWhere('id', $mediaId);

        if (! $media) {
            return;
        }

        $selected = collect($this->media)->firstWhere('id', $mediaId);
        $position = $selected['position'] ?? $media->position;

        $this->mediaPipeline->updateMeta($media, [
            'caption' => $caption,
            'position' => $position,
        ]);

        $this->refreshListing();
    }

    public function moveMedia(int $mediaId, string $direction): void
    {
        $listing = $this->getListing();
        $ordered = collect($this->media);
        $index = $ordered->search(static fn (array $item) => $item['id'] === $mediaId);

        if ($index === false) {
            return;
        }

        $swapWith = match ($direction) {
            'up' => $index - 1,
            'down' => $index + 1,
            default => null,
        };

        if ($swapWith === null || $swapWith < 0 || $swapWith >= $ordered->count()) {
            return;
        }

        $orderedItems = $ordered->all();
        [$orderedItems[$index], $orderedItems[$swapWith]] = [$orderedItems[$swapWith], $orderedItems[$index]];

        $orderedIds = array_map(static fn (array $item) => $item['id'], $orderedItems);
        $this->mediaPipeline->reorder($listing, $orderedIds);
        $this->refreshListing();
    }

    public function removeMedia(int $mediaId): void
    {
        $listing = $this->getListing();
        $media = $listing->media->firstWhere('id', $mediaId);

        if (! $media) {
            return;
        }

        $this->mediaPipeline->remove($media);
        $this->refreshListing();
    }

    public function createPartnerIntent(): void
    {
        $listing = $this->getListing();
        Gate::authorize('create', [WomenListingPartnerIntention::class, $listing]);

        $data = $this->validate($this->partnerRules());
        $payload = $data['partnerForm'];

        $payload['intent'] = PartnerIntentType::from($payload['intent']);

        if (isset($payload['expires_at']) && $payload['expires_at']) {
            $payload['expires_at'] = Carbon::parse($payload['expires_at']);
        }

        $this->partnerIntentService->create($listing, Auth::user(), $payload);
        $this->partnerForm = [
            'intent' => 'co_purchase',
            'invitee_id' => null,
            'message' => '',
            'expires_at' => null,
        ];

        $this->refreshListing();
        $this->statusMessage = 'Partner intent invited successfully.';
    }

    public function respondToIntent(int $intentId, string $status): void
    {
        $listing = $this->getListing();
        $intention = $listing->partnerIntentions->firstWhere('id', $intentId);

        if (! $intention) {
            return;
        }

        try {
            $this->partnerIntentService->respond(
                $intention,
                PartnerIntentionStatus::from($status),
                null,
                Auth::user(),
            );

            $this->refreshListing();
        } catch (\Throwable $exception) {
            $this->addError('partnerIntents', 'Unable to update partner intent.');
        }
    }

    public function cancelIntent(int $intentId): void
    {
        $listing = $this->getListing();
        $intention = $listing->partnerIntentions->firstWhere('id', $intentId);

        if (! $intention) {
            return;
        }

        $this->partnerIntentService->cancel($intention);
        $this->refreshListing();
    }

    public function recordSocialShare(): void
    {
        $listing = $this->getListing();
        $data = $this->validate($this->socialRules());
        $payload = $data['socialForm'];

        if (! empty($payload['shared_at'])) {
            $payload['shared_at'] = Carbon::parse($payload['shared_at']);
        } else {
            unset($payload['shared_at']);
        }

        if (! empty($payload['meta'])) {
            $payload['meta'] = $this->normaliseMetaInput($payload['meta']);
        } else {
            $payload['meta'] = [];
        }

        $this->socialShareService->recordShare($listing, $payload, Auth::user());
        $this->refreshListing();
        $this->socialForm = [
            'platform' => '',
            'share_url' => '',
            'shared_at' => '',
            'meta' => '',
        ];

        $this->statusMessage = 'Social share recorded.';
    }

    public function publishListing(?string $publishedAt = null): void
    {
        $listing = $this->getListing();

        try {
            Gate::authorize('publish', $listing);

            $listing->forceFill([
                'published_at' => $publishedAt ? Carbon::parse($publishedAt) : now(),
            ])->save();

            $listing->refresh();
            WomenListingPublished::dispatch($listing);
            $this->analytics->invalidateMetricsCache();

            $this->refreshListing();
            $this->submissionComplete = true;
            $this->statusMessage = 'Listing published successfully.';
        } catch (ValidationException $exception) {
            foreach ($exception->errors() as $messages) {
                foreach ($messages as $message) {
                    $this->addError('publish', $message);
                }
            }
        } catch (\Throwable $exception) {
            $this->addError('publish', 'Unable to publish listing right now.');
            Log::error('women.listings.wizard.publish_failed', [
                'listing_id' => $listing->id,
                'user_id' => Auth::id(),
                'message' => $exception->getMessage(),
            ]);
        }
    }

    public function unpublishListing(): void
    {
        $listing = $this->getListing();

        try {
            Gate::authorize('publish', $listing);

            $listing->forceFill(['published_at' => null])->save();
            $listing->refresh();
            $this->analytics->invalidateMetricsCache();

            $this->refreshListing();
            $this->statusMessage = 'Listing reverted to draft.';
        } catch (\Throwable $exception) {
            $this->addError('publish', 'Unable to unpublish listing right now.');
        }
    }

    protected function createListing(array $payload): void
    {
        $user = Auth::user();

        if (! $user instanceof User) {
            abort(403);
        }

        Gate::authorize('create', WomenListing::class);

        $listing = WomenListing::create($payload + [
            'owner_id' => $user->id,
        ]);

        $listing->refresh()->load($this->relations());
        $this->listing = $listing;
        $this->listingId = $listing->id;
        $this->syncStateFromListing($listing);
    }

    protected function updateListing(array $payload): void
    {
        $listing = $this->getListing();

        Gate::authorize('update', $listing);

        $listing->fill($payload);
        $listing->save();

        $this->refreshListing();
    }

    protected function refreshListing(): void
    {
        if ($this->listingId === null) {
            return;
        }

        $this->listing = WomenListing::query()
            ->with($this->relations())
            ->findOrFail($this->listingId);

        $this->syncStateFromListing($this->listing);
    }

    protected function loadListing(int $listingId): void
    {
        $listing = WomenListing::query()
            ->with($this->relations())
            ->findOrFail($listingId);

        Gate::authorize('update', $listing);

        $this->listing = $listing;
        $this->syncStateFromListing($listing);
    }

    protected function syncStateFromListing(WomenListing $listing): void
    {
        $resource = $this->resourcePayload($listing);

        $this->basics = array_merge($this->basics, [
            'title' => $resource['title'] ?? '',
            'summary' => $resource['summary'] ?? '',
            'description' => $resource['description'] ?? '',
            'intent' => $resource['intent'] ?? null,
            'primary_audience' => $resource['primary_audience'] ?? null,
            'audience_overrides' => $resource['audience_overrides'] ?? [],
            'features_input' => $this->featuresToString($resource['features'] ?? []),
            'bedrooms' => $resource['bedrooms'],
            'bathrooms' => $resource['bathrooms'],
            'car_spaces' => $resource['car_spaces'],
            'price' => $resource['price'],
            'price_frequency' => $resource['price_frequency'],
            'currency' => $resource['currency'] ?? 'AUD',
            'agent_id' => $resource['agent']['id'] ?? null,
            'category_id' => $resource['category']['id'] ?? null,
            'location_id' => $resource['location']['id'] ?? null,
            'expires_at' => $resource['expires_at'] ? Carbon::parse($resource['expires_at'])->toDateString() : null,
            'ai_safe' => (bool) ($resource['is_ai_safe'] ?? true),
        ]);

        $this->media = collect($resource['media'] ?? [])
            ->sortBy('position')
            ->values()
            ->all();

        $this->partnerIntents = collect($listing->partnerIntentions)
            ->map(static function ($intent) {
                return [
                    'id' => $intent->id,
                    'intent' => $intent->intent?->value ?? $intent->intent,
                    'status' => $intent->status?->value ?? $intent->status,
                    'invitee' => $intent->invitee?->only(['id', 'name']),
                    'initiator' => $intent->initiator?->only(['id', 'name']),
                    'message' => $intent->message,
                    'expires_at' => optional($intent->expires_at)->toDateTimeString(),
                    'created_at' => optional($intent->created_at)->diffForHumans(),
                ];
            })
            ->values()
            ->all();

        $this->socialShares = collect($resource['social_shares'] ?? [])
            ->map(static function (array $share) {
                return [
                    'id' => $share['id'],
                    'platform' => $share['platform'],
                    'share_url' => $share['share_url'],
                    'shared_at' => $share['shared_at'] ?? null,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    protected function resourcePayload(WomenListing $listing): array
    {
        return WomenListingResource::make($listing->load($this->relations()))->resolve();
    }

    /**
     * @return array<int, string>
     */
    protected function relations(): array
    {
        return [
            'media',
            'partnerIntentions.initiator:id,name',
            'partnerIntentions.invitee:id,name',
            'socialShares',
            'agent',
            'category',
            'location',
        ];
    }

    /**
     * @return array<string, array<int, mixed>|Rule[]>
     */
    protected function basicsRules(): array
    {
        $intentValues = $this->intentOptions;
        $audienceValues = $this->audienceOptions;

        return [
            'basics.title' => ['required', 'string', 'max:255'],
            'basics.summary' => ['required', 'string', 'max:500'],
            'basics.description' => ['nullable', 'string'],
            'basics.intent' => ['required', Rule::in($intentValues)],
            'basics.primary_audience' => ['required', Rule::in($audienceValues)],
            'basics.audience_overrides' => ['nullable', 'array'],
            'basics.audience_overrides.*' => [Rule::in($audienceValues)],
            'basics.features_input' => ['nullable', 'string'],
            'basics.bedrooms' => ['nullable', 'integer', 'min:0', 'max:12'],
            'basics.bathrooms' => ['nullable', 'integer', 'min:0', 'max:12'],
            'basics.car_spaces' => ['nullable', 'integer', 'min:0', 'max:10'],
            'basics.price' => ['nullable', 'numeric', 'min:0'],
            'basics.price_frequency' => ['nullable', Rule::in($this->priceFrequencyOptions)],
            'basics.currency' => ['nullable', 'string', 'size:3'],
            'basics.agent_id' => ['nullable', 'integer', 'exists:women_verified_agents,id'],
            'basics.category_id' => ['nullable', 'integer', 'exists:women_listing_categories,id'],
            'basics.location_id' => ['nullable', 'integer', 'exists:women_listing_locations,id'],
            'basics.expires_at' => ['nullable', 'date', 'after:today'],
            'basics.ai_safe' => ['boolean'],
        ];
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    protected function mediaRules(): array
    {
        $maxKilobytes = (int) config('women_real_estate.media.max_filesize_kb', 51_200);
        $mimes = implode(',', config('women_real_estate.media.allowed_mimes', ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'pdf']));

        return [
            'mediaUploads' => ['required', 'array', 'max:12'],
            'mediaUploads.*' => array_filter([
                'file',
                'max:' . $maxKilobytes,
                $mimes ? 'mimes:' . $mimes : null,
            ]),
        ];
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    protected function partnerRules(): array
    {
        $currentUserId = Auth::id();

        return [
            'partnerForm.intent' => ['required', Rule::in($this->partnerIntentOptions)],
            'partnerForm.invitee_id' => array_filter([
                'nullable',
                'integer',
                'exists:users,id',
                $currentUserId ? Rule::notIn([$currentUserId]) : null,
            ]),
            'partnerForm.message' => ['nullable', 'string', 'max:1000'],
            'partnerForm.expires_at' => ['nullable', 'date', 'after:now'],
        ];
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    protected function socialRules(): array
    {
        return [
            'socialForm.platform' => ['required', 'string', 'max:100'],
            'socialForm.share_url' => ['required', 'url', 'max:500'],
            'socialForm.shared_at' => ['nullable', 'date'],
            'socialForm.meta' => ['nullable', 'string'],
        ];
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    protected function prepareBasicsPayload(array $data): array
    {
        $features = $this->normaliseFeatures($data['features_input'] ?? '');
        $audienceOverrides = collect($data['audience_overrides'] ?? [])
            ->filter(static fn ($value) => $value !== null && $value !== '')
            ->unique()
            ->values()
            ->all();

        $payload = [
            'title' => $data['title'],
            'summary' => $data['summary'],
            'description' => $data['description'] ?: null,
            'intent' => ListingIntent::from($data['intent']),
            'primary_audience' => ListingAudience::from($data['primary_audience']),
            'audience_overrides' => $audienceOverrides ?: null,
            'features' => $features,
            'bedrooms' => $this->nullIfEmpty($data['bedrooms']),
            'bathrooms' => $this->nullIfEmpty($data['bathrooms']),
            'car_spaces' => $this->nullIfEmpty($data['car_spaces']),
            'price' => $this->nullIfEmpty($data['price']) !== null ? (float) $data['price'] : null,
            'price_frequency' => $data['price_frequency'] ?: null,
            'currency' => $data['currency'] ?: null,
            'agent_id' => $this->nullIfEmpty($data['agent_id']),
            'category_id' => $this->nullIfEmpty($data['category_id']),
            'location_id' => $this->nullIfEmpty($data['location_id']),
            'expires_at' => $data['expires_at'] ? Carbon::parse($data['expires_at']) : null,
            'is_ai_safe' => (bool) ($data['ai_safe'] ?? true),
        ];

        return $payload;
    }

    protected function normaliseFeatures(?string $input): ?array
    {
        if ($input === null) {
            return null;
        }

        $features = collect(preg_split('/[\r\n,]+/', (string) $input))
            ->map(static fn ($value) => trim((string) $value))
            ->filter()
            ->values();

        return $features->isEmpty() ? null : $features->all();
    }

    protected function normaliseMetaInput(string $input): array
    {
        $lines = collect(preg_split('/[\r\n,]+/', $input))
            ->map(static fn ($value) => trim((string) $value))
            ->filter();

        $result = [];

        foreach ($lines as $line) {
            if (str_contains($line, ':')) {
                [$key, $value] = array_map('trim', explode(':', $line, 2));
                if ($key !== '') {
                    $result[$key] = $value;
                }
            } else {
                $result[] = $line;
            }
        }

        return $result;
    }

    protected function featuresToString(?array $features): string
    {
        if ($features === null) {
            return '';
        }

        if (Arr::isAssoc($features)) {
            return collect($features)
                ->map(static fn ($value, $key) => trim((string) $key . ': ' . (string) $value))
                ->implode(PHP_EOL);
        }

        return collect($features)->map(static fn ($value) => trim((string) $value))->implode(PHP_EOL);
    }

    protected function nullIfEmpty($value)
    {
        if ($value === '' || $value === null) {
            return null;
        }

        return is_numeric($value) ? $value : trim((string) $value);
    }

    protected function getListing(): WomenListing
    {
        if ($this->listing instanceof WomenListing) {
            return $this->listing;
        }

        if ($this->listingId === null) {
            abort(404);
        }

        $listing = WomenListing::query()->with($this->relations())->findOrFail($this->listingId);
        Gate::authorize('update', $listing);
        $this->listing = $listing;

        return $listing;
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

final class Wizard extends LivewireComponent
{
    use WizardBehavior;
}

