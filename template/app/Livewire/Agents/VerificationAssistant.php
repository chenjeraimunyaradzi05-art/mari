<?php

declare(strict_types=1);

namespace App\Livewire\Agents;

use App\Services\WomenRealEstate\WomenVerificationAssistantService;
use App\Support\Livewire\FallbackComponent;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;

trait VerificationAssistantBehavior
{
    public array $context = [];

    public array $messages = [];

    public array $suggestions = [];

    public string $prompt = '';

    public bool $busy = false;

    public function mount(array $context = []): void
    {
        $this->context = $this->sanitiseContext($context);
        $this->messages = [[
            'role' => 'assistant',
            'content' => 'Kia ora! I\'m your WomenRise assistant. Ask anything about documents, timelines, or what happens next.',
        ]];
        $this->suggestions = $this->defaultSuggestions();
    }

    public function updatedContext(): void
    {
        $this->context = $this->sanitiseContext($this->context);
    }

    public function send(): void
    {
        if ($this->busy) {
            return;
        }

        $this->validate([
            'prompt' => ['required', 'string', 'max:500'],
        ]);

        $question = trim($this->prompt);

        if ($question === '') {
            return;
        }

        $this->messages[] = [
            'role' => 'agent',
            'content' => $question,
        ];

        $this->busy = true;

        $assistant = app(WomenVerificationAssistantService::class);
        $response = $assistant->respond(Auth::user(), $this->context, $question);

        $this->messages[] = [
            'role' => 'assistant',
            'content' => $response['reply'] ?? 'Here to help whenever you need guidance on verification.',
            'confidence' => $response['confidence'] ?? null,
        ];

        $this->suggestions = $response['follow_ups'] ?? $this->defaultSuggestions();

        $this->prompt = '';
        $this->busy = false;
    }

    public function askSuggestion(string $suggestion): void
    {
        $this->prompt = $suggestion;
        $this->send();
    }

    public function render()
    {
        return view('livewire.agents.verification-assistant');
    }

    private function sanitiseContext(array $context): array
    {
        $present = array_filter((array) Arr::get($context, 'documents_present', []));
        $missing = array_filter((array) Arr::get($context, 'documents_missing', []));

        return [
            'step' => (string) Arr::get($context, 'step', 'profile'),
            'regulator' => $this->nullIfEmpty(Arr::get($context, 'regulator')),
            'license_expires_at' => $this->nullIfEmpty(Arr::get($context, 'license_expires_at')),
            'documents_present' => array_values($present),
            'documents_missing' => array_values(array_diff($missing, $present)),
        ];
    }

    private function nullIfEmpty($value): ?string
    {
        $value = is_string($value) ? trim($value) : $value;

        return $value === null || $value === '' ? null : (string) $value;
    }

    private function defaultSuggestions(): array
    {
        return [
            'What documents do I need to upload?',
            'How long does verification usually take?',
            'What happens after I submit my application?',
        ];
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

final class VerificationAssistant extends LivewireComponent
{
    use VerificationAssistantBehavior;
}

