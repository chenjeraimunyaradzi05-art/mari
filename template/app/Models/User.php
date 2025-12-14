<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Budget;
use App\Models\BundleOffer;
use App\Models\BusinessCashbook;
use App\Models\Business\BusinessProfile;
use App\Models\CareerInterest;
use App\Models\Concerns\HasSocialProfile;
use App\Models\Debt;
use App\Models\IdentityFlag;
use App\Models\SessionExtended;
use App\Models\UserLoginAudit;
use App\Models\UserPrimaryPurpose;
use App\Models\UserSubscription;
use App\Models\Pathways\LifePathway;
use App\Models\OpportunityRadarEntry;
use App\Providers\RouteServiceProvider;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Relations\BelongsTo as EloquentBelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany as EloquentBelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany as EloquentHasMany;
use Illuminate\Database\Eloquent\Relations\HasOne as EloquentHasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;
use App\Models\SocialAccount;
use App\Models\LearningPathEnrolment;
use App\Models\RealEstateLearningPath;
use App\Models\PublicSectorEngagement;
use App\Models\WomenRealEstate\WomenAgentProfile;
use App\Models\WomenRealEstate\WomenPersonaProfile;
use App\Models\WomenRealEstate\WomenUserMedia;
use App\Models\WellbeingProfile;

