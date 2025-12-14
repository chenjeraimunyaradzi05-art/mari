<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\Candidate;
use App\Models\Connection;
use App\Models\MentorshipCohort;
use App\Models\Profile;
use App\Models\SocialMetricsDaily;
use App\Models\User;
use App\Support\SocialMetrics;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\View\View;

final class CandidateConnectionsController extends Controller
{
	public function __construct()
	{
		$this->middleware(['auth', 'verified', 'user.role:candidate']);
	}

	public function index(Request $request): View
	{
		$user = $request->user();
		$userId = $user->id;

		$connectionsQuery = Connection::query()
			->with(['user.candidate', 'connectedUser.candidate'])
			->where(function ($query) use ($userId) {
				$query->where('user_id', $userId)
					->orWhere('connected_user_id', $userId);
			})
			->where('status', 'accepted')
			->latest();

		$connectionsCount = (clone $connectionsQuery)->count();
		$newConnectionsThisMonth = (clone $connectionsQuery)
			->where('created_at', '>=', now()->startOfMonth())
			->count();
		$pendingIncomingCount = Connection::query()
			->where('connected_user_id', $userId)
			->where('status', 'pending')
			->count();
		$pendingOutgoingCount = Connection::query()
			->where('user_id', $userId)
			->where('status', 'pending')
			->count();
		$connections = $connectionsQuery
			->paginate(9)
			->withQueryString();

		return view('frontend.social.connections.index', [
			'connections' => $connections,
			'connectionsCount' => $connectionsCount,
			'newConnectionsThisMonth' => $newConnectionsThisMonth,
			'pendingIncomingCount' => $pendingIncomingCount,
			'pendingOutgoingCount' => $pendingOutgoingCount,
		]);
	}

	public function create(Request $request): View
	{
		$user = $request->user();
		$metrics = SocialMetrics::forUser($user);
		$counts = $metrics['counts'] ?? [];
		$targetDate = $this->resolveMetricsDate($request->query('date'));
		$range = $this->normalizeRange($request->query('range'));
		$persona = $this->resolveActivePersona($user);
		$personaMetrics = $this->buildPersonaMetrics($persona, $targetDate, $range);
		$candidateProfile = $user?->candidate;
		$profileLink = $candidateProfile && $candidateProfile->slug
			? route('members.show', $candidateProfile->slug)
			: route('member.profile.index');
		$searchRoute = route('member.social.connections.search');
		$storeRoute = route('api.v1.social.invites.store');
		$finderVibes = $this->defaultFinderVibes();
		$ritualSteps = [
			[
				'icon' => 'fas fa-hourglass-half',
				'title' => '48-hour thank-you',
				'description' => 'Send a quick note or voice memo appreciating the energy they bring.',
			],
			[
				'icon' => 'fas fa-book-open',
				'title' => 'Share a resource',
				'description' => 'Forward a playlist, article, or template tailored to their current goal.',
			],
			[
				'icon' => 'fas fa-calendar-heart',
				'title' => '30-day check-in',
				'description' => 'Set a reminder to celebrate milestones and keep the momentum glowing.',
			],
		];
		$contactSyncProviders = collect(config('social_invites.contact_sync.providers', []))
			->map(function (array $provider, string $key) {
				return [
					'key' => $key,
					'label' => $provider['display_name'] ?? Str::of($key)->headline(),
					'scopes' => $provider['scopes'] ?? [],
				];
			})
			->values()
			->all();
		$contactSyncLimit = (int) config('social_invites.throttle.contact_sync_per_day', 4);
		$contactSyncEndpoint = route('api.v1.social.contacts.sync');
		$contactSuggestionsRoute = route('api.v1.social.contacts.suggestions');
		$inviteTemplates = collect(config('social_invites.templates', []))
			->map(function (array $template, string $key) {
				return [
					'key' => $key,
					'label' => $template['label'] ?? Str::of($key)->headline(),
					'type' => $template['type'] ?? 'connection',
					'default_message' => $template['default_message'] ?? null,
					'nudge_offsets' => $template['nudge_offsets'] ?? [],
					'onboarding' => $template['onboarding'] ?? [],
				];
			})
			->values()
			->all();
		$mentorshipCohorts = MentorshipCohort::query()
			->select(['id', 'name', 'cohort_code', 'focus_area', 'status', 'mentorship_program_id'])
			->where(function ($query) {
				$query->whereNull('status')
					->orWhere('status', '<>', 'archived');
			})
			->orderBy('name')
			->limit(50)
			->get();

		return view('frontend.social.connections.create', [
			'counts' => $counts,
			'profileLink' => $profileLink,
			'searchRoute' => $searchRoute,
			'storeRoute' => $storeRoute,
			'finderVibes' => $finderVibes,
			'ritualSteps' => $ritualSteps,
			'contactSyncProviders' => $contactSyncProviders,
			'contactSyncLimit' => $contactSyncLimit,
			'contactSyncEndpoint' => $contactSyncEndpoint,
			'contactSuggestionsRoute' => $contactSuggestionsRoute,
			'inviteTemplates' => $inviteTemplates,
			'mentorshipCohorts' => $mentorshipCohorts,
			'metricsFilter' => [
				'available_ranges' => [
					'day' => 'Daily snapshot',
					'rolling7' => 'Rolling 7-day',
				],
				'range' => $range,
				'selected_date' => $targetDate->toDateString(),
				'persona_label' => $persona?->display_name ?? $user->name,
			],
			'personaMetrics' => $personaMetrics,
		]);
	}

