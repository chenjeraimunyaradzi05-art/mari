<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $roles = config('dashboard_roles.roles', []);

        foreach ($roles as $purpose => $definition) {
            $flag = $definition['feature_flag'] ?? null;

            if (! $flag) {
                continue;
            }

            DB::table('user_primary_purposes')
                ->where('primary_purpose', $purpose)
                ->orderBy('id')
                ->chunkById(250, function ($records) use ($flag) {
                    foreach ($records as $record) {
                        $flags = json_decode($record->feature_flags ?? '[]', true) ?? [];

                        if (in_array($flag, $flags, true)) {
                            continue;
                        }

                        $flags[] = $flag;

                        DB::table('user_primary_purposes')
                            ->where('id', $record->id)
                            ->update([
                                'feature_flags' => json_encode(array_values(array_unique($flags))),
                                'updated_at' => now(),
                            ]);
                    }
                });
        }
    }

    public function down(): void
    {
        // No down migration: telemetry depends on these flags being present.
    }
};
