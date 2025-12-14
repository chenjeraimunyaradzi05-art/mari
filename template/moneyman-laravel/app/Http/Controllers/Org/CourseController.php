<?php

namespace App\Http\Controllers\Org;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Models\Course;

class CourseController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'provider_org_page_id' => ['required','integer','exists:organization_pages,id'],
            'code' => ['nullable','string','max:120'],
            'title' => ['required','string','max:255'],
            'type' => ['required', Rule::in(['bachelor','masters','micro','tafe_cert','tafe_diploma','short','apprenticeship'])],
            'mode' => ['required', Rule::in(['on_campus','online','hybrid'])],
            'location' => ['nullable','string','max:255'],
            'duration_weeks' => ['nullable','integer','min:1'],
            'cost_cents' => ['nullable','integer','min:0'],
            'funding' => ['array'],
            'prerequisites' => ['array'],
            'outcomes' => ['array'],
            'tags' => ['array'],
        ]);
        $course = Course::create($data);
        return response()->json($course, 201);
    }

    public function update(int $id, Request $request)
    {
        $course = Course::findOrFail($id);
        $data = $request->validate([
            'code' => ['nullable','string','max:120'],
            'title' => ['sometimes','string','max:255'],
            'type' => ['sometimes', Rule::in(['bachelor','masters','micro','tafe_cert','tafe_diploma','short','apprenticeship'])],
            'mode' => ['sometimes', Rule::in(['on_campus','online','hybrid'])],
            'location' => ['nullable','string','max:255'],
            'duration_weeks' => ['nullable','integer','min:1'],
            'cost_cents' => ['nullable','integer','min:0'],
            'funding' => ['array'],
            'prerequisites' => ['array'],
            'outcomes' => ['array'],
            'tags' => ['array'],
        ]);
        $course->update($data);
        return response()->json($course);
    }

    public function destroy(int $id)
    {
        $course = Course::findOrFail($id);
        $course->delete();
        return response()->json(['ok' => true]);
    }
}
