<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Requests\Frontend\CandidateEducationStoreRequest;
use App\Models\CandidateEducation;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

final class CandidateEductionController extends Controller
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

        $candidateEducations = CandidateEducation::where('candidate_id', $candidate->id)->orderBy('id', 'DESC')->get();
        return view('frontend.candidate-dashboard.profile.ajax-education-table', compact('candidateEducations'))->render();
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
    public function store(CandidateEducationStoreRequest $request): Response
    {
        $candidate = Auth::user()->candidateProfile;

        if (!$candidate) {
            return response(['message' => 'Please complete your profile first'], 403);
        }

        $education = new CandidateEducation();
        $education->candidate_id = $candidate->id;
        $education->level = $request->level;
        $education->degree = $request->degree;
        $education->year = $request->year;
        $education->note = $request->note;
        $education->save();

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
        $education = CandidateEducation::findOrFail($id);

        return response($education);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(CandidateEducationStoreRequest $request, string $id): Response
    {
        $candidate = Auth::user()->candidateProfile;

        if (!$candidate) {
            return response(['message' => 'Please complete your profile first'], 403);
        }

        $education = CandidateEducation::findOrFail($id);
        if($candidate->id !== $education->candidate_id) {
            abort(404);
        }
        $education->level = $request->level;
        $education->degree = $request->degree;
        $education->year = $request->year;
        $education->note = $request->note;
        $education->save();

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

            $education = CandidateEducation::findOrFail($id);
            if($candidate->id !== $education->candidate_id) {
                abort(404);
            }
            $education->delete();
            return response(['message' => 'Deleted Successfully!'], 200);

        }catch(\Exception $e) {
            logger($e);
            return response(['message' => 'Something Went Wrong Please Try Again!'], 500);
        }
    }
}