	public function discover(): View
	{
		return view('frontend.social.connections.discover');
	}

	public function spotlight(Request $request): View
	{
		$user = $request->user();
		$metrics = SocialMetrics::forUser($user);
		$counts = $metrics['counts'] ?? [];
		$candidateProfile = $user?->candidate;
		$profileLink = $candidateProfile && $candidateProfile->slug
			? route('members.show', $candidateProfile->slug)
			: route('member.profile.index');

		return view('frontend.social.connections.spotlight', [
			'counts' => $counts,
			'profileLink' => $profileLink,
			'defaultAvatar' => asset('images/default-avatar.png'),
		]);
	}

	public function explore(Request $request): View
	{
		$user = $request->user();
		$metrics = SocialMetrics::forUser($user);
		$counts = $metrics['counts'] ?? [];
		$finderVibes = $this->defaultFinderVibes();

		return view('frontend.social.connections.explore', [
			'counts' => $counts,
			'finderVibes' => $finderVibes,
			'defaultAvatar' => asset('images/default-avatar.png'),
		]);
	}

	public function store(Request $request): JsonResponse|RedirectResponse
	{
		$user = $request->user();
		$validated = $request->validate([
			'invite_email' => ['nullable', 'email'],
			'invite_note' => ['nullable', 'string', 'max:600'],
			'target_user_id' => ['nullable', 'integer', 'exists:users,id'],
			'invite_type' => ['nullable', 'string', 'max:60'],
		]);

		if (empty($validated['target_user_id']) && empty($validated['invite_email'])) {
			return $this->errorResponse($request, 'Add an email or pick someone from the list to invite.');
		}

		$targetUser = null;
		if (!empty($validated['target_user_id'])) {
			$targetUser = User::query()
				->whereKey($validated['target_user_id'])
				->where('id', '<>', $user->id)
				->first();
		}

		if (!$targetUser && !empty($validated['invite_email'])) {
			$targetUser = User::query()
				->where('email', $validated['invite_email'])
				->where('id', '<>', $user->id)
				->first();
		}

		if (!$targetUser) {
			return $this->errorResponse($request, 'We could not find a registered profile for that invite details yet.');
		}

		$existingConnection = Connection::query()
			->where(function ($query) use ($user, $targetUser) {
				$query->where('user_id', $user->id)
					->where('connected_user_id', $targetUser->id);
			})
			->orWhere(function ($query) use ($user, $targetUser) {
				$query->where('user_id', $targetUser->id)
					->where('connected_user_id', $user->id);
			})
			->first();

		if ($existingConnection) {
			if ($existingConnection->status === 'accepted') {
				return $this->successResponse($request, $existingConnection, $user->id, 'You are already connected.', 'noop');
			}

			if ($existingConnection->status === 'pending' && $existingConnection->initiator_id === $user->id) {
				return $this->successResponse($request, $existingConnection, $user->id, 'Your invite is already pending.', 'noop');
			}

			if ($existingConnection->status === 'pending' && $existingConnection->initiator_id !== $user->id) {
				$existingConnection->accept();
				$existingConnection->refresh();

				return $this->successResponse($request, $existingConnection, $user->id, 'You are now connected.', 'connected');
			}

			// For rejected or blocked we create a fresh pending record.
			$existingConnection->delete();
		}

		$connection = Connection::query()->create([
			'user_id' => $user->id,
			'connected_user_id' => $targetUser->id,
			'status' => 'pending',
			'type' => $validated['invite_type'] ?? 'manual_invite',
			'initiator_id' => $user->id,
		]);

		return $this->successResponse($request, $connection, $user->id, 'Invite sent.', 'created');
	}

