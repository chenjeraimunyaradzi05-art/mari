<?php

namespace App\Livewire;

use App\Services\PersonaNudgeService;
use App\Support\Analytics\DashboardCache;
use App\Support\Livewire\FallbackComponent;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Throwable;

trait DashboardPersonaEchoesBehavior
{
    public array $personas = [];

    public ?int $userId = null;

    public bool $refreshing = false;

    public ?string $errorMessage = null;

    protected function getListeners(): array
    {
        $listeners = [];

        if (method_exists(get_parent_class($this), 'getListeners')) {
            $listeners = parent::getListeners();
        }

        return array_merge($listeners, [
            'refresh-persona-echoes' => 'refreshPersonas',
        ]);
    }

    public function mount(array $personas = [], ?int $userId = null): void
    {
        $this->personas = $personas;
        $this->userId = $userId ?? Auth::id();
    }

    public function dismiss(string $personaId, PersonaNudgeService $service): void
    {
        $this->errorMessage = null;

        try {
            if (! $service->dismiss($personaId)) {
                $this->errorMessage = 'We could not snooze this persona right now. Please try again soon.';

                return;
            }
        } catch (Throwable $exception) {
            Log::warning('Failed to dismiss persona nudge', [
                'persona_id' => $personaId,
                'exception' => $exception->getMessage(),
            ]);
            $this->errorMessage = 'We could not snooze this persona right now. Please try again soon.';

            return;
        }

        $this->personas = Collection::make($this->personas)
            ->reject(fn (array $persona) => Arr::get($persona, 'id') === $personaId)
            ->values()
            ->all();

        if ($this->userId) {
            DashboardCache::flushPersonas($this->userId);
            $this->refreshPersonas($service);
        }
    }

    public function refreshPersonas(PersonaNudgeService $service): void
    {
        if (! $this->userId) {
            return;
        }

        $this->refreshing = true;
        $this->errorMessage = null;

        try {
            $payload = $service->fetchNudges($this->userId);
            $this->personas = Arr::get($payload, 'personas', []);
        } catch (Throwable $exception) {
            Log::warning('Failed to refresh persona nudges', [
                'user_id' => $this->userId,
                'exception' => $exception->getMessage(),
            ]);
            $this->errorMessage = 'We could not refresh persona nudges. Please retry shortly.';
        } finally {
            $this->refreshing = false;
        }
    }

    public function render()
    {
        return view('livewire.dashboard-persona-echoes');
    }
}

if (! class_exists(__NAMESPACE__.'\\LivewireComponent', false)) {
    if (class_exists('Livewire\\Component')) {
        class_alias('Livewire\\Component', __NAMESPACE__.'\\LivewireComponent');
    } else {
        class LivewireComponent extends FallbackComponent
        {
        }
    }
}

final class DashboardPersonaEchoes extends LivewireComponent
{
    use DashboardPersonaEchoesBehavior;
}

