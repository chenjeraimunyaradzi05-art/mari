<?php

namespace App\Http\Controllers\Api\Wellbeing;

use App\Http\Controllers\Controller;
use App\Models\WellbeingPartnerOffer;
use App\Support\Wellbeing\WellbeingInterestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

final class WellbeingPartnerOfferController extends Controller
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

        $offers = WellbeingPartnerOffer::query()
            ->active()
            ->relevantToInterest($interest)
            ->orderByDesc('priority')
            ->orderBy('brand')
            ->limit(12)
            ->get()
            ->map(function (WellbeingPartnerOffer $offer) {
                return array_merge($offer->toArray(), [
                    'validity_notice' => $this->validityNotice($offer),
                ]);
            });

        return response()->json([
            'offers' => $offers,
        ]);
    }

    private function validityNotice(WellbeingPartnerOffer $offer): string|null
    {
        if ($offer->valid_until) {
            $date = $offer->valid_until instanceof Carbon
                ? $offer->valid_until
                : Carbon::parse($offer->valid_until);

            return 'Valid until ' . $date->format('j M Y');
        }

        if ($offer->valid_from) {
            $date = $offer->valid_from instanceof Carbon
                ? $offer->valid_from
                : Carbon::parse($offer->valid_from);

            return 'Available from ' . $date->format('j M Y');
        }

        return null;
    }
}

