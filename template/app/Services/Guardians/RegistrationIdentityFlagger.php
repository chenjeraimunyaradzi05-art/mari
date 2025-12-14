<?php

namespace App\Services\Guardians;

use App\Enums\IdentityFlagStatus;
use App\Models\AIClientAlert;
use App\Models\Admin;
use App\Models\IdentityFlag;
use App\Models\User;
use App\Support\InAppNotifier;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Spatie\Permission\Exceptions\RoleDoesNotExist;

final class RegistrationIdentityFlagger
{
    private array $config = [];

    public function __construct()
    {
        $this->config = $this->resolveConfig();
    }
    private const NAME_WEIGHT = 0.25;
    private const TITLE_WEIGHT = 0.2;
    private const EMAIL_WEIGHT = 0.2;
    private static bool $reportedConfigFallback = false;

    private function resolveConfig(): array
    {
        $configured = config('guardian.male_detection');

        if (is_array($configured) && $configured !== []) {
            return $configured;
        }

        $fallbackPath = base_path('config/guardian.php');
        if (is_file($fallbackPath)) {
            $raw = require $fallbackPath;
            $resolved = $raw['male_detection'] ?? [];

            if ($configured === null && $resolved !== [] && ! self::$reportedConfigFallback) {
                Log::warning('Guardian config cache missing male detection block, using file fallback.');
                self::$reportedConfigFallback = true;
            }

            return is_array($resolved) ? $resolved : [];
        }

        if (! self::$reportedConfigFallback) {
            Log::warning('Guardian male detection config missing; defaulting to empty configuration.');
            self::$reportedConfigFallback = true;
        }

        return [];
    }

    public function handle(User $user, array $registrationPayload = []): IdentityFlag|null
    {
        if (! ($this->config['enabled'] ?? false)) {
            return null;
        }

        $signals = [];
        $score = 0.0;

        [$pronounScore, $pronounTriggered] = $this->scorePronouns($registrationPayload, $signals);
        $score += $pronounScore;

        [$nameScore, $nameTriggered] = $this->scoreName($registrationPayload, $signals);
        $score += $nameScore;

        [$emailScore, $emailTriggered] = $this->scoreEmail($registrationPayload, $signals);
        $score += $emailScore;

        $score += $this->scoreAccountType(
            $registrationPayload,
            $signals,
            $pronounTriggered || $nameTriggered || $emailTriggered
        );

        $notifyThreshold = (float) ($this->config['notify_threshold'] ?? 0.45);

        if ($score < $notifyThreshold) {
            return null;
        }

        $severity = $this->severityForScore($score);
        $actionsTaken = $this->applyAutoActions($user, $severity);

        $flag = IdentityFlag::query()->create([
            'user_id' => $user->getKey(),
            'source' => 'registration',
            'type' => 'male_signal',
            'status' => IdentityFlagStatus::Pending,
            'severity' => $severity,
            'score' => round($score, 2),
            'reason' => 'Male-signal heuristics triggered during registration.',
            'signals' => $signals,
            'metadata' => $this->buildMetadata($user, $registrationPayload),
            'actions_taken' => empty($actionsTaken) ? null : $actionsTaken,
            'flagged_at' => now(),
        ]);

        $this->recordOnboardingEvent($user, $flag);
        $this->notifyGuardians($flag);
        $this->broadcastAiAlert($flag);

        return $flag;
    }

    /**
     * @return (bool|float)[]
     *
     * @psalm-return list{float, bool}
     */
    private function scorePronouns(array $payload, array &$signals): array
    {
        $pronoun = Str::of((string) ($payload['pronouns'] ?? ''))->trim()->lower()->value();
        $weight = (float) ($this->config['pronoun_weights'][$pronoun] ?? 0);

        if ($weight <= 0) {
            return [0.0, false];
        }

        $signals[] = [
            'key' => 'pronouns',
            'value' => $pronoun,
            'score' => $weight,
            'summary' => 'Registration selected male-coded pronouns.',
        ];

        return [$weight, true];
    }

