<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class IntentEvaluator
{
    private ?User $user;

    private Collection $capabilities;

    private bool $bypasses = false;

    public function __construct(?User $user)
    {
        $this->user = $user;
        $this->capabilities = collect([
            'intent' => collect(),
            'portal' => collect(),
            'wellness' => collect(),
            'role' => collect(),
        ]);

        if ($user) {
            $this->hydrate();
        }
    }

    public static function for(?User $user): self
    {
        return new self($user);
    }

    public function allowsRequirement(string $requirement): bool
    {
        if ($this->bypasses) {
            return true;
        }

        $parsed = $this->parseRequirement($requirement);

        return $this->allows($parsed['type'], $parsed['values']);
    }

    public function allowsContext(string $contextKey): bool
    {
        if ($this->bypasses) {
            return true;
        }

        $context = config("intent.contexts.{$contextKey}");

        if ($context === null) {
            return false;
        }

        $requirements = collect($context['requirements'] ?? [])
            ->filter()
            ->values();

        if ($requirements->isEmpty()) {
            return true;
        }

        return $requirements->contains(fn (string $requirement) => $this->allowsRequirement($requirement));
    }

    /**
     * @psalm-return Collection<int, array-key>
     */
    public function allowedContexts(): Collection
    {
        return collect(config('intent.contexts', []))
            ->keys()
            ->filter(fn (string $key) => $this->allowsContext($key))
            ->values();
    }

    public function bypassesChecks(): bool
    {
        return $this->bypasses;
    }

    private function hydrate(): void
    {
        $bypassRoles = collect(config('intent.bypass_roles', []))
            ->map(fn ($role) => is_string($role) ? trim($role) : null)
            ->filter()
            ->values()
            ->all();

        if (! empty($bypassRoles) && method_exists($this->user, 'hasAnyRole')) {
            $this->bypasses = $this->user->hasAnyRole($bypassRoles);
        }

        $intentions = $this->user->user_intentions ?? [];

        $intents = collect([$this->normalize(data_get($intentions, 'intent.value'))]);
        $portals = collect(data_get($intentions, 'desired_portals', []))
            ->map(fn ($portal) => $this->normalize(is_array($portal) ? ($portal['value'] ?? $portal['label'] ?? null) : $portal));
        $wellness = collect(data_get($intentions, 'wellness_preferences', []))
            ->map(fn ($preference) => $this->normalize(is_array($preference) ? ($preference['value'] ?? $preference['label'] ?? null) : $preference));

        $this->augmentFromAccountContext($intents, $portals);

        $this->capabilities->put('intent', $intents->filter()->unique()->values());
        $this->capabilities->put('portal', $portals->filter()->unique()->values());
        $this->capabilities->put('wellness', $wellness->filter()->unique()->values());

        $roles = collect([
            $this->normalize($this->user->primary_role ?? null),
            $this->normalize($this->user->role ?? null),
        ])->filter();

        $secondaryRoles = collect($this->user->secondary_roles ?? [])
            ->map(fn ($role) => $this->normalize($role))
            ->filter();

        $this->capabilities->put('role', $roles->merge($secondaryRoles)->unique()->values());
    }

    private function augmentFromAccountContext(Collection $intents, Collection $portals): void
    {
        $roleIntentMap = [
            // 'member' is the canonical role name; preserve candidate mapping for compatibility
            'candidate' => 'career_growth',
            'member' => 'career_growth',
            'company' => 'launch_business',
            'mentor' => 'community_support',
        ];

        $classificationPortalMap = [
            'real_estate' => 'real_estate',
            'business_network' => 'business',
            'financial_literacy' => 'financial_wellbeing',
            'financial_wellness' => 'financial_wellbeing',
            'public_sector' => 'public_sector',
            'tafe_university' => 'education',
        ];

        $role = $this->normalize($this->user->role ?? $this->user->primary_role);
        if ($role && isset($roleIntentMap[$role])) {
            $intents->push($this->normalize($roleIntentMap[$role]));
        }

        $classification = $this->normalize($this->user->account_classification ?? null);
        if ($classification && isset($classificationPortalMap[$classification])) {
            $portals->push($this->normalize($classificationPortalMap[$classification]));
        }

        if (! empty($this->user->real_estate_onboarded_at)) {
            $portals->push('real_estate');
        }
    }

    private function allows(string $type, array $values): bool
    {
        if ($values === []) {
            return true;
        }

        $available = $this->capabilities->get($type);

        if (! $available instanceof Collection) {
            return false;
        }

        return $available->intersect($values)->isNotEmpty();
    }

    /**
     * @return ((null|string)[]|string)[]
     *
     * @psalm-return array{type: string, values: array<int, null|string>}
     */
    private function parseRequirement(string $requirement): array
    {
        [$type, $valueExpression] = str_contains($requirement, ':')
            ? explode(':', $requirement, 2)
            : ['intent', $requirement];

        $values = collect(preg_split('/[|;]/', $valueExpression))
            ->map(fn ($value) => $this->normalize($value))
            ->filter()
            ->values()
            ->all();

        return [
            'type' => $type,
            'values' => $values,
        ];
    }

    private function normalize(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return (string) Str::of($value)
            ->lower()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_');
    }
}

