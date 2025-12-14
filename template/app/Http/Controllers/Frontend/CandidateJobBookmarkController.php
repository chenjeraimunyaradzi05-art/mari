<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\JobBookmark;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

final class CandidateJobBookmarkController extends Controller
{
    function index(): \Illuminate\Contracts\View\View|\Illuminate\Http\RedirectResponse {
        $candidate = Auth::user()->candidateProfile;

        if (!$candidate) {
            return redirect()->route('member.profile.index')
                ->with('error', 'Please complete your profile first to view bookmarks');
        }

        $bookmarks = JobBookmark::where('candidate_id', $candidate->id)->paginate();
        return view('frontend.candidate-dashboard.bookmarks.index', compact('bookmarks'));
    }

    function save(string $id): \Illuminate\Http\Response {
        if(!Auth::check()) {
            throw ValidationException::withMessages(['Please login first for bookmark']);
        }
        if (Auth::check() && ! in_array(Auth::user()->role, ['candidate', 'member'], true)) {
            throw ValidationException::withMessages(['only candidates will be able to add book marks']);
        }

        $candidate = Auth::user()->candidateProfile;

        if (!$candidate) {
            throw ValidationException::withMessages(['Please complete your profile first']);
        }

        $alreadyMarked = JobBookmark::where(['job_id' => $id, 'candidate_id' => $candidate->id])->exists();
        if($alreadyMarked) {
            throw ValidationException::withMessages(['Post is already bookmarked!']);
        }
        $bookmark = new JobBookmark();
        $bookmark->job_id = $id;
        $bookmark->candidate_id = $candidate->id;
        $bookmark->save();

        return response(['message' => 'bookmarked added successfully!', 'id' => $id]);

    }
}

