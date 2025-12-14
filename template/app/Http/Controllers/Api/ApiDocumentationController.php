<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\View\View;
use OpenApi\Annotations as OA;

/**
 * API Documentation Controller with OpenAPI annotations.
 */
final class ApiDocumentationController extends Controller
{
    /**
     * @OA\Post (
     *     path="/api/resume/parse",
     *     summary="Parse resume file and extract information",
     *     tags={"AI - Resume Parser"},
     *     security={{"bearerAuth":{}}},
     *
     * @OA\RequestBody (
     *         required=true,
     *
     * @OA\MediaType (
     *             mediaType="multipart/form-data",
     *
     * @OA\Schema (
     *
     * @OA\Property (
     *                     property="resume",
     *                     description="Resume file (PDF, DOC, DOCX)",
     *                     type="string",
     *                     format="binary"
     *                 )
     *             )
     *         )
     *     ),
     * @OA\Property (property="success", type="boolean", example=true),
     * @OA\Property (
     *                 property="data",
     *                 type="object",
     * @OA\Property (property="name", type="string", example="John Doe"),
     * @OA\Property (property="email", type="string", example="john@example.com"),
     * @OA\Property (property="phone", type="string", example="+1234567890"),
     * @OA\Property (property="summary", type="string"),
     * @OA\Property (property="skills", type="array", @OA\Items(type="string")),
     * @OA\Property (property="experience", type="array", @OA\Items(type="object")),
     * @OA\Property (property="education", type="array", @OA\Items(type="object"))
     *             )
     *         )
     *     ),
     *
     * @OA\Response (
     *         response=200,
     *         description="Resume parsed successfully",
     * @OA\Response (response=422, description="Validation error")
     * )
     *
     * @OA\JsonContent (
     */
    public function parseResume(): void {}

    /**
     * @OA\Get (
     *     path="/api/jobs/recommendations",
     *     summary="Get AI-powered job recommendations",
     *     tags={"AI - Job Matching"},
     *     security={{"bearerAuth":{}}},
     *
     * @OA\Parameter (name="limit", in="query", @OA\Schema(type="integer", default=10)),
     *
     * @OA\Response (
     *         response=200,
     *         description="Job recommendations retrieved",
     *
     * @OA\JsonContent (
     *
     * @OA\Property (property="success", type="boolean"),
     * @OA\Property (property="data", type="array", @OA\Items(
     * @OA\Property (property="job_id", type="integer"),
     * @OA\Property (property="title", type="string"),
     * @OA\Property (property="match_score", type="number")
     *             ))
     *         )
     *     )
     * )
     */
    public function getJobRecommendations(): void {}

    /**
     * @OA\Get (
     *     path="/api/career/insights",
     *     summary="Get AI-powered career insights",
     *     tags={"AI - Career Insights"},
     *     security={{"bearerAuth":{}}},
     *
     * @OA\Response (response=200, description="Career insights retrieved")
     * )
     */
    public function getCareerInsights(): void {}

    /**
     * @OA\Post (
     *     path="/api/jobs/generate-description",
     *     summary="Generate AI-powered job description",
     *     tags={"AI - Smart Posting"},
     *     security={{"bearerAuth":{}}},
     *
     * @OA\RequestBody (
     *         required=true,
     *
     * @OA\JsonContent (
     *
     * @OA\Property (property="title", type="string", example="Senior Laravel Developer"),
     * @OA\Property (property="experience", type="string", example="senior")
     *         )
     *     ),
     *
     * @OA\Response (response=200, description="Job description generated")
     * )
     */
    public function generateJobDescription(): void {}

    /**
     * Display API documentation page
     */
    public function index(): View
    {
        $specPath = storage_path('app/public/api-docs/api-docs.json');
        $specExists = is_file($specPath);

        $specUrl = $specExists ? asset('storage/api-docs/api-docs.json') : null;

        return view('api-docs.index', [
            'specUrl' => $specUrl,
            'specMissing' => ! $specExists,
        ]);
    }
}