    /**
     * @return (bool|float)[]
     *
     * @psalm-return list{float, bool}
     */
    private function scoreName(array $payload, array &$signals): array
    {
        $rawName = Str::of((string) ($payload['name'] ?? ''))->ascii()->lower()->replace(['.', ','], ' ')->squish()->value();

        if ($rawName === '') {
            return [0.0, false];
        }

        $tokens = array_values(array_filter(explode(' ', $rawName)));
        if (empty($tokens)) {
            return [0.0, false];
        }

        $titleTokens = $this->normalisedList($this->config['title_tokens'] ?? []);
        $maleNames = $this->normalisedList($this->config['name_tokens'] ?? []);

        $triggered = false;
        $score = 0.0;

        $firstToken = $tokens[0];
        if (in_array($firstToken, $titleTokens, true)) {
            $signals[] = [
                'key' => 'name.title',
                'value' => $firstToken,
                'score' => self::TITLE_WEIGHT,
                'summary' => 'Name used a masculine honorific/title.',
            ];
            $score += self::TITLE_WEIGHT;
            $triggered = true;
            array_shift($tokens);
        }

        $firstName = $tokens[0] ?? $firstToken;
        if ($firstName && in_array($firstName, $maleNames, true)) {
            $signals[] = [
                'key' => 'name.dataset_match',
                'value' => $firstName,
                'score' => self::NAME_WEIGHT,
                'summary' => 'First name matches male-coded dataset.',
            ];
            $score += self::NAME_WEIGHT;
            $triggered = true;
        }

        return [$score, $triggered];
    }

    /**
     * @return (bool|float)[]
     *
     * @psalm-return list{float, bool}
     */
    private function scoreEmail(array $payload, array &$signals): array
    {
        $email = Str::of((string) ($payload['email'] ?? ''))->lower()->value();
        if (! Str::contains($email, '@')) {
            return [0.0, false];
        }

        [$local] = explode('@', $email, 2);
        $local = (string) $local;
        $tokens = $this->normalisedList($this->config['email_tokens'] ?? []);

        if ($local === '' || empty($tokens)) {
            return [0.0, false];
        }

        foreach ($tokens as $token) {
            if ($token !== '' && Str::contains($local, $token)) {
                $signals[] = [
                    'key' => 'email.handle',
                    'value' => $token,
                    'score' => self::EMAIL_WEIGHT,
                    'summary' => 'Email handle contains male-coded keyword.',
                ];

                return [self::EMAIL_WEIGHT, true];
            }
        }

        return [0.0, false];
    }

    private function scoreAccountType(array $payload, array &$signals, bool $alreadySuspicious): float
    {
        if (! $alreadySuspicious) {
            return 0.0;
        }

        $account = Str::of((string) ($payload['account_type'] ?? ''))->lower()->value();
        $allowed = $this->normalisedList($this->config['ally_account_types'] ?? []);

        if ($account === '' || ! in_array($account, $allowed, true)) {
            return 0.0;
        }

        $penalty = (float) ($this->config['ally_account_penalty'] ?? 0.15);
        $signals[] = [
            'key' => 'account_type',
            'value' => $account,
            'score' => $penalty,
            'summary' => 'Employer/provider role selected while male signals present.',
        ];

        return $penalty;
    }

    private function severityForScore(float $score): string
    {
        $autoHold = (float) ($this->config['auto_hold_threshold'] ?? 0.8);

        if ($score >= $autoHold) {
            return 'high';
        }

        if ($score >= ($autoHold - 0.2)) {
            return 'medium';
        }

        return 'low';
    }

