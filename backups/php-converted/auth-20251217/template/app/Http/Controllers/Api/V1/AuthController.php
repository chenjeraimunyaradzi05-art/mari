<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Candidate;
use App\Models\Company;
use App\Services\Auth\UserLoginAuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

final class AuthController extends Controller
{
    public function __construct(private readonly UserLoginAuditService $loginAuditService)
    {
    }

    /**
     * Register a new user (Candidate or Company)
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()],
            'role' => 'required|in:candidate,company',

            // Candidate specific
            'member.title' => 'required_if:role,candidate|string|max:255',
            'member.birth_date' => 'nullable|date',
            'member.gender' => 'nullable|in:male,female,other',

            // Company specific
            'company.name' => 'required_if:role,company|string|max:255',
            'company.organization_type_id' => 'required_if:role,company|exists:organization_types,id',
            'company.industry_type_id' => 'required_if:role,company|exists:industry_types,id',
            'company.team_size_id' => 'required_if:role,company|exists:team_sizes,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Create user
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => $request->role,
            ]);

            // Mark email as verified (or send verification email)
            $user->markEmailAsVerified();

            // Create role-specific profile
            if ($request->role === 'candidate') {
                Candidate::create([
                    'user_id' => $user->id,
                    'title' => $request->input('member.title'),
                    'birth_date' => $request->input('member.birth_date'),
                    'gender' => $request->input('member.gender'),
                    'status' => 1,
                ]);
            } elseif ($request->role === 'company') {
                Company::create([
                    'user_id' => $user->id,
                    'name' => $request->input('company.name'),
                    'organization_type_id' => $request->input('company.organization_type_id'),
                    'industry_type_id' => $request->input('company.industry_type_id'),
                    'team_size_id' => $request->input('company.team_size_id'),
                    'profile_completion' => 0,
                    'visibility' => 1,
                ]);
            }

            // Create API token
            $token = $user->createToken('api-token')->plainTextToken;

            return response()->json([
                'success' => true,
                'message' => 'Registration successful',
                'data' => [
                    // Normalize role -> relation mapping (member users map to candidate relation)
                    'user' => $user->load($request->role === 'member' ? 'candidate' : $request->role),
                    'token' => $token,
                    'token_type' => 'Bearer'
                ]
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Registration failed',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Login user and create token
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required',
            'timezone' => ['nullable', 'string', 'max:80'],
            'offset_minutes' => ['nullable', 'integer', 'between:-900,900'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials'
            ], 401);
        }

        // Create API token
        $token = $user->createToken('api-token')->plainTextToken;

        $this->loginAuditService->record($user, $request, [
            'source' => 'api',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'data' => [
                // Map the canonical 'member' role back to candidate relation for eager loading
                'user' => $user->load($user->role === 'member' ? 'candidate' : $user->role),
                'token' => $token,
                'token_type' => 'Bearer'
            ]
        ], 200);
    }

    /**
     * Get authenticated user details
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function user(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'success' => true,
            'data' => [
                'user' => $user->load($user->role === 'member' ? 'candidate' : $user->role)
            ]
        ], 200);
    }

    /**
     * Logout user (revoke token)
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function logout(Request $request)
    {
        // Revoke current token
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully'
        ], 200);
    }

    /**
     * Logout from all devices (revoke all tokens)
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function logoutAll(Request $request)
    {
        // Revoke all tokens
        $request->user()->tokens()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out from all devices successfully'
        ], 200);
    }

    /**
     * Refresh token (revoke old and create new)
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function refresh(Request $request)
    {
        $user = $request->user();

        // Revoke current token
        $request->user()->currentAccessToken()->delete();

        // Create new token
        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Token refreshed successfully',
            'data' => [
                'token' => $token,
                'token_type' => 'Bearer'
            ]
        ], 200);
    }
}

