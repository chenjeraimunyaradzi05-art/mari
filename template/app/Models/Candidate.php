<?php

namespace App\Models;

use App\Models\Concerns\HasSocialProfile;
use Cviebrock\EloquentSluggable\Sluggable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int|null $job_category_id
 * @property string|null $website
 * @property int $id
 * @property int $user_id
 * @property int|null $experience_id
 * @property int|null $profession_id
 * @property string|null $title
 * @property string|null $image
 * @property string|null $full_name
 * @property string|null $slug
 * @property string|null $phone_one
 * @property string|null $phone_two
 * @property string|null $email
 * @property string|null $cv
 * @property string|null $bio
 * @property string|null $marital_status
 * @property string|null $birth_date
 * @property int|null $pronoun_id
 * @property string|null $mobile
 * @property int|null $ethnicity_id
 * @property int|null $driver_license_type_id
 * @property int|null $number_of_kids
 * @property int|null $marital_status_id
 * @property string|null $dream_job
 * @property int|null $religion_id
 * @property int $willing_fifo Fly-In Fly-Out work
 * @property int $willing_relocate
 * @property string|null $willing_government_service ABF, Police, Navy, Army, Mining, Oil Rigs
 * @property string|null $profile_video_url Professional introduction video - max 15 min
 * @property string|null $profile_video_analysis AI analysis of professional video
 * @property string|null $personality_video_url Personality showcase video - max 15 min
 * @property string|null $personality_video_analysis AI analysis: hobbies, music, shows, food, personality traits
 * @property string|null $profile_video_uploaded_at
 * @property string|null $personality_video_uploaded_at
 * @property string|null $address
 * @property int|null $city
 * @property int|null $state
 * @property int|null $country
 * @property string|null $status
 * @property int $profile_complete
 * @property int $visibility
 * @property string|null $provider
 * @property string|null $provider_id
 * @property string|null $provider_token
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property string|null $professional_profile_url
 * @property string|null $github_url
 * @property string|null $portfolio_url
 * @property string|null $twitter_url
 * @property string|null $facebook_url
 * @property string|null $instagram_url
 * @property-read \App\Models\City|null $candidateCity
 * @property-read \App\Models\Country|null $candidateCountry
 * @property-read \App\Models\State|null $candidateState
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CandidateCV> $cvs
 * @property int|null cvs_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CandidateEducation> $educations
 * @property int|null educations_count
 * @property-read \App\Models\Experience|null $experience
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CandidateExperience> $experiences
 * @property int|null experiences_count
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CandidateLanguage> $languages
 * @property int|null languages_count
 * @property-read \App\Models\Profession|null $profession
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\CandidateSkill> $skills
 * @property int|null skills_count
 * @property-read \App\Models\SocialProfile|null $socialProfile
 * @property-read \App\Models\User $user
 *
 * @method static \Database\Factories\CandidateFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate findSimilarSlugs(string $attribute, array $config, string $slug)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereAddress($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereBio($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereBirthDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereCity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereCountry($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereCv($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereDreamJob($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereDriverLicenseTypeId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereEthnicityId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereExperienceId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereFacebookUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereFullName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereGithubUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereImage($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereInstagramUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereProfessionalProfileUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereMaritalStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereMaritalStatusId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereMobile($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereNumberOfKids($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate wherePersonalityVideoAnalysis($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate wherePersonalityVideoUploadedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate wherePersonalityVideoUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate wherePhoneOne($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate wherePhoneTwo($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate wherePortfolioUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereProfessionId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereProfileComplete($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereProfileVideoAnalysis($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereProfileVideoUploadedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereProfileVideoUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate wherePronounId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereProvider($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereProviderId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereProviderToken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereReligionId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereState($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereTwitterUrl($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereVisibility($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereWebsite($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereWillingFifo($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereWillingGovernmentService($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate whereWillingRelocate($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Candidate withUniqueSlugConstraints(\Illuminate\Database\Eloquent\Model $model, string $attribute, array $config, string $slug)
 *
 * @mixin \Eloquent
 */
final class Candidate extends Model
{
    use HasFactory, HasSocialProfile, Sluggable;

    protected $fillable = ['user_id', 'cv', 'full_name', 'image',
        'title', 'experience_id', 'website', 'birth_date', 'gender',
        'marital_status', 'profession_id', 'status', 'bio', 'country', 'state', 'city', 'address', 'phone_one',
        'phone_two', 'email', 'job_category_id',
    ];

    /**
     * @return string[][]
     *
     * @psalm-return array{slug: array{source: 'full_name'}}
     */
    #[\Override]
    public function sluggable(): array
    {
        return [
            'slug' => [
                'source' => 'full_name',
            ],
        ];
    }

    public function skills(): HasMany
    {
        return $this->hasMany(CandidateSkill::class, 'candidate_id', 'id');
    }

    public function languages(): HasMany
    {
        return $this->hasMany(CandidateLanguage::class, 'candidate_id', 'id');
    }

    public function experience(): BelongsTo
    {
        return $this->belongsTo(Experience::class, 'experience_id', 'id');
    }

    public function experiences(): HasMany
    {
        return $this->hasMany(CandidateExperience::class, 'candidate_id', 'id')->orderBy('id', 'Desc');
    }

    public function educations(): HasMany
    {
        return $this->hasMany(CandidateEducation::class, 'candidate_id', 'id')->orderBy('id', 'Desc');
    }

    public function profession(): BelongsTo
    {
        return $this->belongsTo(Profession::class, 'profession_id', 'id');
    }

    public function candidateCountry(): BelongsTo
    {
        return $this->belongsTo(Country::class, 'country', 'id');
    }

    public function candidateState(): BelongsTo
    {
        return $this->belongsTo(State::class, 'state', 'id');
    }

    public function candidateCity(): BelongsTo
    {
        return $this->belongsTo(City::class, 'city', 'id');
    }

    public function cvs(): HasMany
    {
        return $this->hasMany(CandidateCV::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
