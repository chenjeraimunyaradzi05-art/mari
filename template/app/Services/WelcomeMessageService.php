<?php

namespace App\Services;

use App\Models\User;
use App\Support\AthenaPillarService;
use Illuminate\Support\Collection;

final class WelcomeMessageService
{
    public function __construct(private \App\Support\AthenaPillarService $pillarService)
    {
    }


    /**
     * @return (array|bool|string)[]
     *
     * @psalm-return array{greeting: string, message: string, focus: array, is_first_login: bool}
     */
    public function buildPayload(User $user, Collection $interests): array
    {
        return [
            'greeting' => $this->buildGreeting($user),
            'message' => $this->buildMessage($user),
            'focus' => $this->pillarService->focusDetails($user, $interests),
            'is_first_login' => (bool) $user->first_login,
        ];
    }

    private function buildGreeting(User $user): array|string|null
    {
        $name = $user->preferred_name ?: $user->name;
        $timeOfDay = $this->timeOfDay();
        $pronouns = trim($user->formatted_pronouns ?? '');
        $suffix = $pronouns ? ' ' . $pronouns : '';

        return __('Good :time, :name :suffix', [
            'time' => $timeOfDay,
            'name' => $name,
            'suffix' => $suffix,
        ]);
    }

    private function buildMessage(User $user): string
    {
        $messages = [
            __('You are valued, capable, and deserving of every opportunity ahead.'),
            __('Athena keeps respectful monitoring on standby so you can move at your own pace.'),
            __('Your goals anchor this dashboard—we will only surface nudges that align with your consent.'),
        ];

        $index = $user->id % count($messages);

        return $messages[$index];
    }

    private function timeOfDay(): array|string|null
    {
        $hour = now()->timezone(config('app.timezone'))->hour;

        return match (true) {
            $hour < 12 => __('morning'),
            $hour < 17 => __('afternoon'),
            default => __('evening'),
        };
    }
}

