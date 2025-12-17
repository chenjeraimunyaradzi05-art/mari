<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Social\InviteDispatchService;
use App\Support\ActiveProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

final class SocialInviteController extends Controller
{
    public function __construct(private readonly InviteDispatchService $invites)
    {
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'recipients' => ['required', 'array', 'min:1'],
            'recipients.*.email' => ['nullable', 'email'],
            'recipients.*.phone' => ['nullable', 'string', 'max:40'],
            'recipients.*.note' => ['nullable', 'string', 'max:280'],
            'recipients.*.context' => ['nullable', 'string', 'max:120'],
            'recipients.*.type' => ['nullable', 'string', 'max:80'],
            'recipients.*.cohort_slug' => ['nullable', 'string', 'min:3', 'max:100', 'regex:/^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/'],
            'recipients.*.referral_code' => ['nullable', 'string', 'min:6', 'max:32', 'regex:/^[A-Za-z0-9_-]+$/'],
            'message' => ['nullable', 'string', 'max:500'],
            'org_slug' => ['nullable', 'string', 'max:120'],
            'tags' => ['nullable', 'array', 'max:5'],
            'tags.*' => ['string', 'max:50'],
            'channel' => ['nullable', 'in:email,sms,deeplink,share_link'],
            'template_key' => ['nullable', Rule::in(array_keys(config('social_invites.templates', [])))],
            'mentorship_cohort_id' => ['nullable', 'exists:mentorship_cohorts,id'],
            'cohort_slug' => ['nullable', 'string', 'min:3', 'max:100', 'regex:/^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/'],
            'referral_code' => ['nullable', 'string', 'min:6', 'max:32', 'regex:/^[A-Za-z0-9_-]+$/'],
        ]);

        $user = $request->user();
        $profile = ActiveProfile::forUser($user);

        try {
            $result = $this->invites->send($user, $profile, $data['recipients'], [
                'message' => $data['message'] ?? null,
                'org_slug' => $data['org_slug'] ?? null,
                'tags' => $data['tags'] ?? [],
                'channel' => $data['channel'] ?? null,
                'template_key' => $data['template_key'] ?? null,
                'mentorship_cohort_id' => $data['mentorship_cohort_id'] ?? null,
                'cohort_slug' => $data['cohort_slug'] ?? null,
                'referral_code' => $data['referral_code'] ?? null,
            ]);
        } catch (InvalidArgumentException $exception) {
            throw ValidationException::withMessages([
                'recipients' => [$exception->getMessage()],
            ]);
        }

        return response()->json([
            'ok' => true,
            'summary' => $result['summary'],
            'invites' => $result['invites']->map(fn ($invite) => [
                'id' => $invite->getKey(),
                'token' => $invite->token,
                'channel' => $invite->channel,
                'status' => $invite->status,
            ])->all(),
        ], 201);
    }

    public function accept(string $token, Request $request): JsonResponse
    {
        $invite = $this->invites->accept($token, $request->user());

        return response()->json([
            'ok' => true,
            'invite' => [
                'id' => $invite->getKey(),
                'status' => $invite->status,
                'accepted_at' => $invite->accepted_at,
                'channel' => $invite->channel,
            ],
        ]);
    }
}