	public function search(Request $request): JsonResponse
	{
		$user = $request->user();
		$validated = $request->validate([
			'keyword' => ['nullable', 'string', 'max:120'],
			'vibe' => ['nullable', 'string', 'max:120'],
			'location' => ['nullable', 'string', 'max:120'],
			'limit' => ['nullable', 'integer', 'between:1,24'],
		]);

		$index = $this->connectionIndex($user->id);
		$limit = $validated['limit'] ?? 12;

		$candidateQuery = Candidate::query()
			->with([
				'user:id,name,email,role',
				'profession:id,name',
				'skills.skill:id,name',
			])
			->whereHas('user', function ($query) use ($user) {
				$query->where('role', 'candidate')
					->where('id', '<>', $user->id);
			});

		if (!empty($validated['keyword'])) {
			$keyword = $validated['keyword'];
			$candidateQuery->where(function ($query) use ($keyword) {
				$query->where('full_name', 'like', '%' . $keyword . '%')
					->orWhere('title', 'like', '%' . $keyword . '%')
					->orWhere('bio', 'like', '%' . $keyword . '%')
					->orWhereHas('user', function ($userQuery) use ($keyword) {
						$userQuery->where('name', 'like', '%' . $keyword . '%');
					});
			});
		}

		if (!empty($validated['location'])) {
			$location = $validated['location'];
			$candidateQuery->where(function ($query) use ($location) {
				$query->where('city', 'like', '%' . $location . '%')
					->orWhere('state', 'like', '%' . $location . '%')
					->orWhere('country', 'like', '%' . $location . '%');
			});
		}

		if (!empty($validated['vibe'])) {
			$vibe = $validated['vibe'];
			$candidateQuery->where(function ($query) use ($vibe) {
				$query->where('title', 'like', '%' . $vibe . '%')
					->orWhere('bio', 'like', '%' . $vibe . '%')
					->orWhereHas('profession', function ($professionQuery) use ($vibe) {
						$professionQuery->where('name', 'like', '%' . $vibe . '%');
					});
			});
		}

		$candidates = $candidateQuery
			->orderByDesc('updated_at')
			->limit($limit)
			->get();

		$data = $candidates->map(fn (Candidate $candidate) => $this->transformCandidate($candidate, $index, $user->id));

		return response()->json([
			'count' => $data->count(),
			'data' => $data,
		]);
	}

	private function successResponse(Request $request, Connection $connection, int $authUserId, string $message, string $state): RedirectResponse|JsonResponse
	{
		$response = [
			'connection' => $this->transformConnection($connection, $authUserId),
			'message' => $message,
			'state' => $state,
		];

		if ($request->expectsJson()) {
			return response()->json($response);
		}

		return redirect()
			->back()
			->with('status', $message);
	}

