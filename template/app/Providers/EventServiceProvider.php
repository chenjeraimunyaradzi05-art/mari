<?php
/**
 * EventServiceProvider
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Providers;

use App\Events\LeadSubmitted;
use App\Events\OrgInviteFailed;
use App\Events\OrgInviteSent;
use App\Events\ProfilePrivacyTierChanged;
use App\Events\Social\EngagementMetricUpdated;
use App\Events\WomenRealEstate\MortgageIntelligenceAccessed;
use App\Events\WomenRealEstate\WomenListingPublished;
use App\Listeners\EmitPrivacyTierChangedAnalytics;
use App\Listeners\MarkOrgInviteFailed;
use App\Listeners\MarkOrgInviteSent;
use App\Listeners\NotifyOrgAdminsOfLead;
use App\Listeners\SendLeadConfirmationToCandidate;
use App\Listeners\Social\DispatchEngagementAiHooks;
use App\Listeners\TrackLeadSubmission;
use App\Listeners\WomenRealEstate\RecordMortgageIntelligenceAccess;
use App\Listeners\WomenRealEstate\ScheduleListingSocialAmplification;
use App\Models\Candidate;
use App\Models\CandidateCV;
use App\Observers\CandidateCVObserver;
use App\Observers\CandidateObserver;
use App\Models\SocialComment;
use App\Models\SocialFollow;
use App\Models\SocialPost;
use App\Models\SocialPostMedia;
use App\Models\SocialPostReaction;
use App\Observers\SocialFollowObserver;
use App\Observers\SocialPostCommentObserver;
use App\Observers\SocialPostMediaObserver;
use App\Observers\SocialPostObserver;
use App\Observers\SocialPostReactionObserver;
use Illuminate\Auth\Events\Registered;
use Illuminate\Auth\Listeners\SendEmailVerificationNotification;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Event;

final class EventServiceProvider extends ServiceProvider
{
    /**
     * The event to listener mappings for the application.
     *
     * @var array<class-string, array<int, class-string>>
     */
    protected $listen = [
        Registered::class => [
            SendEmailVerificationNotification::class,
        ],
        OrgInviteSent::class => [
            MarkOrgInviteSent::class,
        ],
        OrgInviteFailed::class => [
            MarkOrgInviteFailed::class,
        ],
        LeadSubmitted::class => [
            NotifyOrgAdminsOfLead::class,
            SendLeadConfirmationToCandidate::class,
            TrackLeadSubmission::class,
        ],
        MortgageIntelligenceAccessed::class => [
            RecordMortgageIntelligenceAccess::class,
        ],
        WomenListingPublished::class => [
            ScheduleListingSocialAmplification::class,
        ],
        EngagementMetricUpdated::class => [
            DispatchEngagementAiHooks::class,
        ],
        ProfilePrivacyTierChanged::class => [
            EmitPrivacyTierChangedAnalytics::class,
        ],
    ];

    /**
     * Model observers for the application.
     *
     * @var array<class-string, array<int, class-string>>
     */
    protected $observers = [
        Candidate::class => [CandidateObserver::class],
        CandidateCV::class => [CandidateCVObserver::class],
        SocialPost::class => [SocialPostObserver::class],
        SocialPostMedia::class => [SocialPostMediaObserver::class],
        SocialComment::class => [SocialPostCommentObserver::class],
        SocialPostReaction::class => [SocialPostReactionObserver::class],
        SocialFollow::class => [SocialFollowObserver::class],
    ];

    /**
     * Register any events for your application.
     */
    #[\Override]
    public function boot(): void
    {
        //
    }

    /**
     * Determine if events and listeners should be automatically discovered.
     *
     * @return false
     */
    #[\Override]
    public function shouldDiscoverEvents(): bool
    {
        return false;
    }
}

