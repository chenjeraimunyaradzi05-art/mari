<?php

declare(strict_types=1);

namespace App\Console\Commands\WomenRealEstate;

use App\Models\Admin;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

final class AssignVerificationReviewerRole extends Command
{
    protected $signature = 'women:verification:assign-reviewer
        {emails* : Email addresses of admin accounts to promote}';

    protected $description = 'Assign the Women Real Estate verification reviewer role to admin users.';

    /**
     * @psalm-return Collection<array-key, string>
     */
    private function configuredRoles(): Collection
    {
        return collect(config('women_real_estate.verification.reviewer_roles', []))
            ->map(static fn ($value) => trim((string) $value))
            ->filter()
            ->unique();
    }
}