	private function errorResponse(Request $request, string $message, int $status = 422): RedirectResponse|JsonResponse
	{
		if ($request->expectsJson()) {
			return response()->json([
				'message' => $message,
			], $status);
		}

		return redirect()->back()->withErrors(['invite_email' => $message]);
	}

	/**
	 * @return (\Illuminate\Database\Eloquent\Collection|\Illuminate\Support\Collection|bool|int|mixed|null|string)[]
	 *
	 * @psalm-return array{user_id: int, name: string, title: string, city: 'Global'|int, profession: null|string, bio: null|string, avatar: string, profile_url: null|string, connection_status: 'new'|mixed|null, connection_label: string, is_pending_incoming: bool, is_pending_outgoing: bool, is_connected: bool, tags: \Illuminate\Database\Eloquent\Collection<int, null|string>|\Illuminate\Support\Collection<int, null|string>}
	 */
	private function transformCandidate(Candidate $candidate, array $index, int $authUserId): array
	{
		$user = $candidate->user;
		$statusMeta = $index[$user->id] ?? null;
		$statusKey = $statusMeta['status'] ?? 'new';
		$avatar = $candidate->image ? asset($candidate->image) : asset('images/default-avatar.png');
		$name = $user?->name ?: ($candidate->full_name ?: 'Candidate');
		$title = $candidate->title ?: 'Creative professional';
		$city = $candidate->city ?: 'Global';
		$profession = $candidate->profession?->name;
		$bio = trim(strip_tags((string) ($candidate->bio ?? '')));
		$bio = $bio !== '' ? Str::limit($bio, 180) : null;
		$tags = $candidate->skills
			->map(fn ($skill) => $skill->skill?->name)
			->filter()
			->unique()
			->take(4)
			->values();

		return [
			'user_id' => $user->id,
			'name' => $name,
			'title' => $title,
			'city' => $city,
			'profession' => $profession,
			'bio' => $bio,
			'avatar' => $avatar,
			'profile_url' => $candidate->slug ? route('members.show', $candidate->slug) : null,
			'connection_status' => $statusKey,
			'connection_label' => $this->formatStatusLabel($statusKey),
			'is_pending_incoming' => $statusKey === 'pending_incoming',
			'is_pending_outgoing' => $statusKey === 'pending_outgoing',
			'is_connected' => $statusKey === 'connected',
			'tags' => $tags,
		];
	}

	/**
	 * @return (int|null|string)[]
	 *
	 * @psalm-return array{id: int, other_user_id: int|null, other_user_name: null|string, raw_status: string, status_key: string, status_label: string, initiator_id: int|null}
	 */
	private function transformConnection(Connection $connection, int $authUserId): array
	{
		$connection->loadMissing(['user', 'connectedUser']);
		$isInitiator = $connection->initiator_id === $authUserId;
		$statusKey = $connection->status === 'accepted'
			? 'connected'
			: ($connection->status === 'pending'
				? ($isInitiator ? 'pending_outgoing' : 'pending_incoming')
				: $connection->status);

		$otherUser = $connection->user_id === $authUserId
			? $connection->connectedUser
			: $connection->user;

		return [
			'id' => $connection->id,
			'other_user_id' => $otherUser?->id,
			'other_user_name' => $otherUser?->name,
			'raw_status' => $connection->status,
			'status_key' => $statusKey,
			'status_label' => $this->formatStatusLabel($statusKey),
			'initiator_id' => $connection->initiator_id,
		];
	}

	private function formatStatusLabel(string $statusKey): string
	{
		return match ($statusKey) {
			'connected' => 'Connected',
			'pending_outgoing' => 'Pending invite',
			'pending_incoming' => 'Respond to invite',
			'snoozed' => 'Snoozed',
			'blocked' => 'Blocked',
			'rejected' => 'Declined',
			default => 'Invite',
		};
	}

