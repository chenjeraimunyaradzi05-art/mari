<?php

namespace App\Http\Controllers\Member;

use App\Http\Controllers\Controller;
use App\Models\MemberProfile;
use App\Models\MemberMedia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

final class MemberProfileController extends Controller
{
    public function index(Request $request): \Illuminate\Contracts\View\View
    {
        $user = $request->user();
        $profile = MemberProfile::firstOrCreate(['user_id' => $user->id]);
        $media = $profile->media()->latest()->get();

        return view('member.dashboard', compact('user', 'profile', 'media'));
    }

    public function edit(Request $request): \Illuminate\Contracts\View\View
    {
        $user = $request->user();
        $profile = MemberProfile::firstOrCreate(['user_id' => $user->id]);
        $agencies = \App\Models\PublicSectorAgency::active()->orderBy('name')->get();

        return view('member.profile.edit', compact('user', 'profile', 'agencies'));
    }

    public function update(Request $request): \Illuminate\Http\RedirectResponse
    {
        $user = $request->user();
        $profile = MemberProfile::firstOrCreate(['user_id' => $user->id]);

        $data = $request->validate([
            'marital_status' => 'nullable|string',
            'children_details' => 'nullable|string',
            'religion' => 'nullable|string',
            'location' => 'nullable|string',
            'date_of_birth' => 'nullable|date',
            'phone_number' => 'nullable|string',
            'education_level' => 'nullable|string',
            'qualifications' => 'nullable|string',
            'dream_job' => 'nullable|string',
            'dream_qualification' => 'nullable|string',
            'dream_company' => 'nullable|string',
            'life_inspiration' => 'nullable|string',
            'life_goals' => 'nullable|string',
            'favorite_music' => 'nullable|string',
            'hobbies' => 'nullable|string',
            'sporting_teams' => 'nullable|string',
            'outdoor_leisure' => 'nullable|string',
            'schools_attended' => 'nullable|array',
            'previous_experiences' => 'nullable|array',
            'privacy_settings' => 'nullable|array',
            'resume' => 'nullable|file|mimes:pdf,doc,docx|max:10240',
            // Public Sector Fields
            'public_sector_interests' => 'nullable|array',
            'government_clearance' => 'nullable|string',
            'preferred_agencies' => 'nullable|array',
            'civic_impact_goals' => 'nullable|string',
            'avatar' => 'nullable|image|max:10240',
        ]);

        if ($request->hasFile('avatar')) {
            $path = $request->file('avatar')->store('avatars', 'public');
            $user->avatar_path = $path;
            $user->save();
        }

        if ($request->hasFile('resume')) {
            $path = $request->file('resume')->store('resumes', 'public');
            $profile->resume_path = $path;
        }

        // Remove resume from data to avoid overwriting with file object
        unset($data['resume']);
        unset($data['avatar']);

        $profile->update($data);

        return redirect()->route('member.personal.dashboard')->with('success', 'Profile updated successfully.');
    }

    public function uploadMedia(Request $request): \Illuminate\Http\RedirectResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:jpeg,png,jpg,gif,mp4,mov,avi|max:51200', // 50MB max
            'caption' => 'nullable|string',
            'privacy_level' => 'required|in:public,private,friends,recruiters',
        ]);

        $user = $request->user();
        $profile = MemberProfile::firstOrCreate(['user_id' => $user->id]);

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $path = $file->store('member_media', 'public');
            $type = str_starts_with($file->getMimeType(), 'video') ? 'video' : 'photo';

            // Moderation checks: caption + filename/mime heuristics
            $moderator = app(\App\Services\ContentModerationService::class);
            $caption = (string) $request->input('caption', '');
            $textViolations = $moderator->scanText($caption);
            $fileViolations = $moderator->scanFile(['filename' => $file->getClientOriginalName(), 'mime' => $file->getMimeType()]);

            $violations = array_merge($textViolations, $fileViolations);

            $privacyLevel = $request->input('privacy_level', 'private');

            // Under 18 users must not publish public content
            $isUnder18 = false;
            if ($profile && $profile->date_of_birth) {
                try {
                    $dob = \Carbon\Carbon::parse($profile->date_of_birth);
                    $isUnder18 = $dob->age < 18;
                } catch (\Throwable $e) {
                    $isUnder18 = false;
                }
            }

            // If any violation and user attempted to make media public, block and return error
            if (!empty($violations)) {
                // If user is under 18 and any pornographic violation detected -> reject
                if ($isUnder18 && collect($violations)->pluck('type')->contains('pornographic')) {
                    // record metrics
                    app(\App\Services\RealTimeAnalyticsEngine::class)->record('moderation.media.block.under18', [
                        'properties' => [
                            'user_id' => $user->id,
                            'filename' => $file->getClientOriginalName(),
                        ],
                    ]);

                    return back()->withErrors(['file' => 'This media contains sexual content and cannot be uploaded by under-18 accounts.']);
                }

                // Do not allow these categories to be public
                $disallowed = collect($violations)->pluck('type')->intersect(['pornographic','sexist','homophobic','racist','abusive']);
                if ($disallowed->isNotEmpty() && $privacyLevel === 'public') {
                    app(\App\Services\RealTimeAnalyticsEngine::class)->record('moderation.media.public_blocked', [
                        'properties' => [
                            'user_id' => $user->id,
                            'filename' => $file->getClientOriginalName(),
                            'reasons' => $disallowed->values()->all(),
                        ],
                    ]);

                    return back()->withErrors(['file' => 'Your upload contains disallowed content and cannot be made public. Please remove offending content.']);
                }
            }

            $profile->media()->create([
                'file_path' => $path,
                'media_type' => $type,
                'caption' => $caption,
                'privacy_level' => $privacyLevel,
                'is_flagged' => !empty($violations),
                'flag_reasons' => !empty($violations) ? json_encode(array_column($violations, 'type')) : null,
                'moderation_status' => !empty($violations) ? 'pending' : 'approved',
            ]);
        }

        return back()->with('success', 'Media uploaded successfully.');
    }
}

