// Auto-generated stub for App\Http\Controllers\Api\V1\AuthController

async function __construct(req, res) {
  return new Response(JSON.stringify({ message: 'Not implemented' }), { status: 501 });
}

/**
 * Original PHP method body (for reference):
 * $validator = Validator::make($request->all(), [
 *             'name' => 'required|string|max:255',
 *             'email' => 'required|string|email|max:255|unique:users',
 *             'password' => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()],
 *             'role' => 'required|in:candidate,company',
 * 
 *             // Candidate specific
 *             'member.title' => 'required_if:role,candidate|string|max:255',
 *             'member.birth_date' => 'nullable|date',
 *             'member.gender' => 'nullable|in:male,female,other',
 * 
 *             // Company specific
 *             'company.name' => 'required_if:role,company|string|max:255',
 *             'company.organization_type_id' => 'required_if:role,company|exists:organization_types,id',
 *             'company.industry_type_id' => 'required_if:role,company|exists:industry_types,id',
 *             'company.team_size_id' => 'required_if:role,company|exists:team_sizes,id',
 *         ]);
 * 
 *         if ($validator->fails()) {
 *             return response()->json([
 *                 'success' => false,
 *                 'message' => 'Validation failed',
 *                 'errors' => $validator->errors()
 *             ], 422);
 *         }
 * 
 *         try {
 *             // Create user
 *             $user = User::create([
 *                 'name' => $request->name,
 *                 'email' => $request->email,
 *                 'password' => Hash::make($request->password),
 *                 'role' => $request->role,
 *             ]);
 * 
 *             // Mark email as verified (or send verification email)
 *             $user->markEmailAsVerified();
 * 
 *             // Create role-specific profile
 *             if ($request->role === 'candidate') {
 *                 Candidate::create([
 *                     'user_id' => $user->id,
 *                     'title' => $request->input('member.title'),
 *                     'birth_date' => $request->input('member.birth_date'),
 *                     'gender' => $request->input('member.gender'),
 *                     'status' => 1,
 *                 ]);
 *             } elseif ($request->role === 'company') {
 *                 Company::create([
 *                     'user_id' => $user->id,
 *                     'name' => $request->input('company.name'),
 *                     'organization_type_id' => $request->input('company.organization_type_id'),
 *                     'industry_type_id' => $request->input('company.industry_type_id'),
 *                     'team_size_id' => $request->input('company.team_size_id'),
 *                     'profile_completion' => 0,
 *                     'visibility' => 1,
 *                 ]);
 *             }
 * 
 *             // Create API token
 *             $token = $user->createToken('api-token')->plainTextToken;
 * 
 *             return response()->json([
 *                 'success' => true,
 *                 'message' => 'Registration successful',
 *                 'data' => [
 *                     // Normalize role -> relation mapping (member users map to candidate relation)
 *                     'user' => $user->load($request->role === 'member' ? 'candidate' : $request->role),
 *                     'token' => $token,
 *                     'token_type' => 'Bearer'
 *                 ]
 *             ], 201);
 * 
 *         } catch (\Exception $e) {
 *             return response()->json([
 *                 'success' => false,
 *                 'message' => 'Registration failed',
 *                 'error' => $e->getMessage()
 *             ], 500);
 *         }
 */
const { prisma } = require('@/lib/prisma');
const { compare, hash } = require('bcryptjs');
const { createPersonalAccessToken, getUserFromRequest, revokePersonalAccessToken, revokeAllPersonalAccessTokensForUser, verifyPersonalAccessToken } = require('@/lib/tokens');

async function register(req, res) {
  try {
    const body = await req.json();
    const { name, email, password, role, member = {}, company = {} } = body;

    if (!email || !password || !name || !role) {
      return new Response(JSON.stringify({ success: false, message: 'Validation failed' }), { status: 422 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return new Response(JSON.stringify({ success: false, message: 'Email already in use' }), { status: 422 });
    }

    const hashed = await hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hashed, firstName: name, role } });

    if (role === 'candidate' || role === 'member') {
      await prisma.member.create({ data: { userId: user.id, title: member.title ?? null, birthDate: member.birthDate ?? null, gender: member.gender ?? null, status: 1 } });
    } else if (role === 'company') {
      await prisma.company.create({ data: { userId: user.id, companyName: company.name ?? '', organizationId: company.organization_type_id ?? null, industry: company.industry_type_id ?? null } });
    }

    const token = await createPersonalAccessToken(user.id, 'api-token');

    const userWithProfile = await prisma.user.findUnique({ where: { id: user.id }, include: { member: true, company: true } });

    return new Response(JSON.stringify({ success: true, message: 'Registration successful', data: { user: userWithProfile, token, token_type: 'Bearer' } }), { status: 201 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: 'Registration failed', error: String(e) }), { status: 500 });
  }
}

