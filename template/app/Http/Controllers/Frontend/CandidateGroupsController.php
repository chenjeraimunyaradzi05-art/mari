<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Models\Group;
use App\Models\GroupMember;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\View\View;

final class CandidateGroupsController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth', 'verified', 'user.role:candidate']);
    }

    public function index(Request $request): View
    {
        $candidate = $request->user()->candidate;
        $userId = $request->user()->id;

        $groupsQuery = Group::query()
            ->withCount('members')
            ->with([
                'members' => function ($query) {
                    $query->latest('joined_at')
                        ->limit(6)
                        ->with('user');
                },
            ])
            ->whereHas('members', function ($query) use ($userId) {
                $query->where('user_id', $userId);
            })
            ->latest();

        $groupsCount = (clone $groupsQuery)->count();
        $groups = $groupsQuery->paginate(9)->withQueryString();
        $this->hydrateGroupMetrics($groups->getCollection());

        return view('frontend.social.groups.index', [
            'candidate' => $candidate,
            'groups' => $groups,
            'groupsCount' => $groupsCount,
        ]);
    }

    public function create(Request $request): View
    {
        return view('frontend.social.groups.create', [
            'candidate' => $request->user()->candidate,
        ]);
    }

    public function store(Request $request): RedirectResponse|JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|min:3|max:100',
            'description' => 'nullable|string|max:1000',
            'visibility' => 'nullable|in:public,private',
        ]);

        $user = $request->user();

        $group = Group::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'visibility' => $validated['visibility'] ?? 'public',
            'created_by' => $user->id,
        ]);

        GroupMember::create([
            'group_id' => $group->id,
            'user_id' => $user->id,
            'role' => 'admin',
            'joined_at' => now(),
        ]);

        $group->loadCount('members');
        $this->hydrateGroupMetrics(collect([$group]));

        $payload = [
            'success' => true,
            'message' => 'Group created successfully.',
            'group' => $group,
            'redirect' => route('member.social.groups.show', $group),
        ];

        if ($request->expectsJson()) {
            return response()->json($payload, 201);
        }

        return redirect($payload['redirect'])->with('status', $payload['message']);
    }

    public function show(Request $request, Group $group): View
    {
        $group->load([
            'members.user' => function ($query) {
                $query->select('id', 'name', 'image');
            },
            'creator',
        ])->loadCount('members');
        $this->hydrateGroupMetrics(collect([$group]));

        $isMember = $group->members->contains(function (GroupMember $member) use ($request) {
            return $member->user_id === $request->user()->id;
        });

        return view('frontend.social.groups.show', [
            'group' => $group,
            'isMember' => $isMember,
        ]);
    }

    public function edit(Request $request, Group $group): View
    {
        $this->ensureGroupAdmin($request, $group);

        return view('frontend.social.groups.edit', [
            'group' => $group,
        ]);
    }

    public function update(Request $request, Group $group): RedirectResponse|JsonResponse
    {
        $this->ensureGroupAdmin($request, $group);

        $validated = $request->validate([
            'name' => 'required|string|min:3|max:100',
            'description' => 'nullable|string|max:1000',
            'visibility' => 'nullable|in:public,private',
        ]);

        $group->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'visibility' => $validated['visibility'] ?? $group->visibility,
        ]);

        $message = 'Group updated successfully.';

        $group->refresh()->loadCount('members');
        $this->hydrateGroupMetrics(collect([$group]));

        if ($request->expectsJson()) {
            return response()->json([
                'success' => true,
                'message' => $message,
                'group' => $group,
            ]);
        }

        return redirect()
            ->route('member.social.groups.show', $group)
            ->with('status', $message);
    }

    public function aiRecommendations(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $groups = Group::query()
            ->withCount('members')
            ->whereDoesntHave('members', function ($query) use ($userId) {
                $query->where('user_id', $userId);
            })
            ->orderByDesc('members_count')
            ->limit(6)
            ->get();

        $this->hydrateGroupMetrics($groups);

        $recommendedGroups = $groups->map(function (Group $group) {
            return [
                'id' => $group->id,
                'name' => $group->name,
                'description' => Str::limit($group->description ?? 'No description yet.', 140),
                'members_count' => $group->members_count,
                'activity_score' => $group->activity_score,
            ];
        });

        return response()->json($recommendedGroups);
    }

    public function join(Request $request, Group $group): JsonResponse
    {
        $userId = $request->user()->id;

        if (GroupMember::where('group_id', $group->id)->where('user_id', $userId)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Already a member of this group.',
            ], 409);
        }

        GroupMember::create([
            'group_id' => $group->id,
            'user_id' => $userId,
            'role' => 'member',
            'joined_at' => now(),
        ]);

        $group->loadCount('members');
        $this->hydrateGroupMetrics(collect([$group]));

        return response()->json([
            'success' => true,
            'message' => 'Joined group successfully.',
            'members_count' => $group->members_count,
            'activity_score' => $group->activity_score,
            'recent_join_count' => $group->recent_join_count,
            'active_member_count' => $group->active_member_count,
        ]);
    }

    public function leave(Request $request, Group $group): JsonResponse
    {
        $userId = $request->user()->id;

        $membership = GroupMember::where('group_id', $group->id)
            ->where('user_id', $userId)
            ->first();

        if (! $membership) {
            return response()->json([
                'success' => false,
                'message' => 'Membership not found.',
            ], 404);
        }

        $adminCount = GroupMember::where('group_id', $group->id)
            ->where('role', 'admin')
            ->count();

        if ($membership->role === 'admin' && $adminCount <= 1) {
            return response()->json([
                'success' => false,
                'message' => 'Promote another admin before leaving the group.',
            ], 400);
        }

        $membership->delete();

        $group->loadCount('members');
        $this->hydrateGroupMetrics(collect([$group]));

        return response()->json([
            'success' => true,
            'message' => 'Left group successfully.',
            'members_count' => $group->members_count,
            'activity_score' => $group->activity_score,
            'recent_join_count' => $group->recent_join_count,
            'active_member_count' => $group->active_member_count,
        ]);
    }

    private function ensureGroupAdmin(Request $request, Group $group): void
    {
        if ($group->created_by !== $request->user()->id) {
            abort(403, 'Only group owners can perform this action.');
        }
    }

    private function hydrateGroupMetrics(Collection $groups): void
    {
        if ($groups->isEmpty()) {
            return;
        }

        $groupIds = $groups->pluck('id');
        $recentThreshold = Carbon::now()->subDays(14);
        $activeThreshold = Carbon::now()->subDays(60);

        $memberMetrics = GroupMember::query()
            ->select('group_id')
            ->selectRaw('COUNT(*) as total_members')
            ->selectRaw('SUM(CASE WHEN joined_at >= ? THEN 1 ELSE 0 END) as recent_joins', [$recentThreshold])
            ->selectRaw('SUM(CASE WHEN joined_at >= ? THEN 1 ELSE 0 END) as active_members', [$activeThreshold])
            ->selectRaw('MAX(joined_at) as last_join_at')
            ->whereIn('group_id', $groupIds)
            ->groupBy('group_id')
            ->get()
            ->keyBy('group_id');

        foreach ($groups as $group) {
            $stats = $memberMetrics->get($group->id);

            $totalMembers = (int) ($stats->total_members ?? ($group->members_count ?? 0));
            $recentJoins = (int) ($stats->recent_joins ?? 0);
            $activeMembers = (int) ($stats->active_members ?? 0);
            $lastJoinAt = isset($stats->last_join_at) ? Carbon::parse($stats->last_join_at) : null;
            $lastActivity = $this->resolveLastActivityTimestamp($group, $lastJoinAt);

            $activityScore = $this->calculateActivityScore($totalMembers, $recentJoins, $activeMembers, $lastActivity);

            $group->setAttribute('members_count', $totalMembers);
            $group->setAttribute('recent_join_count', $recentJoins);
            $group->setAttribute('active_member_count', $activeMembers);
            $group->setAttribute('last_engagement_at', $lastActivity);
            $group->setAttribute('activity_score', $activityScore);
        }
    }

    private function calculateActivityScore(int $totalMembers, int $recentJoins, int $activeMembers, ?CarbonInterface $lastActivity): int
    {
        if ($totalMembers <= 0) {
            $recentScore = 0;
            $activeScore = 0;
            $sizeScore = 5;
        } else {
            $recentRatio = min(1, $recentJoins / $totalMembers);
            $activeRatio = min(1, $activeMembers / $totalMembers);

            $recentScore = (int) round($recentRatio * 40);
            $activeScore = (int) round($activeRatio * 35);
            $sizeScore = (int) min(20, round(sqrt($totalMembers) * 4));
        }

        $freshnessScore = 10;

        if ($lastActivity) {
            $daysInactive = $lastActivity->diffInDays(now());
            $freshnessScore = max(0, 20 - ($daysInactive * 2));
        }

        $score = $recentScore + $activeScore + $sizeScore + $freshnessScore;

        return (int) min(100, max(10, $score));
    }

    private function resolveLastActivityTimestamp(Group $group, ?CarbonInterface $lastJoinAt): ?CarbonInterface
    {
        $lastActivity = $group->updated_at instanceof CarbonInterface ? $group->updated_at : null;

        if ($lastJoinAt && (! $lastActivity || $lastJoinAt->greaterThan($lastActivity))) {
            $lastActivity = $lastJoinAt;
        }

        return $lastActivity;
    }
}

