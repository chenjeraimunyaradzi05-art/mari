<?php

namespace App\Http\Controllers\Org;

use App\Http\Controllers\Controller;
use App\Models\ApprenticeshipProgram;
use App\Models\Lead;
use App\Models\OrganizationPage;
use App\Models\OrgFollower;
use App\Models\OrgMediaAsset;
use App\Services\Org\OrgInviteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

final class OrganizationPageController extends Controller
{
	public function __construct(private OrgInviteService $invites)
	{
	}

	public function show(string $slug): JsonResponse
	{
		$page = OrganizationPage::with([
				'company:id,name,website',
				'coverMedia',
				'media' => fn ($query) => $query->ready()->latest()->limit(6),
				'posts' => fn ($query) => $query->with('media')->latest()->limit(6),
			])
			->withCount('followers')
			->where('slug', $slug)
			->published()
			->firstOrFail();

		return response()->json($page);
	}

	public function videos(string $slug): JsonResponse
	{
	$page = OrganizationPage::published()->where('slug', $slug)->firstOrFail();

		$videos = OrgMediaAsset::where('org_page_id', $page->id)
			->ready()
			->latest()
			->paginate(20);

		return response()->json($videos);
	}

	public function apprenticeships(string $slug): JsonResponse
	{
	$page = OrganizationPage::published()->where('slug', $slug)->firstOrFail();

		$programs = ApprenticeshipProgram::where('org_page_id', $page->id)
			->latest()
			->paginate(20);

		return response()->json($programs);
	}

	public function lead(string $slug, Request $request): JsonResponse
	{
	$page = OrganizationPage::published()->where('slug', $slug)->firstOrFail();

		$data = $request->validate([
			'type' => ['required', Rule::in(['course','apprenticeship','job','general'])],
			'contact_name' => ['nullable','string','max:120'],
			'contact_email' => ['nullable','email','max:255'],
			'contact_phone' => ['nullable','string','max:120'],
			'payload' => ['required','array'],
			'source' => ['nullable','string','max:120'],
			'utm' => ['nullable','array'],
		]);

		$lead = Lead::create([
			'org_page_id' => $page->id,
			'type' => $data['type'],
			'contact_name' => $data['contact_name'] ?? null,
			'contact_email' => $data['contact_email'] ?? null,
			'contact_phone' => $data['contact_phone'] ?? null,
			'payload' => $data['payload'],
			'source' => $data['source'] ?? null,
			'utm' => $data['utm'] ?? null,
			'status' => 'new',
			'submitted_at' => now(),
		]);

		return response()->json(['ok' => true, 'lead_id' => $lead->id], 201);
	}

	public function follow(string $slug): JsonResponse
	{
	$page = OrganizationPage::published()->where('slug', $slug)->firstOrFail();
		$userId = Auth::id();

		if (! $userId) {
			return response()->json(['message' => 'Authentication required'], 401);
		}

		OrgFollower::firstOrCreate([
			'org_page_id' => $page->id,
			'user_id' => $userId,
		]);

		return response()->json(['ok' => true]);
	}

	public function invite(string $slug, Request $request): JsonResponse
	{
		$page = OrganizationPage::where('slug', $slug)->firstOrFail();
		$user = Auth::user();

		if (! $user || $page->admins()->where('user_id', $user->id)->doesntExist()) {
			return response()->json(['message' => 'You are not authorized to send invites for this organization.'], 403);
		}

		$validated = $request->validate([
			'emails' => ['required','array','min:1'],
			'emails.*' => ['email'],
			'message' => ['nullable','string','max:1000'],
			'channels' => ['nullable','array','min:1'],
			'channels.*' => ['in:email,sms,slack'],
		]);

		$payload = $this->invites->sendInvites(
			$page,
			$validated['emails'],
			$user,
			[
				'channels' => $validated['channels'] ?? ['email'],
				'message' => $validated['message'] ?? null,
			]
		);

		return response()->json([
			'ok' => true,
			'page_id' => $page->id,
			'invites' => $payload['results']->toArray(),
			'summary' => $payload['summary'],
			'summary_mail_queued' => $payload['summary_mail_queued'],
		]);
	}
}