/**
 * Original PHP method body (for reference):
 * $validator = Validator::make($request->all(), [
 *             'email' => 'required|email',
 *             'password' => 'required',
 *             'timezone' => ['nullable', 'string', 'max:80'],
 *             'offset_minutes' => ['nullable', 'integer', 'between:-900,900'],
 *         ]);
 * 
 *         if ($validator->fails()) {
 *             return response()->json([
 *                 'success' => false,
 *                 'message' => 'Validation failed',
 *                 'errors' => $validator->errors()
 *             ], 422);
 *         }
 * 
 *         $user = User::where('email', $request->email)->first();
 * 
 *         if (!$user || !Hash::check($request->password, $user->password)) {
 *             return response()->json([
 *                 'success' => false,
 *                 'message' => 'Invalid credentials'
 *             ], 401);
 *         }
 * 
 *         // Create API token
 *         $token = $user->createToken('api-token')->plainTextToken;
 * 
 *         $this->loginAuditService->record($user, $request, [
 *             'source' => 'api',
 *         ]);
 * 
 *         return response()->json([
 *             'success' => true,
 *             'message' => 'Login successful',
 *             'data' => [
 *                 // Map the canonical 'member' role back to candidate relation for eager loading
 *                 'user' => $user->load($user->role === 'member' ? 'candidate' : $user->role),
 *                 'token' => $token,
 *                 'token_type' => 'Bearer'
 *             ]
 *         ], 200);
 */
async function login(req, res) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ success: false, message: 'Validation failed' }), { status: 422 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return new Response(JSON.stringify({ success: false, message: 'Invalid credentials' }), { status: 401 });

    const valid = await compare(password, user.password);
    if (!valid) return new Response(JSON.stringify({ success: false, message: 'Invalid credentials' }), { status: 401 });

    const token = await createPersonalAccessToken(user.id, 'api-token');
    const userWithProfile = await prisma.user.findUnique({ where: { id: user.id }, include: { member: true, company: true } });

    return new Response(JSON.stringify({ success: true, message: 'Login successful', data: { user: userWithProfile, token, token_type: 'Bearer' } }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: 'Login failed', error: String(e) }), { status: 500 });
  }
}

/**
 * Original PHP method body (for reference):
 * $user = $request->user();
 * 
 *         return response()->json([
 *             'success' => true,
 *             'data' => [
 *                 'user' => $user->load($user->role === 'member' ? 'candidate' : $user->role)
 *             ]
 *         ], 200);
 */
async function user(req, res) {
  try {
    const userId = await getUserFromRequest(req);
    if (!userId) return new Response(JSON.stringify({ success: false, message: 'Unauthenticated' }), { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { member: true, company: true } });
    return new Response(JSON.stringify({ success: true, data: { user } }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: 'Failed to fetch user', error: String(e) }), { status: 500 });
  }
}

/**
 * Original PHP method body (for reference):
 * // Revoke current token
 *         $request->user()->currentAccessToken()->delete();
 * 
 *         return response()->json([
 *             'success' => true,
 *             'message' => 'Logged out successfully'
 *         ], 200);
 */
async function logout(req, res) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    if (!token) return new Response(JSON.stringify({ success: false, message: 'Unauthenticated' }), { status: 401 });

    await revokePersonalAccessToken(token);
    return new Response(JSON.stringify({ success: true, message: 'Logged out successfully' }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: 'Logout failed', error: String(e) }), { status: 500 });
  }
}

/**
 * Original PHP method body (for reference):
 * // Revoke all tokens
 *         $request->user()->tokens()->delete();
 * 
 *         return response()->json([
 *             'success' => true,
 *             'message' => 'Logged out from all devices successfully'
 *         ], 200);
 */
async function logoutAll(req, res) {
  try {
    const userId = await getUserFromRequest(req);
    if (!userId) return new Response(JSON.stringify({ success: false, message: 'Unauthenticated' }), { status: 401 });

    await revokeAllPersonalAccessTokensForUser(userId);
    return new Response(JSON.stringify({ success: true, message: 'Logged out from all devices successfully' }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: 'LogoutAll failed', error: String(e) }), { status: 500 });
  }
}

/**
 * Original PHP method body (for reference):
 * $user = $request->user();
 * 
 *         // Revoke current token
 *         $request->user()->currentAccessToken()->delete();
 * 
 *         // Create new token
 *         $token = $user->createToken('api-token')->plainTextToken;
 * 
 *         return response()->json([
 *             'success' => true,
 *             'message' => 'Token refreshed successfully',
 *             'data' => [
 *                 'token' => $token,
 *                 'token_type' => 'Bearer'
 *             ]
 *         ], 200);
 */
async function refresh(req, res) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    if (!token) return new Response(JSON.stringify({ success: false, message: 'Unauthenticated' }), { status: 401 });

    const row = await verifyPersonalAccessToken(token);
    if (!row) return new Response(JSON.stringify({ success: false, message: 'Invalid token' }), { status: 401 });

    // Revoke current and issue new
    await revokePersonalAccessToken(token);
    const newToken = await createPersonalAccessToken(String(row.tokenable_id), 'api-token');

    return new Response(JSON.stringify({ success: true, message: 'Token refreshed successfully', data: { token: newToken, token_type: 'Bearer' } }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: 'Refresh failed', error: String(e) }), { status: 500 });
  }
}

module.exports = {
  __construct,
  register,
  login,
  user,
  logout,
  logoutAll,
  refresh,
};
