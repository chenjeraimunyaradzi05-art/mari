<?php

declare(strict_types=1);

namespace App\Services\WomenRealEstate;

use App\Enums\WomenRealEstate\PartnerIntentType;
use App\Enums\WomenRealEstate\PartnerIntentionStatus;
use App\Models\User;
use App\Models\WomenRealEstate\WomenListing;
use App\Models\WomenRealEstate\WomenListingPartnerIntention;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;

use App\Services\WomenRealEstate\Contracts\WomenListingAnalyticsServiceContract;

final class WomenListingPartnerIntentService
{
    private WomenListingAnalyticsServiceContract $analytics;

    public function __construct(WomenListingAnalyticsServiceContract $analytics)
    {
        $this->analytics = $analytics;
    }

    public function create(WomenListing $listing, User $initiator, array $payload): WomenListingPartnerIntention
    {
        $preferences = Arr::get($payload, 'preferences', []);
        $expiresAt = isset($payload['expires_at']) ? Carbon::parse($payload['expires_at']) : null;

        /** @var PartnerIntentType $intent */
        $intent = $payload['intent'];

        $intentRecord = $listing->partnerIntentions()->create([
            'initiator_id' => $initiator->id,
            'invitee_id' => $payload['invitee_id'] ?? null,
            'status' => PartnerIntentionStatus::PENDING,
            'intent' => $intent,
            'preferences' => $preferences,
            'message' => $payload['message'] ?? null,
            'expires_at' => $expiresAt,
        ]);

        $this->analytics->invalidateMetricsCache();

        return $intentRecord;
    }

    public function respond(
        WomenListingPartnerIntention $intention,
        PartnerIntentionStatus $status,
        ?string $message,
        User $actor
    ): WomenListingPartnerIntention {
        $allowed = $this->allowedStatusesForActor($intention, $actor);

        if (! in_array($status, $allowed, true)) {
            throw new \InvalidArgumentException('Status transition not permitted for this actor.');
        }

        $intention->forceFill([
            'status' => $status,
            'message' => $message ?? $intention->message,
        ])->save();

        $this->analytics->invalidateMetricsCache();

        return $intention->refresh();
    }

    public function cancel(WomenListingPartnerIntention $intention): void
    {
        $intention->forceFill(['status' => PartnerIntentionStatus::WITHDRAWN])->save();
        $this->analytics->invalidateMetricsCache();
    }

    /**
     * @return (App\Enums\WomenRealEstate\PartnerIntentionStatus::ACCEPTED|App\Enums\WomenRealEstate\PartnerIntentionStatus::DECLINED|App\Enums\WomenRealEstate\PartnerIntentionStatus::WITHDRAWN)[]
     *
     * @psalm-return list{0?: App\Enums\WomenRealEstate\PartnerIntentionStatus::ACCEPTED|App\Enums\WomenRealEstate\PartnerIntentionStatus::WITHDRAWN, 1?: App\Enums\WomenRealEstate\PartnerIntentionStatus::DECLINED, 2?: App\Enums\WomenRealEstate\PartnerIntentionStatus::WITHDRAWN}
     */
    private function allowedStatusesForActor(WomenListingPartnerIntention $intention, User $actor): array
    {
        if ($this->isListingOwner($intention, $actor) || $this->isInvitee($intention, $actor)) {
            return [PartnerIntentionStatus::ACCEPTED, PartnerIntentionStatus::DECLINED];
        }

        if ($this->isInitiator($intention, $actor)) {
            return [PartnerIntentionStatus::WITHDRAWN];
        }

        if ($this->isModerator($actor)) {
            return [
                PartnerIntentionStatus::ACCEPTED,
                PartnerIntentionStatus::DECLINED,
                PartnerIntentionStatus::WITHDRAWN,
            ];
        }

        return [];
    }

    private function isListingOwner(WomenListingPartnerIntention $intention, User $actor): bool
    {
        $listing = $intention->listing;

        return $listing !== null && $listing->owner_id === $actor->id;
    }

    private function isInitiator(WomenListingPartnerIntention $intention, User $actor): bool
    {
        return $intention->initiator_id === $actor->id;
    }

    private function isInvitee(WomenListingPartnerIntention $intention, User $actor): bool
    {
        return $intention->invitee_id !== null && $intention->invitee_id === $actor->id;
    }

    private function isModerator(User $actor): bool
    {
        return method_exists($actor, 'hasAnyRole')
            ? $actor->hasAnyRole(['Super Admin', 'Admin', 'Moderator'])
            : false;
    }
}

