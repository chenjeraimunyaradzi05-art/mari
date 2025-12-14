<?php
/**
 * Controller
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;

/**
 * @OA\Info(
 *     title="Job Portal AI API Documentation",
 *     version="1.0.0",
 *     description="AI-powered job portal with resume parsing, job matching, career insights, and smart posting features",
 *     @OA\Contact(
 *         email="support@jobportal.com",
 *         name="API Support Team"
 *     ),
 *     @OA\License(
 *         name="Proprietary",
 *         url="https://jobportal.com/license"
 *     )
 * )
 *
 * @OA\Server(
 *     url="http://localhost",
 *     description="Development Server"
 * )
 *
 * @OA\SecurityScheme(
 *     securityScheme="bearerAuth",
 *     type="http",
 *     scheme="bearer",
 *     bearerFormat="JWT"
 * )
 *
 * @OA\Tag(name="AI - Resume Parser", description="AI-powered resume parsing")
 * @OA\Tag(name="AI - Job Matching", description="Intelligent job recommendations")
 * @OA\Tag(name="AI - Career Insights", description="Career path suggestions")
 * @OA\Tag(name="AI - Smart Posting", description="AI-assisted job posting")
 * @OA\Tag(name="AI - CV Builder", description="AI-powered CV building")
 * @OA\Tag(name="Analytics", description="System analytics and metrics")
 */
class Controller extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;
}
