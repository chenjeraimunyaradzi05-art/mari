<?php

namespace App\Console\Commands\Moderation;

use App\Models\SocialBlock;
use App\Models\SocialEnforcementAction;
use App\Models\SocialReport;
use App\Models\SocialTransparencyLog;
use App\Services\TransparencyLogService;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;

final class BackfillTransparencyLogsCommand extends Command
{
    protected $signature = 'moderation:transparency:backfill {--chunk=200} {--dry-run}';

    protected $description = 'Seed historical moderation activity into social_transparency_logs for regulator transparency.';

    protected function logExists(Model $subject, string $action): bool
    {
        return SocialTransparencyLog::query()
            ->where('action', $action)
            ->where('subject_type', $subject->getMorphClass())
            ->where('subject_id', $subject->getKey())
            ->exists();
    }
}