	/**
	 * @return ((int|string)[]|mixed)[]
	 *
	 * @psalm-return array<array{connection_id: int, status: string}|mixed>
	 */
	private function connectionIndex(int $userId): array
	{
		return Connection::query()
			->where(function ($query) use ($userId) {
				$query->where('user_id', $userId)
					->orWhere('connected_user_id', $userId);
			})
			->get()
			->reduce(function (array $carry, Connection $connection) use ($userId) {
				$otherId = $connection->user_id === $userId
					? $connection->connected_user_id
					: $connection->user_id;
				$status = $connection->status === 'accepted'
					? 'connected'
					: ($connection->status === 'pending'
						? ($connection->initiator_id === $userId ? 'pending_outgoing' : 'pending_incoming')
						: $connection->status);
				$carry[$otherId] = [
					'connection_id' => $connection->id,
					'status' => $status,
				];

				return $carry;
			}, []);
	}

	/**
	 * @return string[][]
	 *
	 * @psalm-return list{array{label: 'Brand Storytellers', value: 'Brand Storytelling'}, array{label: 'Product Visionaries', value: 'Product Design'}, array{label: 'Growth Alchemists', value: 'Growth Strategy'}, array{label: 'Community Hosts', value: 'Community'}, array{label: 'Wellness Curators', value: 'Wellness'}, array{label: 'Launch Orchestrators', value: 'Launch'}}
	 */
	private function defaultFinderVibes(): array
	{
		return [
			['label' => 'Brand Storytellers', 'value' => 'Brand Storytelling'],
			['label' => 'Product Visionaries', 'value' => 'Product Design'],
			['label' => 'Growth Alchemists', 'value' => 'Growth Strategy'],
			['label' => 'Community Hosts', 'value' => 'Community'],
			['label' => 'Wellness Curators', 'value' => 'Wellness'],
			['label' => 'Launch Orchestrators', 'value' => 'Launch'],
		];
	}

	private function resolveMetricsDate(?string $input): Carbon
	{
		try {
			return $input
				? Carbon::parse($input)->startOfDay()
				: now()->startOfDay();
		} catch (\Throwable $exception) {
			return now()->startOfDay();
		}
	}

	private function normalizeRange(?string $range): string
	{
		return in_array($range, ['rolling7'], true) ? 'rolling7' : 'day';
	}

	private function resolveActivePersona(User $user): ?Profile
	{
		if (method_exists($user, 'activeProfile')) {
			$active = $user->activeProfile()->first();
			if ($active instanceof Profile) {
				return $active;
			}
		}

		if ($user->relationLoaded('activeProfile')) {
			$loaded = $user->getRelation('activeProfile');
			if ($loaded instanceof Profile) {
				return $loaded;
			}
		}

		return $user->profiles()->where('is_active', true)->first()
			?? $user->profiles()->first();
	}

