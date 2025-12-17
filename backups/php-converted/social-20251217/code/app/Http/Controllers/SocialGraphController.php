<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Http\Resources\SocialGraphContactResource;
use App\Models\SocialGraphContact;
use App\Services\Social\SocialCircleService;
use App\Services\Social\SocialGraphService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

final class SocialGraphController extends Controller
{
    public function __construct(
        private readonly SocialGraphService $graph,
        private readonly SocialCircleService $circle
    )
    {
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        Gate::forUser($user)->authorize('viewSocialGraph');

        $contacts = SocialGraphContact::query()
            ->where('user_id', $user->getKey())
            ->orderByDesc('last_interacted_at')
            ->orderBy('full_name')
            ->paginate((int) $request->integer('per_page', 25));

        return SocialGraphContactResource::collection($contacts)
            ->additional([
                'meta' => [
                    'current_page' => $contacts->currentPage(),
                    'per_page' => $contacts->perPage(),
                    'total' => $contacts->total(),
                    'last_page' => $contacts->lastPage(),
                    'generated_at' => now()->toIso8601String(),
                ],
                'links' => [
                    'first' => $contacts->url(1),
                    'last' => $contacts->url($contacts->lastPage()),
                    'prev' => $contacts->previousPageUrl(),
                    'next' => $contacts->nextPageUrl(),
                ],
            ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        Gate::forUser($user)->authorize('manageSocialGraph');

        $validated = $request->validate([
            'contacts' => ['required', 'array', 'min:1'],
            'contacts.*.email' => ['nullable', 'email:rfc'],
            'contacts.*.phone' => ['nullable', 'string', 'max:32'],
            'contacts.*.full_name' => ['nullable', 'string', 'max:255'],
            'contacts.*.given_name' => ['nullable', 'string', 'max:255'],
            'contacts.*.family_name' => ['nullable', 'string', 'max:255'],
            'contacts.*.tags' => ['nullable', 'array'],
            'contacts.*.context' => ['nullable', 'array'],
            'contacts.*.relationship_strength' => ['nullable', 'integer', 'between:0,100'],
            'contacts.*.last_interacted_at' => ['nullable', 'date'],
            'source' => ['required', 'string', 'max:64'],
            'consent.granted_at' => ['nullable', 'date'],
            'consent.method' => ['nullable', 'string', 'max:64'],
            'consent.scope' => ['nullable', 'string', 'max:255'],
            'consent.reference' => ['nullable', 'string', 'max:255'],
        ]);

        $result = $this->graph->importContacts($user, $validated['contacts'], $validated['source'], $validated['consent'] ?? null);

        return response()->json([
            'data' => $result,
        ]);
    }

    public function recommendations(Request $request): JsonResponse
    {
        $user = $request->user();
        Gate::forUser($user)->authorize('viewSocialGraph');

        $validated = $request->validate([
            'limit' => ['nullable', 'integer', 'between:1,40'],
        ]);

        $recommendations = $this->graph->recommendations($user, (int) ($validated['limit'] ?? 12));

        return response()->json([
            'data' => $recommendations,
        ]);
    }

    public function invite(Request $request, SocialGraphContact $contact): JsonResponse
    {
        $user = $request->user();

        Gate::forUser($user)->authorize('manageSocialGraph');

        if ($contact->user_id !== $user->getKey()) {
            abort(404);
        }

        $validated = $request->validate([
            'channel' => ['nullable', Rule::in(['email', 'sms'])],
            'message' => ['nullable', 'string', 'max:2000'],
            'note' => ['nullable', 'string', 'max:500'],
            'context' => ['nullable', 'string', 'max:500'],
            'tags' => ['nullable', 'array'],
        ]);

        $invite = $this->graph->sendInviteForContact($user, $contact, $validated);

        return response()->json([
            'data' => [
                'invite_id' => $invite->getKey(),
                'status' => $invite->status,
            ],
        ]);
    }

    public function circle(Request $request): JsonResponse
    {
        $user = $request->user();
        Gate::forUser($user)->authorize('viewSocialGraph');

        $circle = $this->circle->findCircle($user);

        return response()->json([
            'data' => $circle,
        ]);
    }
}

