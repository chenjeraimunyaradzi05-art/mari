<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $user_id
 * @property string|null $resume_path
 * @property string|null $marital_status
 * @property string|null $children_details
 * @property string|null $religion
 * @property string|null $location
 * @property \Illuminate\Support\Carbon|null $date_of_birth
 * @property string|null $phone_number
 * @property string|null $education_level
 * @property string|null $qualifications
 * @property string|null $dream_job
 * @property string|null $dream_qualification
 * @property string|null $dream_company
 * @property string|null $life_inspiration
 * @property string|null $life_goals
 * @property string|null $favorite_music
 * @property string|null $hobbies
 * @property string|null $sporting_teams
 * @property string|null $outdoor_leisure
 * @property array<array-key, mixed>|null $schools_attended
 * @property array<array-key, mixed>|null $previous_experiences
 * @property array<array-key, mixed>|null $privacy_settings
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property array<array-key, mixed>|null $public_sector_interests
 * @property string|null $government_clearance
 * @property array<array-key, mixed>|null $preferred_agencies
 * @property string|null $civic_impact_goals
 * @property-read \Illuminate\Database\Eloquent\Collection<int, \App\Models\MemberMedia> $media
 * @property int|null media_count
 * @property-read \App\Models\User $user
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereChildrenDetails($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereCivicImpactGoals($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereDateOfBirth($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereDreamCompany($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereDreamJob($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereDreamQualification($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereEducationLevel($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereFavoriteMusic($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereGovernmentClearance($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereHobbies($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereLifeGoals($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereLifeInspiration($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereLocation($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereMaritalStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereOutdoorLeisure($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile wherePhoneNumber($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile wherePreferredAgencies($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile wherePreviousExperiences($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile wherePrivacySettings($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile wherePublicSectorInterests($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereQualifications($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereReligion($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereResumePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereSchoolsAttended($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereSportingTeams($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereUpdatedAt($final value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|MemberProfile whereUserId($value)
 *
 * @mixin \Eloquent
 */
final class MemberProfile extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'date_of_birth' => 'date',
        'schools_attended' => 'array',
        'previous_experiences' => 'array',
        'privacy_settings' => 'array',
        'public_sector_interests' => 'array',
        'preferred_agencies' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function media()
    {
        return $this->hasMany(MemberMedia::class);
    }
}