	/**
	 * @return (((float|int|null|string)[]|mixed)[]|bool|int|null|string)[]
	 *
	 * @psalm-return array{has_data: bool, range: string, date_label: string, connections: int, invites: array{sent: int<min, max>|mixed, accepted: int|mixed}, invite_conversion: int, civility: array{score: float|null, label: string}, heatmap: array{daily: array<never, never>|mixed, max_value: int<1, max>}, funnel_bins: array, trend: array<int, array{date: string, connections: int, invites: int, civility: float|null}>, last_updated: null|string}
	 */
	private function buildPersonaMetrics(?Profile $persona, Carbon $targetDate, string $range): array
	{
		$defaults = [
			'has_data' => false,
			'range' => $range,
			'date_label' => $targetDate->format('M j, Y'),
			'connections' => 0,
			'invites' => [
				'sent' => 0,
				'accepted' => 0,
			],
			'invite_conversion' => 0,
			'civility' => [
				'score' => null,
				'label' => 'No data',
			],
			'heatmap' => [
				'daily' => [],
				'max_value' => 1,
			],
			'funnel_bins' => [],
			'trend' => [],
			'last_updated' => null,
		];

		if (!$persona) {
			return $defaults;
		}

		$query = SocialMetricsDaily::query()
			->where('persona_id', $persona->getKey());

		$currentRecord = (clone $query)
			->whereDate('captured_on', $targetDate->toDateString())
			->first();

		$windowStart = $range === 'rolling7'
			? $targetDate->copy()->subDays(6)->startOfDay()
			: $targetDate->copy()->startOfDay();

		$windowRecords = (clone $query)
			->whereBetween('captured_on', [$windowStart->toDateString(), $targetDate->toDateString()])
			->orderBy('captured_on')
			->get();

		if ($windowRecords->isEmpty() && !$currentRecord) {
			return $defaults;
		}

		$latestRecord = $windowRecords->last() ?? $currentRecord;
		$invitesSent = $range === 'rolling7'
			? $windowRecords->sum('total_invites_sent')
			: ($currentRecord?->total_invites_sent ?? 0);
		$invitesAccepted = $range === 'rolling7'
			? $windowRecords->sum('total_invites_accepted')
			: ($currentRecord?->total_invites_accepted ?? 0);
		$conversion = $invitesSent > 0
			? (int) round(($invitesAccepted / max(1, $invitesSent)) * 100)
			: 0;
		$civilityScore = $range === 'rolling7'
			? round($windowRecords->avg('messaging_civility_score') ?? 0, 1)
			: round((float) ($currentRecord?->messaging_civility_score ?? 0), 1);
		$heatmapDaily = $currentRecord?->connection_heatmap_bins['daily']
			?? $latestRecord?->connection_heatmap_bins['daily']
			?? [];
		$heatmapMax = max(1, (int) collect($heatmapDaily)->max() ?: 1);
		$trendSeries = (clone $query)
			->orderByDesc('captured_on')
			->limit(7)
			->get()
			->sortBy('captured_on')
			->values()
			->map(static fn (SocialMetricsDaily $item) => [
				'date' => optional($item->captured_on)->format('M j'),
				'connections' => $item->total_connections,
				'invites' => $item->total_invites_sent,
				'civility' => $item->messaging_civility_score,
			])
			->all();

		return [
			'has_data' => (bool) ($currentRecord || $windowRecords->isNotEmpty()),
			'range' => $range,
			'date_label' => $targetDate->format('M j, Y'),
			'connections' => $latestRecord?->total_connections ?? 0,
			'invites' => [
				'sent' => $invitesSent,
				'accepted' => $invitesAccepted,
			],
			'invite_conversion' => $conversion,
			'civility' => [
				'score' => $civilityScore,
				'label' => $this->civilityLabel($civilityScore),
			],
			'heatmap' => [
				'daily' => $heatmapDaily,
				'max_value' => $heatmapMax,
			],
			'funnel_bins' => $currentRecord?->invite_funnel_bins ?? [],
			'trend' => $trendSeries,
			'last_updated' => optional($latestRecord?->captured_on)->toDateTimeString(),
		];
	}

	private function civilityLabel(?float $score): string
	{
		if ($score === null || $score <= 0) {
			return 'No data';
		}

		return match (true) {
			$score >= 4.2 => 'Healthy',
			$score >= 3.5 => 'Watch',
			default => 'Needs coaching',
		};
	}

	public function destroy(Request $request, Connection $connection): RedirectResponse|JsonResponse
	{
		$userId = $request->user()->id;

		if ($connection->user_id !== $userId && $connection->connected_user_id !== $userId) {
			abort(403);
		}

		$connection->delete();

		if ($request->expectsJson()) {
			return response()->json([
				'success' => true,
				'message' => 'Connection removed.',
			]);
		}

		return redirect()
			->route('member.social.connections')
			->with('status', 'Connection removed.');
	}
}