/**
 * @property int $id
 * @property string $name
 * @property string $image
 * @property string $email
 * @property \Illuminate\Support\Carbon|null $email_verified_at
 * @property string $role
 * @property string $primary_role
 * @property array<array-key, mixed>|null $secondary_roles
 * @property string $account_final_classification
 * @property string|null $real_estate_entry_path
 * @property string|null $real_estate_financing_plan
 * @property \Illuminate\Support\Carbon|null $real_estate_onboarded_at
 * @property string $password
 * @property string|null $remember_token
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property string|null $onboarding_step
 * @property array<array-key, mixed>|null $persona_flags
 * @property string|null $bio
 * @property string|null $location
 * @property string|null $phone
 * @property array<array-key, mixed>|null $interests
 * @property array<array-key, mixed>|null $skills
 * @property array<array-key, mixed>|null $preferences
 * @property int $profile_completion_percentage
 * @property bool $profile_completed
 * @property bool $first_login
 * @property bool $wasRecentlyCreated
 * @property bool $onboarding_completed
 * @property \Illuminate\Support\Carbon|null $onboarding_completed_at
 * @property string|null $avatar_path
 * @property bool $is_verified
 * @property \Illuminate\Support\Carbon|null $verified_at
 * @property array<array-key, mixed>|null $user_intentions
 * @property int|null $active_profile_id
 * @property string|null $age_bracket
 * @property string|null $pronouns
 * @property string|null $preferred_name
 * @property string|null $timezone
 * @property-read \App\Models\Profile|null $activeProfile
 * @property-read \App\Models\AgentProfile|null $agentProfile
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Badge> $badges
 * @property int|null badges_count
 * @property-read BusinessProfile|null $businessProfile
 * @property-read \App\Models\Candidate|null $candidate
 * @property-read \App\Models\WomenRealEstate\WomenCohortProfile|null $womenCohortProfile
 * @property-read \App\Models\Candidate|null $candidateProfile
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CareerIntelligenceSnapshot> $careerIntelligenceSnapshots
 * @property int|null career_intelligence_snapshots_count
 * @property-read \App\Models\Company|null $company
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CreatorPayout> $creatorPayouts
 * @property int|null creator_payouts_count
 * @property-read string $avatar_url
 * @property-read string $formatted_pronouns
 * @property-read string $role_display_name
 * @property-read WomenPersonaProfile|null $househunterPersonaProfile
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\HousingListing> $housingListings
 * @property int|null housing_listings_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\IncidentEvent> $incidentEvents
 * @property int|null incident_events_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\IncidentReport> $incidentReportsAbout
 * @property int|null incident_reports_about_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\LeadNote> $leadNotes
 * @property int|null lead_notes_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ListingMortgageQuote> $listingMortgageQuotes
 * @property int|null listing_mortgage_quotes_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\ListingPartnershipIntention> $listingPartnershipIntentions
 * @property int|null listing_partnership_intentions_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, UserLoginAudit> $loginAudits
 * @property int|null login_audits_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\MentorshipSession> $mentorshipBookings
 * @property int|null mentorship_bookings_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\MentorshipProgram> $mentorshipPrograms
 * @property int|null mentorship_programs_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\MentorshipSession> $mentorshipSessions
 * @property int|null mentorship_sessions_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Notification> $notifications
 * @property int|null notifications_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\OnboardingEvent> $onboardingEvents
 * @property int|null onboarding_events_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\PartnershipMatch> $partnershipMatchesAsCounterparty
 * @property int|null partnership_matches_as_counterparty_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \Spatie\Permission\Models\Permission> $permissions
 * @property int|null permissions_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Profile> $profiles
 * @property int|null profiles_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Progress> $progress
 * @property int|null progress_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, PublicSectorEngagement> $publicSectorEngagements
 * @property int|null public_sector_engagements_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, LearningPathEnrolment> $realEstateLearningPathEnrolments
 * @property int|null real_estate_learning_path_enrolments_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, RealEstateLearningPath> $realEstateLearningPaths
 * @property int|null real_estate_learning_paths_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\IncidentReport> $reportedIncidents
 * @property int|null reported_incidents_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \Spatie\Permission\Models\Role> $roles
 * @property int|null roles_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, SocialAccount> $socialAccounts
 * @property int|null social_accounts_count
 * @property-read \App\Models\SocialProfile|null $socialProfile
 * @property-read \App\Models\TafeCareerProfile|null $tafeCareerProfile
 * @property-read \App\Models\TafeInstitution|null $tafeInstitution
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TafeStudentJourney> $tafeJourneys
 * @property int|null tafe_journeys_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \Laravel\Sanctum\PersonalAccessToken> $tokens
 * @property int|null tokens_count
 * @property-read \App\Models\UserPrimaryPurpose|null $primaryPurposeProfile
 * @property-read WomenAgentProfile|null $womenAgentProfile
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\WomenHousingListing> $womenHousingListings
 * @property int|null women_housing_listings_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, WomenPersonaProfile> $womenPersonaProfiles
 * @property int|null women_persona_profiles_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, WomenUserMedia> $womenRealEstateMedia
 * @property int|null women_real_estate_media_count
 * @method static \Database\Factories\UserFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User interestedIn(string $interest)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User permission($permissions, $without = false)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User role($roles, $guard = null, $without = false)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereAccountClassification($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereActiveProfileId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereAgeBracket($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereAvatarPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereBio($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereEmailVerifiedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereFirstLogin($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereImage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereInterests($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereIsVerified($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereOnboardingCompleted($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereOnboardingCompletedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereOnboardingStep($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User wherePassword($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User wherePersonaFlags($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User wherePhone($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User wherePreferences($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User wherePreferredName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User wherePrimaryRole($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereProfileCompleted($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereProfileCompletionPercentage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User wherePronouns($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereRealEstateEntryPath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereRealEstateFinancingPlan($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereRealEstateOnboardedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereRememberToken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereRole($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereSecondaryRoles($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereSkills($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereTimezone($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereUserIntentions($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereVerifiedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User withPlatformRole(string $role)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User withoutPermission($permissions)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User withoutRole($roles, $guard = null)
 * @property string $participant_profile_type
 * @property \Illuminate\Support\Carbon|null $accepted_women_only_policy_at
 * @property-read \Illuminate\Database\Eloquent\Collection<int, BankAccount> $bankAccounts
 * @property int|null bank_accounts_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, BankTransaction> $bankTransactions
 * @property int|null bank_transactions_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Budget> $budgets
 * @property int|null budgets_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, BundleOffer> $bundleOffers
 * @property int|null bundle_offers_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, BusinessCashbook> $businessCashbooks
 * @property int|null business_cashbooks_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, CareerInterest> $careerInterests
 * @property int|null career_interests_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CivicOpportunitySignup> $civicOpportunitySignups
 * @property int|null civic_opportunity_signups_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Debt> $debts
 * @property int|null debts_count
 * @property-read BusinessCashbook|null $defaultBusinessCashbook
 * @property-read \Illuminate\Database\Eloquent\Collection<int, IdentityFlag> $identityFlags
 * @property int|null identity_flags_count
 * @property-read IdentityFlag|null $latestIdentityFlag
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\LegalDocument> $legalDocuments
 * @property int|null legal_documents_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, LifePathway> $lifePathways
 * @property int|null life_pathways_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\MFABackupCode> $mfaBackupCodes
 * @property int|null mfa_backup_codes_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\MFAMethod> $mfaMethods
 * @property int|null mfa_methods_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, OpportunityRadarEntry> $opportunityRadarEntries
 * @property int|null opportunity_radar_entries_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Receipt> $receipts
 * @property int|null receipts_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\Referral> $referrals
 * @property int|null referrals_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, SessionExtended> $sessionExtended
 * @property int|null session_extended_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, UserSubscription> $subscriptions
 * @property int|null subscriptions_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\TaxAsset> $taxAssets
 * @property int|null tax_assets_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\VehicleLogbook> $vehicleLogbooks
 * @property int|null vehicle_logbooks_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\SocialPostProgress> $watchProgress
 * @property int|null watch_progress_count
 * @property-read WellbeingProfile|null $wellbeingProfile
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereAcceptedWomenOnlyPolicyAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|User whereParticipantProfileType($value)
 * @mixin \Eloquent
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles, HasSocialProfile;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'preferred_name',
        'pronouns',
        'primary_role',
        'secondary_roles',
        'bio',
        'location',
        'phone',
        'interests',
        'skills',
        'preferences',
        'profile_completion_percentage',
        'profile_completed',
        'first_login',
        'onboarding_completed',
        'onboarding_completed_at',
        'avatar_path',
        'notify_job_matches_email',
        'notify_job_matches_in_app',
        'is_verified',
        'verified_at',
        'timezone',
        'onboarding_step',
        'persona_flags',
        'user_intentions',
        'account_classification',
        'real_estate_entry_path',
        'real_estate_financing_plan',
        'real_estate_onboarded_at',
        'participant_profile_type',
        'accepted_women_only_policy_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'persona_flags' => 'array',
        'user_intentions' => 'array',
        'secondary_roles' => 'array',
        'interests' => 'array',
        'skills' => 'array',
        'preferences' => 'array',
        'first_login' => 'boolean',
        'profile_completed' => 'boolean',
        'onboarding_completed' => 'boolean',
        'onboarding_completed_at' => 'datetime',
        'is_verified' => 'boolean',
        'verified_at' => 'datetime',
        'real_estate_onboarded_at' => 'datetime',
        'accepted_women_only_policy_at' => 'datetime',
        'notify_job_matches_email' => 'boolean',
        'notify_job_matches_in_app' => 'boolean',
    ];

    /**
     *
     * Determine the default dashboard route based on classification/role.
     */
    public function preferredDashboardRoute(): string
    {
        if ($this->account_classification === 'tafe_university') {
            return RouteServiceProvider::TAFE_UNIVERSITY_DASHBOARD;
        }

        if ($this->account_classification === 'real_estate') {
            return RouteServiceProvider::REAL_ESTATE_DASHBOARD;
        }

        if ($this->account_classification === 'business_network') {
            return RouteServiceProvider::BUSINESS_DASHBOARD;
        }

        if ($this->account_classification === 'public_sector') {
            return RouteServiceProvider::PUBLIC_SECTOR_DASHBOARD;
        }

        if ($this->role === 'company') {
            return RouteServiceProvider::COMPANY_DASHBOARD;
        }

        if ($this->role === 'candidate' || $this->role === 'member' || $this->account_classification === 'candidate') {
            return RouteServiceProvider::MEMBER_DASHBOARD;
        }

        return RouteServiceProvider::HOME;
    }

    public function assignPersona(string $persona): void
    {
        $personas = collect($this->persona_flags ?? [])
            ->push($persona)
            ->unique()
            ->values()
            ->all();

        $this->persona_flags = $personas;
    }

    public function hasPersona(string $persona): bool
    {
        return collect($this->persona_flags ?? [])->contains($persona);
    }

    public function candidateProfile(): EloquentHasOne
    {
        return $this->hasOne(Candidate::class, 'user_id', 'id');
    }

    // Alias for candidateProfile for consistency
    public function candidate(): EloquentHasOne
    {
        return $this->candidateProfile();
    }

    public function company(): EloquentHasOne
    {
        return $this->hasOne(Company::class);
    }

    public function businessProfile(): EloquentHasOne
    {
        return $this->hasOne(BusinessProfile::class);
    }

    public function primaryPurposeProfile(): EloquentHasOne
    {
        return $this->hasOne(UserPrimaryPurpose::class);
    }

    public function hasCompletedPrimaryPurpose(): bool
    {
        return (bool) optional($this->primaryPurposeProfile)->completed_at;
    }

    public function legalDocuments(): EloquentHasMany
    {
        return $this->hasMany(LegalDocument::class);
    }

    public function progress(): EloquentHasMany
    {
        return $this->hasMany(Progress::class);
    }

    public function loginAudits(): EloquentHasMany
    {
        return $this->hasMany(UserLoginAudit::class);
    }

    public function sessionExtended(): EloquentHasMany
    {
        return $this->hasMany(SessionExtended::class);
    }

    public function identityFlags(): EloquentHasMany
    {
        return $this->hasMany(IdentityFlag::class);
    }

    public function latestIdentityFlag(): EloquentHasOne
    {
        return $this->hasOne(IdentityFlag::class)->latestOfMany();
    }

    public function badges(): EloquentHasMany
    {
        return $this->hasMany(Badge::class);
    }

    public function notifications(): EloquentHasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function leadNotes(): EloquentHasMany
    {
        return $this->hasMany(LeadNote::class, 'user_id');
    }

    public function subscriptions(): EloquentHasMany
    {
        return $this->hasMany(UserSubscription::class);
    }

    public function bundleOffers(): EloquentHasMany
    {
        return $this->hasMany(BundleOffer::class);
    }

    public function budgets(): EloquentHasMany
    {
        return $this->hasMany(Budget::class);
    }

    public function debts(): EloquentHasMany
    {
        return $this->hasMany(Debt::class);
    }

    public function bankAccounts(): EloquentHasMany
    {
        return $this->hasMany(BankAccount::class);
    }

    public function bankTransactions(): EloquentHasMany
    {
        return $this->hasMany(BankTransaction::class);
    }

    public function housingListings(): EloquentHasMany
    {
        return $this->hasMany(HousingListing::class, 'landlord_user_id');
    }

    public function agentProfile(): EloquentHasOne
    {
        return $this->hasOne(AgentProfile::class);
    }

    public function wellbeingProfile(): EloquentHasOne
    {
        return $this->hasOne(WellbeingProfile::class);
    }

    public function mentorshipPrograms(): EloquentHasMany
    {
        return $this->hasMany(MentorshipProgram::class, 'mentor_user_id');
    }

    public function mentorshipSessions(): EloquentHasMany
    {
        return $this->hasMany(MentorshipSession::class, 'mentor_user_id');
    }

    public function mentorshipBookings(): EloquentHasMany
    {
        return $this->hasMany(MentorshipSession::class, 'mentee_user_id');
    }

    public function careerIntelligenceSnapshots(): EloquentHasMany
    {
        return $this->hasMany(CareerIntelligenceSnapshot::class);
    }

    public function careerInterests(): EloquentHasMany
    {
        return $this->hasMany(CareerInterest::class);
    }

    public function lifePathways(): EloquentHasMany
    {
        return $this->hasMany(LifePathway::class);
    }

    public function opportunityRadarEntries(): EloquentHasMany
    {
        return $this->hasMany(OpportunityRadarEntry::class);
    }

    public function creatorPayouts(): EloquentHasMany
    {
        return $this->hasMany(CreatorPayout::class);
    }

    public function businessCashbooks(): EloquentHasMany
    {
        return $this->hasMany(BusinessCashbook::class);
    }

    public function defaultBusinessCashbook(): EloquentHasOne
    {
        return $this->hasOne(BusinessCashbook::class)
            ->where('is_default', true);
    }

    public function reportedIncidents(): EloquentHasMany
    {
        return $this->hasMany(IncidentReport::class, 'reporter_user_id');
    }

    public function incidentReportsAbout(): EloquentHasMany
    {
        return $this->hasMany(IncidentReport::class, 'subject_user_id');
    }

    public function incidentEvents(): EloquentHasMany
    {
        return $this->hasMany(IncidentEvent::class, 'author_user_id');
    }

    public function onboardingEvents(): EloquentHasMany
    {
        return $this->hasMany(OnboardingEvent::class);
    }

    public function socialAccounts(): EloquentHasMany
    {
        return $this->hasMany(SocialAccount::class);
    }

    public function womenHousingListings(): EloquentHasMany
    {
        return $this->hasMany(WomenHousingListing::class, 'owner_user_id');
    }

    public function womenPersonaProfiles(): EloquentHasMany
    {
        return $this->hasMany(WomenPersonaProfile::class);
    }

    public function househunterPersonaProfile(): EloquentHasOne
    {
        return $this->hasOne(WomenPersonaProfile::class)
            ->where('persona', WomenPersonaProfile::PERSONA_HOUSEHUNTER);
    }

    public function personaProfileFor(string $persona): ?WomenPersonaProfile
    {
        return $this->womenPersonaProfiles()
            ->where('persona', $persona)
            ->first();
    }

    public function womenAgentProfile(): EloquentHasOne
    {
        return $this->hasOne(WomenAgentProfile::class);
    }

    public function listingMortgageQuotes(): EloquentHasMany
    {
        return $this->hasMany(ListingMortgageQuote::class);
    }

    public function listingPartnershipIntentions(): EloquentHasMany
    {
        return $this->hasMany(ListingPartnershipIntention::class, 'initiator_user_id');
    }

    public function partnershipMatchesAsCounterparty(): EloquentHasMany
    {
        return $this->hasMany(PartnershipMatch::class, 'counterparty_user_id');
    }

    public function realEstateLearningPathEnrolments(): EloquentHasMany
    {
        return $this->hasMany(LearningPathEnrolment::class);
    }

    public function realEstateLearningPaths(): EloquentBelongsToMany
    {
        return $this->belongsToMany(RealEstateLearningPath::class, 'learning_path_enrolments')
            ->withPivot(['enrolment_status', 'progress_percent', 'notes', 'last_ai_check_in_at'])
            ->withTimestamps();
    }

    public function tafeInstitution(): EloquentHasOne
    {
        return $this->hasOne(TafeInstitution::class, 'owner_user_id');
    }

    public function tafeCareerProfile(): EloquentHasOne
    {
        return $this->hasOne(TafeCareerProfile::class);
    }

    public function profiles(): EloquentHasMany
    {
        return $this->hasMany(Profile::class);
    }

    public function activeProfile(): EloquentBelongsTo
    {
        return $this->belongsTo(Profile::class, 'active_profile_id');
    }

    public function switchActiveProfile(Profile $profile, ?string $context = null): void
    {
        if ($profile->user_id !== $this->id) {
            throw new AuthorizationException('Cannot switch to another user\'s profile.');
        }

        DB::transaction(function () use ($profile, $context) {
            $this->profiles()
                ->where('is_active', true)
                ->whereKeyNot($profile->getKey())
                ->update(['is_active' => false]);

            $profile->forceFill([
                'is_active' => true,
                'last_switched_at' => now(),
                'switch_context' => $context,
            ])->save();

            $this->forceFill(['active_profile_id' => $profile->getKey()])->save();
        });
    }

    public function tafeJourneys(): EloquentHasMany
    {
        return $this->hasMany(TafeStudentJourney::class);
    }

    public function civicOpportunitySignups(): EloquentHasMany
    {
        return $this->hasMany(CivicOpportunitySignup::class);
    }

    public function publicSectorEngagements(): EloquentHasMany
    {
        return $this->hasMany(PublicSectorEngagement::class);
    }

    public function womenRealEstateMedia(): EloquentHasMany
    {
        return $this->hasMany(WomenUserMedia::class);
    }

    /**
     * Check if the user matches a given platform role using primary and secondary roles.
     */
    public function hasPrimaryRole(string $role): bool
    {
        if ($this->primary_role === $role) {
            return true;
        }

        return in_array($role, $this->secondary_roles ?? [], true);
    }

    /**
     * Determine if the user has any role from the provided list.
     */
    public function hasAnyPlatformRole(array $roles): bool
    {
        foreach ($roles as $role) {
            if ($this->hasPrimaryRole($role)) {
                return true;
            }
        }

        return false;
    }

    /**
     *
     * Fetch all configured roles assigned to the user.
     *
     * @return (mixed|string)[]
     *
     * @psalm-return list<non-empty-mixed|non-falsy-string>
     */
    public function getAllPlatformRoles(): array
    {
        $roles = array_filter([
            $this->primary_role,
            ...($this->secondary_roles ?? []),
        ]);

        return array_values(array_unique($roles));
    }

    /**
     * Resolve the avatar URL, falling back to the role-default asset.
     */
    public function getAvatarUrlAttribute(): string
    {
        /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
        $disk = Storage::disk('public');

        if ($this->avatar_path && $disk->exists($this->avatar_path)) {
            return $disk->url($this->avatar_path);
        }

        if (! empty($this->image)) {
            return Str::startsWith($this->image, ['http://', 'https://'])
                ? $this->image
                : asset(ltrim($this->image, '/'));
        }

        return $this->defaultAvatarUrl();
    }

    protected function defaultAvatarUrl(): string
    {
        $avatars = [
            'member' => '/images/default-avatar.png',
            'candidate' => '/images/default-avatar.png',
            'company' => '/images/default-avatar.png',
            'mentor' => '/images/default-avatar.png',
            'public_sector' => '/images/default-avatar.png',
            'tafe_university' => '/images/default-avatar.png',
            'business_network' => '/images/default-avatar.png',
            'real_estate_agent' => '/images/default-avatar.png',
            'real_estate_seeker' => '/images/default-avatar.png',
            'trades_professional' => '/images/default-avatar.png',
            'health_wellness_provider' => '/images/default-avatar.png',
            'beauty_fashion_provider' => '/images/default-avatar.png',
            'financial_advisor' => '/images/default-avatar.png',
            'sole_trader' => '/images/default-avatar.png',
        ];

        $path = $avatars[$this->primary_role] ?? '/images/default-avatar.png';
        if (Str::startsWith($path, ['http://', 'https://'])) {
            return $path;
        }

        return asset(ltrim($path, '/'));
    }

    /**
     * Friendly display label for the user role.
     */
    public function getRoleDisplayNameAttribute(): string
    {
        $roleNames = [
            'member' => 'Member',
            'candidate' => 'Member',
            'company' => 'Company',
            'mentor' => 'Mentor',
            'public_sector' => 'Public Sector',
            'tafe_university' => 'TAFE / University',
            'business_network' => 'Business Network',
            'real_estate_agent' => 'Real Estate Agent',
            'real_estate_seeker' => 'Property Seeker',
            'trades_professional' => 'Trades Professional',
            'health_wellness_provider' => 'Health & Wellness Provider',
            'beauty_fashion_provider' => 'Beauty & Fashion Provider',
            'financial_advisor' => 'Financial Advisor',
            'sole_trader' => 'Sole Trader',
        ];

        return $roleNames[$this->primary_role] ?? ucfirst($this->primary_role ?? 'member');
    }

    /**
     * Determine if the user has expressed an interest area.
     */
    public function isInterestedIn(string $interest): bool
    {
        return in_array($interest, $this->interests ?? [], true);
    }

    /**
     *
     * Calculate profile completion percentage based on key fields.
     *
     * @psalm-return int<0, 100>
     */
    public function calculateProfileCompletion(): int
    {
        $fields = [
            'name' => 10,
            'email' => 10,
            'pronouns' => 5,
            'bio' => 15,
            'location' => 10,
            'phone' => 5,
            'avatar_path' => 10,
            'interests' => 15,
            'skills' => 15,
            'primary_role' => 5,
        ];

        $score = 0;

        foreach ($fields as $field => $weight) {
            $value = $this->{$field} ?? null;

            if (in_array($field, ['interests', 'skills'], true)) {
                if (is_array($value) && count($value) > 0) {
                    $score += $weight;
                }
            } elseif (! empty($value)) {
                $score += $weight;
            }
        }

        return min(100, $score);
    }

    /**
     * Update persisted profile completion metrics.
     */
    public function updateProfileCompletion(): void
    {
        $percentage = $this->calculateProfileCompletion();

        $this->forceFill([
            'profile_completion_percentage' => $percentage,
            'profile_completed' => $percentage === 100,
        ])->save();
    }

    /**
     * Present pronouns in a friendly format.
     */
    public function getFormattedPronounsAttribute(): string
    {
        return $this->pronouns ? '(' . $this->pronouns . ')' : '';
    }

    /**
     * Scope users that match a given role across primary/secondary roles.
     */
    public function scopeWithPlatformRole($query, string $role)
    {
        return $query->where('primary_role', $role)
            ->orWhereJsonContains('secondary_roles', $role);
    }

    /**
     * Scope users based on a stored interest.
     */
    public function scopeInterestedIn($query, string $interest)
    {
        return $query->whereJsonContains('interests', $interest);
    }

    /**
     * Proxy an authenticated HTTP request to the internal application API.
     */
    public function apiRequest(string $method, string $uri, array $payload = []): array
    {
        $method = strtoupper($method);
        $baseUrl = rtrim(config('app.url'), '/');
        $url = Str::startsWith($uri, ['http://', 'https://'])
            ? $uri
            : $baseUrl . '/' . ltrim($uri, '/');

        $token = $this->createToken('api-proxy', ['*']);

        try {
            $client = Http::withToken($token->plainTextToken)
                ->acceptJson()
                ->asJson()
                ->timeout(15)
                ->withHeaders(['X-Requested-With' => 'XMLHttpRequest']);

            switch ($method) {
                case 'GET':
                    $response = $client->get($url, $payload);
                    break;
                case 'DELETE':
                    $response = $client->delete($url, $payload);
                    break;
                case 'PUT':
                    $response = $client->put($url, $payload);
                    break;
                case 'PATCH':
                    $response = $client->patch($url, $payload);
                    break;
                default:
                    $response = $client->post($url, $payload);
            }
        } finally {
            optional($token->accessToken)->delete();
        }

        if ($response->failed()) {
            $message = $response->json('message') ?? 'API request failed.';
            throw new RuntimeException($message, $response->status());
        }

        return $response->json() ?? [];
    }

    public function mfaMethods(): EloquentHasMany
    {
        return $this->hasMany(MFAMethod::class);
    }

    public function mfaBackupCodes(): EloquentHasMany
    {
        return $this->hasMany(MFABackupCode::class);
    }

    public function referrals(): EloquentHasMany
    {
        return $this->hasMany(Referral::class, 'referrer_id');
    }

    public function taxAssets(): EloquentHasMany
    {
        return $this->hasMany(TaxAsset::class);
    }

    public function receipts(): EloquentHasMany
    {
        return $this->hasMany(Receipt::class);
    }

    public function vehicleLogbooks(): EloquentHasMany
    {
        return $this->hasMany(VehicleLogbook::class);
    }

    public function watchProgress(): EloquentHasMany
    {
        return $this->hasMany(SocialPostProgress::class);
    }
}