    /**
     * @return string[][]
     *
     * @psalm-return list{0?: array{type: 'participant_profile_type', value: 'guardian_hold', summary: 'Auto hold applied pending guardian approval.'}}
     */
    private function applyAutoActions(User $user, string $severity): array
    {
        $actions = [];

        if ($severity === 'high' && $this->applyGuardianHold($user)) {
            $actions[] = [
                'type' => 'participant_profile_type',
                'value' => 'guardian_hold',
                'summary' => 'Auto hold applied pending guardian approval.',
            ];
        }

        return $actions;
    }

    private function applyGuardianHold(User $user): bool
    {
        if ($user->participant_profile_type === 'guardian_hold') {
            return false;
        }

        $user->forceFill(['participant_profile_type' => 'guardian_hold'])->save();
        Log::info('Guardian hold applied to user pending review.', [
            'user_id' => $user->getKey(),
        ]);

        return true;
    }

    /**
     * @return (mixed|string)[]
     *
     * @psalm-return array<string, mixed|string>
     */
    private function buildMetadata(User $user, array $payload): array
    {
        $email = Str::of((string) ($payload['email'] ?? ''))->lower()->value();
        $domain = Str::contains($email, '@') ? Str::after($email, '@') : null;

        return array_filter([
            'user_id' => $user->getKey(),
            'account_type' => $payload['account_type'] ?? null,
            'intent' => $payload['intent'] ?? null,
            'ip' => $payload['ip'] ?? null,
            'user_agent' => $payload['user_agent'] ?? null,
            'email_domain' => $domain,
        ], fn ($value) => $value !== null && $value !== '');
    }

    private function recordOnboardingEvent(User $user, IdentityFlag $flag): void
    {
        try {
            $user->onboardingEvents()->create([
                'action' => 'identity_flag_created',
                'payload' => [
                    'flag_id' => $flag->getKey(),
                    'score' => $flag->score,
                    'severity' => $flag->severity,
                    'source' => $flag->source,
                ],
                'occurred_at' => now(),
            ]);
        } catch (\Throwable $exception) {
            Log::warning('Failed to persist onboarding event for identity flag.', [
                'flag_id' => $flag->getKey(),
                'exception' => $exception->getMessage(),
            ]);
        }
    }

    private function notifyGuardians(IdentityFlag $flag): void
    {
        $roles = Arr::wrap($this->config['guardian_roles'] ?? ['guardian', 'guardian_team']);
        if (empty($roles)) {
            return;
        }

        try {
            $admins = Admin::query()->role($roles)->get(['id']);
        } catch (RoleDoesNotExist $exception) {
            Log::notice('Guardian roles missing; unable to alert admins.', [
                'roles' => $roles,
                'exception' => $exception->getMessage(),
            ]);

            return;
        }

        foreach ($admins as $admin) {
            InAppNotifier::notifyAdmin($admin->id, 'guardian.identity_flagged', [
                'flag_id' => $flag->getKey(),
                'user_id' => $flag->user_id,
                'severity' => $flag->severity,
                'score' => $flag->score,
            ]);
        }
    }

    private function broadcastAiAlert(IdentityFlag $flag): void
    {
        try {
            AIClientAlert::query()->create([
                'source' => 'guardian.identity',
                'severity' => $flag->severity === 'high' ? 'critical' : 'warning',
                'message' => sprintf('Registration flagged for user #%d', $flag->user_id),
                'context' => [
                    'flag_id' => $flag->getKey(),
                    'user_id' => $flag->user_id,
                    'score' => $flag->score,
                    'signals' => $flag->signals,
                ],
                'received_at' => now(),
            ]);
        } catch (\Throwable $exception) {
            Log::warning('Failed to broadcast AI client alert for identity flag.', [
                'flag_id' => $flag->getKey(),
                'exception' => $exception->getMessage(),
            ]);
        }
    }

    /**
     * @return string[]
     *
     * @psalm-return list<non-falsy-string>
     */
    private function normalisedList(array $values): array
    {
        return array_values(array_filter(array_map(
            static fn ($value) => Str::of((string) $value)->lower()->ascii()->squish()->value(),
            $values
        )));
    }
}

