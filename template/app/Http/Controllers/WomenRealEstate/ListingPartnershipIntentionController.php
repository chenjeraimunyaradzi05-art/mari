<?php

declare(strict_types=1);

namespace App\Http\Controllers\WomenRealEstate;

use App\Http\Controllers\Controller;
use App\Models\ListingPartnershipIntention;
use App\Models\WomenHousingListing;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

final class ListingPartnershipIntentionController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth', 'verified']);
    }

    public function store(Request $request, WomenHousingListing $listing): RedirectResponse
    {
        $this->authorize('create', [ListingPartnershipIntention::class, $listing]);

        $user = Auth::user();

        $existingActive = $listing->partnershipIntentions()
            ->active()
            ->where('initiator_user_id', $user->id)
            ->first();

        if ($existingActive) {
            return back()
                ->withErrors(['partnership' => 'You already have an active partnership intention for this listing.'])
                ->withInput();
        }

        $validated = $request->validate([
            'intent_type' => ['required', Rule::in(['co_rent', 'co_buy', 'co_develop'])],
            'budget_range_min_cents' => ['nullable', 'integer', 'min:0'],
            'budget_range_max_cents' => ['nullable', 'integer', 'min:0'],
            'preferred_finance_type' => ['nullable', Rule::in(['mortgage', 'cash', 'shared_equity', 'rent'])],
            'skills_offered' => ['nullable', 'string', 'max:500'],
            'availability_window' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        if (isset($validated['budget_range_min_cents'], $validated['budget_range_max_cents'])
            && $validated['budget_range_max_cents'] < $validated['budget_range_min_cents']) {
            $validated['budget_range_max_cents'] = null;
        }

        if (! empty($validated['skills_offered'])) {
            $skills = collect(explode(',', (string) $validated['skills_offered']))
                ->map(static fn (string $skill) => trim($skill))
                ->filter()
                ->values()
                ->all();
            $validated['skills_offered'] = $skills ?: null;
        }

        $validated['initiator_user_id'] = $user->id;

        $listing->partnershipIntentions()->create($validated);

        // @todo trigger notification and AI matchmaking pipeline.

        return redirect()
            ->route('women.real-estate.listings.show', $listing)
            ->with('status', 'Thanks! We will surface aligned co-investors as soon as we find them.');
    }

    public function destroy(WomenHousingListing $listing, ListingPartnershipIntention $intention): RedirectResponse
    {
        if ($intention->women_housing_listing_id !== $listing->id) {
            abort(404);
        }

        $this->authorize('delete', $intention);

        $intention->update(['status' => 'withdrawn']);

        return redirect()
            ->route('women.real-estate.listings.show', $listing)
            ->with('status', 'Your partnership intention has been withdrawn.');
    }
}

