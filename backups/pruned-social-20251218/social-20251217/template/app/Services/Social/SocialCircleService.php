<?php

namespace App\Services\Social;

use App\Models\Candidate;
use App\Models\User;
use Illuminate\Support\Collection;

final class SocialCircleService
{
    /**
     * @psalm-return Collection<int, array{user_id: int, name: string, avatar: mixed, reason: 'Shared Workplace', context: Collection<int, mixed>}>|Collection<never, never>|\Illuminate\Database\Eloquent\Collection<int, array{user_id: int, name: string, avatar: mixed, reason: 'Shared Workplace', context: Collection<int, mixed>}>
     */
    public function findColleagues(User $user, int $limit = 10): Collection|\Illuminate\Database\Eloquent\Collection
    {
        $candidate = $user->candidate;

        if (! $candidate) {
            return collect();
        }

        $companies = $candidate->experiences()
            ->pluck('company')
            ->filter()
            ->unique();

        if ($companies->isEmpty()) {
            return collect();
        }

        // Find candidates who worked at the same companies
        // We load the user relation to get the name
        return Candidate::query()
            ->where('id', '!=', $candidate->id)
            ->whereHas('experiences', function ($query) use ($companies) {
                $query->whereIn('company', $companies);
            })
            ->with(['user', 'experiences' => function ($query) use ($companies) {
                $query->whereIn('company', $companies);
            }])
            ->limit($limit)
            ->get()
            ->map(function ($match) use ($companies) {
                $sharedCompanies = $match->experiences
                    ->whereIn('company', $companies)
                    ->pluck('company')
                    ->unique()
                    ->values();

                return [
                    'user_id' => $match->user_id,
                    'name' => $match->full_name ?? $match->user->name,
                    'avatar' => $match->user->profile_photo_url, // Assuming Jetstream/Fortify
                    'reason' => 'Shared Workplace',
                    'context' => $sharedCompanies,
                ];
            });
    }

    /**
     * @psalm-return Collection<int, array{user_id: int, name: string, avatar: mixed, reason: 'Shared Location', context: null|string}>|Collection<never, never>|\Illuminate\Database\Eloquent\Collection<int, array{user_id: int, name: string, avatar: mixed, reason: 'Shared Location', context: null|string}>
     */
    public function findNeighbors(User $user, int $limit = 10): Collection|\Illuminate\Database\Eloquent\Collection
    {
        $candidate = $user->candidate;

        if (! $candidate || ! $candidate->city) {
            return collect();
        }

        return Candidate::query()
            ->where('id', '!=', $candidate->id)
            ->where('city', $candidate->city)
            ->with(['user', 'candidateCity'])
            ->limit($limit)
            ->get()
            ->map(function ($match) {
                return [
                    'user_id' => $match->user_id,
                    'name' => $match->full_name ?? $match->user->name,
                    'avatar' => $match->user->profile_photo_url,
                    'reason' => 'Shared Location',
                    'context' => $match->candidateCity?->name,
                ];
            });
    }

    /**
     * @psalm-return Collection<int, array{user_id: int, name: string, avatar: mixed, reason: 'School Alumni', context: Collection<int, mixed>}>|Collection<never, never>|\Illuminate\Database\Eloquent\Collection<int, array{user_id: int, name: string, avatar: mixed, reason: 'School Alumni', context: Collection<int, mixed>}>
     */
    public function findAlumni(User $user, int $limit = 10): Collection|\Illuminate\Database\Eloquent\Collection
    {
        $candidate = $user->candidate;

        if (! $candidate) {
            return collect();
        }

        $institutions = $candidate->educations()
            ->pluck('institution')
            ->filter()
            ->unique();

        if ($institutions->isEmpty()) {
            return collect();
        }

        return Candidate::query()
            ->where('id', '!=', $candidate->id)
            ->whereHas('educations', function ($query) use ($institutions) {
                $query->whereIn('institution', $institutions);
            })
            ->with(['user', 'educations' => function ($query) use ($institutions) {
                $query->whereIn('institution', $institutions);
            }])
            ->limit($limit)
            ->get()
            ->map(function ($match) use ($institutions) {
                $sharedInstitutions = $match->educations
                    ->whereIn('institution', $institutions)
                    ->pluck('institution')
                    ->unique()
                    ->values();

                return [
                    'user_id' => $match->user_id,
                    'name' => $match->full_name ?? $match->user->name,
                    'avatar' => $match->user->profile_photo_url,
                    'reason' => 'School Alumni',
                    'context' => $sharedInstitutions,
                ];
            });
    }

    /**
     * @psalm-return Collection<int, mixed>
     */
    public function findCircle(User $user, int $limit = 20): Collection
    {
        $colleagues = $this->findColleagues($user, $limit);
        $neighbors = $this->findNeighbors($user, $limit);
        $alumni = $this->findAlumni($user, $limit);

        return $colleagues
            ->merge($neighbors)
            ->merge($alumni)
            ->unique('user_id')
            ->values();
    }
}

