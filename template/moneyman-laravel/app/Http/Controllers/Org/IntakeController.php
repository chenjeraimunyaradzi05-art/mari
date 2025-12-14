<?php

namespace App\Http\Controllers\Org;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\CourseIntake;

class IntakeController extends Controller
{
    public function store(int $courseId, Request $request)
    {
        $data = $request->validate([
            'start_on' => ['required','date'],
            'apply_by' => ['nullable','date'],
            'seats' => ['nullable','integer','min:0'],
            'scholarships' => ['array']
        ]);
        $data['course_id'] = $courseId;
        $intake = CourseIntake::create($data);
        return response()->json($intake, 201);
    }
}
