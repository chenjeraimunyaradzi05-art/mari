<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\GrantFilterPreset;
use App\Models\User;
use Illuminate\Database\Seeder;

final class GrantFilterPresetSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::query()->first();
        if (! $user) {
            return;
        }

        GrantFilterPreset::firstOrCreate([
            'user_id' => $user->id,
            'name' => 'Default',
        ], ['filters' => $this->defaultFilters()]);
        return;
    }


    /**
     * @return (false|null)[]
     *
     * @psalm-return array{type: null, provider: null, industry: null, state: null, q: null, women_only: false, closing_soon: false}
     */
    private function defaultFilters(): array
    {
        return [
            'type' => null,
            'provider' => null,
            'industry' => null,
            'state' => null,
            'q' => null,
            'women_only' => false,
            'closing_soon' => false,
        ];
    }
}

