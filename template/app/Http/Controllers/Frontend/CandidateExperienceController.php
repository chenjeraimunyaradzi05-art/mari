<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Requests\Frontend\CandidateExperienceStoreRequest;
use App\Models\CandidateExperience;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Psr\Http\Message\ResponseInterface;

final class CandidateExperienceController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return Response|string
     */
    public function index(): string|Response
    {
        $candidate = Auth::user()->candidateProfile;

        if (!$candidate) {
            return response(['message' => 'Please complete your profile first'], 403);
        }

        $candidateExperiences = CandidateExperience::where('candidate_id', $candidate->id)->orderBy('id', 'DESC')->get();
        return view('frontend.candidate-dashboard.profile.ajax-experience-table', compact('candidateExperiences'))->render();
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(): void
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(CandidateExperienceStoreRequest $request) : Response
    {
        $candidate = Auth::user()->candidateProfile;

        if (!$candidate) {
            return response(['message' => 'Please complete your profile first'], 403);
        }

        $experience = new CandidateExperience();
        $experience->candidate_id = $candidate->id;
        $experience->company = $request->company;
        $experience->department = $request->department;
        $experience->designation = $request->designation;
        $experience->start = $request->start;
        $experience->end = $request->end;
        $experience->currently_working = $request->filled('currently_working') ? 1 : 0;
        $experience->responsibilities = $request->responsibilities;
        $experience->save();

        return response(['message' => 'Created Successfully'], 200);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): void
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @return Response|\Illuminate\Contracts\Routing\ResponseFactory
     */
    public function edit(string $id) : \Illuminate\Contracts\Routing\ResponseFactory|Response
    {
        $experience = CandidateExperience::findOrFail($id);

        return response($experience);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(CandidateExperienceStoreRequest $request, string $id): Response
    {
        $candidate = Auth::user()->candidateProfile;

        if (!$candidate) {
            return response(['message' => 'Please complete your profile first'], 403);
        }

        $experience = CandidateExperience::findOrFail($id);

        if($candidate->id !== $experience->candidate_id) {
            abort(404);
        }

        $experience->company = $request->company;
        $experience->department = $request->department;
        $experience->designation = $request->designation;
        $experience->start = $request->start;
        $experience->end = $request->end;
        $experience->currently_working = $request->filled('currently_working') ? 1 : 0;
        $experience->responsibilities = $request->responsibilities;
        $experience->save();

        return response(['message' => 'Updated Successfully'], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): Response
    {
        try {
            $candidate = Auth::user()->candidateProfile;

            if (!$candidate) {
                return response(['message' => 'Please complete your profile first'], 403);
            }

            $experience = CandidateExperience::findOrFail($id);
            if($candidate->id !== $experience->candidate_id) {
                abort(404);
            }
            $experience->delete();
            return response(['message' => 'Deleted Successfully!'], 200);

        }catch(\Exception $e) {
            logger($e);
            return response(['message' => 'Something Went Wrong Please Try Again!'], 500);
        }
    }
}

