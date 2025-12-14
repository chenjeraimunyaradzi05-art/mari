<?php

namespace App\Http\Controllers\Api\V1\Community;

use App\Http\Controllers\Controller;
use App\Models\CommunityGroup;
use App\Models\MentorshipCohort;
use App\Models\MentorshipCohortMember;
use App\Models\SocialProfile;
use App\Services\CommunityMembershipService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class MentorshipCohortController extends Controller
{
    public function __construct(private readonly CommunityMembershipService $membershipService)
    {
    }

    public function store(Request $request, CommunityGroup $community): JsonResponse
    {
        $this->authorizeManagement($community, $request->user());

        $data = $request->validate([
            'community_chapter_id' => ['nullable', 'exists:community_chapters,id'],
            'mentorship_program_id' => ['nullable', 'exists:mentorship_programs,id'],
            'mentor_profile_id' => ['nullable', 'exists:social_profiles,id'],
            'name' => ['required', 'string', 'max:160'],
            'slug' => ['nullable', 'string', 'max:180'],
            'cohort_code' => ['nullable', 'string', 'max:60'],
            'focus_area' => ['nullable', 'string', 'max:160'],
            'capacity' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'meeting_cadence' => ['nullable', 'string', 'max:120'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'matching_rules' => ['nullable', 'array'],
        ]);

        $cohort = MentorshipCohort::create([
            'community_group_id' => $community->getKey(),
            'community_chapter_id' => $data['community_chapter_id'] ?? null,
            'mentorship_program_id' => $data['mentorship_program_id'] ?? null,
            'mentor_profile_id' => $data['mentor_profile_id'] ?? null,
            'name' => $data['name'],
            'slug' => $data['slug'] ?? Str::slug($data['name']).'-'.Str::random(4),
            'cohort_code' => $data['cohort_code'] ?? null,
            'focus_area' => $data['focus_area'] ?? null,
            'capacity' => $data['capacity'] ?? null,
            'starts_at' => $data['starts_at'] ?? null,
            'ends_at' => $data['ends_at'] ?? null,
            'meeting_cadence' => $data['meeting_cadence'] ?? null,
            'timezone' => $data['timezone'] ?? config('app.timezone'),
            'matching_rules' => $data['matching_rules'] ?? [],
            'status' => 'enrolling',
        ]);

        return response()->json([
            'ok' => true,
            'cohort' => $cohort,
        ], 201);
    }

    public function addMember(Request $request, MentorshipCohort $cohort): JsonResponse
    {
        $this->authorizeManagement($cohort->group, $request->user());

        $data = $request->validate([
            'social_profile_id' => ['required', 'exists:social_profiles,id'],
            'role' => ['nullable', 'in:mentor,mentee,facilitator'],
            'status' => ['nullable', 'in:invited,waitlisted,active,completed,dropped'],
        ]);

        $profile = SocialProfile::findOrFail($data['social_profile_id']);

        $membership = $this->membershipService->addMember($cohort->group, $profile, [
            'community_chapter_id' => $cohort->community_chapter_id,
            'status' => 'active',
            'approved_at' => now(),
        ]);

        $cohortMember = MentorshipCohortMember::updateOrCreate(
            [
                'mentorship_cohort_id' => $cohort->getKey(),
                'social_profile_id' => $profile->getKey(),
            ],
            [
                'community_membership_id' => $membership->getKey(),
                'role' => $data['role'] ?? 'mentee',
                'status' => $data['status'] ?? 'invited',
                'joined_at' => now(),
            ]
        );

        return response()->json([
            'ok' => true,
            'member' => $cohortMember,
        ], 201);
    }

    protected function authorizeManagement(CommunityGroup $community, $user): void
    {
        if (! $community->canBeManagedBy($user)) {
            abort(403, 'Not authorized to manage this community.');
        }
    }
}

