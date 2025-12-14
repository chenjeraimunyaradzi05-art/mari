<?php

namespace App\Http\Controllers\Api\Wellbeing;

use App\Http\Controllers\Controller;
use App\Models\WellbeingEvent;
use App\Support\Wellbeing\WellbeingInterestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

final class WellbeingEventController extends Controller
{
    public function __construct(private readonly WellbeingInterestService $interestService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user, 403);

        $interest = $request->query('interest');

        if (! $interest) {
            $tags = $user->wellbeingProfile
                ? $this->interestService->tagsFromProfile($user->wellbeingProfile)
                : $this->interestService->inferFromUser($user);
            $interest = $this->interestService->preferredInterest($tags);
        }

        $query = WellbeingEvent::query()->relevantToInterest($interest);

        if ($type = $request->query('type')) {
            $query->where('type', $type);
        }

        if ($mode = $request->query('mode')) {
            $query->where('mode', $mode);
        }

        if ($request->boolean('body_positive')) {
            $query->where('is_body_positive', true);
        }

        if ($request->boolean('adaptive')) {
            $query->where('is_adaptive', true);
        }

        if ($request->boolean('dv_safe')) {
            $query->where('is_dv_safe', true);
        }

        if ($request->boolean('prenatal_postnatal')) {
            $query->where('is_prenatal_postnatal', true);
        }

        if ($region = $request->query('region')) {
            $query->where(function ($sub) use ($region) {
                $sub->whereNull('location_region')
                    ->orWhere('location_region', 'like', '%' . $region . '%');
            });
        }

        if ($after = $request->query('after')) {
            $afterDate = Carbon::parse($after, $user->timezone ?? config('app.timezone'));
            $query->where(function ($sub) use ($afterDate) {
                $sub->whereNull('starts_at')->orWhere('starts_at', '>=', $afterDate);
            });
        }

        $limit = min(max((int) $request->query('limit', 30), 1), 100);

        $events = $query
            ->orderByRaw('COALESCE(starts_at, created_at) asc')
            ->limit($limit)
            ->get()
            ->map(function (WellbeingEvent $event) use ($user) {
                $startsAt = $event->starts_at?->copy()->timezone($user->timezone ?? config('app.timezone'));

                return array_merge($event->toArray(), [
                    'starts_at_human' => $startsAt?->format('D d M • g:ia'),
                ]);
            });

        return response()->json([
            'events' => $events,
        ]);
    }
}

