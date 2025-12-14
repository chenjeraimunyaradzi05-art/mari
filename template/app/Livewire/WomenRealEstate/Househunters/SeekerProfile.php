<?php

declare(strict_types=1);

namespace App\Livewire\WomenRealEstate\Househunters;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Livewire\Attributes\Title;
use Livewire\Component;
use Throwable;

#[Title('Househunter Profile')]
final class SeekerProfile extends Component
{
    public array $profile = [];

    public array $preferences = [];

    public string $status = 'idle';

    public string $message = '';

    public bool $showForm = false;

    public function mount(): void
    {
        $this->loadProfile();
    }

    public function loadProfile(): void
    {
        try {
            $user = $this->resolveUser();

            if (! $user) {
                return;
            }

            $response = $user->apiRequest('GET', 'api/women/real-estate/seeker-profile');
            $this->profile = $response['data'] ?? [];
            $this->preferences = $this->profile['preferences'] ?? [];
            $this->broadcastProfileState();
        } catch (Throwable $exception) {
            report($exception);
            session()->flash('error', 'Failed to load profile');
        }
    }

    public function updateProfile(): void
    {
        $this->status = 'saving';

        try {
            $user = $this->resolveUser();

            if (! $user) {
                return;
            }

            $response = $user->apiRequest('POST', 'api/women/real-estate/seeker-profile', [
                'json' => [
                    'preferences' => $this->preferences,
                    'budget_min' => $this->preferences['budget_min'] ?? null,
                    'budget_max' => $this->preferences['budget_max'] ?? null,
                    'bedrooms' => $this->preferences['bedrooms'] ?? null,
                    'bathrooms' => $this->preferences['bathrooms'] ?? null,
                    'property_types' => $this->preferences['property_types'] ?? [],
                    'locations' => $this->preferences['locations'] ?? [],
                    'move_in_date' => $this->preferences['move_in_date'] ?? null,
                ],
            ]);

            $this->profile = $response['data'] ?? [];
            $this->status = 'success';
            $this->message = 'Profile updated successfully!';
            $this->showForm = false;

            $this->dispatch('profileUpdated', ['profile' => $this->profile]);
            $this->broadcastProfileState();
        } catch (Throwable $exception) {
            report($exception);
            $this->status = 'error';
            $this->message = 'Failed to update profile: '.$exception->getMessage();
        }
    }

    protected function broadcastProfileState(): void
    {
        $isComplete = ! empty($this->profile);
        $preferenceSignals = collect($this->preferences)
            ->filter(static fn ($value) => filled($value))
            ->count();

        $this->dispatch('realEstateProfileProgress', [
            'complete' => $isComplete,
            'signals' => $preferenceSignals,
        ]);
    }

    public function getMatches(): array
    {
        try {
            $user = $this->resolveUser();

            if (! $user) {
                return [];
            }

            $response = $user->apiRequest('GET', 'api/women/real-estate/seeker-matches');

            return $response['data'] ?? [];
        } catch (Throwable $exception) {
            report($exception);
            session()->flash('error', 'Failed to load matches');

            return [];
        }
    }

    public function render(): \Illuminate\Contracts\View\View
    {
        return view('livewire.women-real-estate.househunters.seeker-profile');
    }

    private function resolveUser(): ?User
    {
        $user = Auth::user();

        return $user instanceof User ? $user : null;
    }
}
