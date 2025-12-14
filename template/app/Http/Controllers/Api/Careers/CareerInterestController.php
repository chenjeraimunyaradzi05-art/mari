<?php

namespace App\Http\Controllers\Api\Careers;

use App\Http\Controllers\Controller;
use App\Jobs\WarmCandidateJobMatches;
use App\Models\CareerInterest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class CareerInterestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $interests = CareerInterest::where('user_id', $user->id)
            ->latest()
            ->get();

        return response()->json([
            'interests' => $interests,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->buildPayload($request);

        $interest = CareerInterest::create([
            'user_id' => $request->user()->id,
        ] + $data);

        $this->queueWarmScan($interest);

        return response()->json([
            'interest' => $interest,
            'message' => 'Dream opportunity saved.',
        ], 201);
    }

    public function update(Request $request, CareerInterest $interest): JsonResponse
    {
        $this->authorizeOwner($request, $interest);

        $interest->update($this->buildPayload($request));

        $this->queueWarmScan($interest);

        return response()->json([
            'interest' => $interest->fresh(),
            'message' => 'Dream opportunity updated.',
        ]);
    }

    public function destroy(Request $request, CareerInterest $interest): JsonResponse
    {
        $this->authorizeOwner($request, $interest);

        $interest->delete();

        return response()->json([
            'message' => 'Dream opportunity removed.',
        ]);
    }

    /**
     * @return (bool|mixed)[]
     *
     * @psalm-return array{is_active: bool|mixed,...}
     */
    private function buildPayload(Request $request): array
    {
        $data = $this->validatedData($request);

        foreach ([
            'target_roles',
            'target_sectors',
            'preferred_locations_multi',
            'preferred_study_modes',
        ] as $arrayKey) {
            if (array_key_exists($arrayKey, $data)) {
                $data[$arrayKey] = $this->cleanArray($data[$arrayKey]);
            }
        }

        $data['is_active'] = ($data['status'] ?? 'active') === 'active'
            ? ($data['is_active'] ?? true)
            : false;

        return $data;
    }

    private function validatedData(Request $request): array
    {
        return $request->validate([
            'pathway_type' => ['required', Rule::in([
                'job',
                'apprenticeship',
                'traineeship',
                'trade',
                'tafe_course',
                'university_course',
                'public_sector',
                'other',
            ])],
            'title' => ['nullable', 'string', 'max:255'],
            'target_roles' => ['nullable', 'array', 'max:8'],
            'target_roles.*' => ['string', 'max:120'],
            'target_sectors' => ['nullable', 'array', 'max:8'],
            'target_sectors.*' => ['string', 'max:120'],
            'field' => ['nullable', 'string', 'max:255'],
            'industry' => ['nullable', 'string', 'max:255'],
            'level' => ['nullable', 'string', 'max:255'],
            'preferred_location' => ['nullable', 'string', 'max:255'],
            'preferred_locations_multi' => ['nullable', 'array', 'max:8'],
            'preferred_locations_multi.*' => ['string', 'max:255'],
            'preferred_study_modes' => ['nullable', 'array', 'max:5'],
            'preferred_study_modes.*' => ['string', 'max:50'],
            'open_to_remote' => ['required', 'boolean'],
            'min_pay_annual' => ['nullable', 'integer', 'min:0'],
            'max_pay_annual' => ['nullable', 'integer', 'min:0'],
            'timeline' => ['nullable', 'string', 'max:255'],
            'intake_window' => ['nullable', 'string', 'max:255'],
            'skills' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'support_needs' => ['nullable', 'string', 'max:2000'],
            'status' => ['required', Rule::in(['active', 'paused', 'fulfilled'])],
            'notify_in_app' => ['required', 'boolean'],
            'notify_email' => ['required', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }

    /**
     * @return (mixed|string)[]
     *
     * @psalm-return array<int, mixed|string>
     */
    private function cleanArray(?array $values): array
    {
        if (! is_array($values)) {
            return [];
        }

        return collect($values)
            ->map(function ($value) {
                if (is_string($value)) {
                    return trim($value);
                }

                return $value;
            })
            ->filter(fn ($value) => filled($value))
            ->values()
            ->all();
    }

    private function authorizeOwner(Request $request, CareerInterest $interest): void
    {
        abort_if($interest->user_id !== $request->user()->id, 403);
    }

    private function queueWarmScan(CareerInterest $interest): void
    {
        if (! $interest->is_active || (! $interest->notify_in_app && ! $interest->notify_email)) {
            return;
        }

        WarmCandidateJobMatches::dispatch($interest->getKey())
            ->delay(now()->addSeconds(10));
    }
}

