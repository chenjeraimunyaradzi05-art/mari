<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Schema\Blueprint;

return new class() extends Migration
{
    /**
     * Run the migrations.
     *
     * Converts users.role values from 'candidate' => 'member'.
     * To keep this reversible without affecting unrelated users we record
     * changed user ids in a temporary table and use that table in down().
     *
     * This migration is safe to run multiple times.
     */
    public function up(): void
    {
        try {
            if (! Schema::hasTable('candidate_to_member_user_backup')) {
                Schema::create('candidate_to_member_user_backup', function (Blueprint $table) {
                    $table->unsignedBigInteger('user_id')->primary();
                    $table->timestamp('migrated_at')->nullable();
                });
            }

            // Collect the users we will change so we can revert them later.
            $candidateIds = DB::table('users')->where('role', 'candidate')->pluck('id');

            if ($candidateIds->isNotEmpty()) {
                $now = now();
                $rows = $candidateIds->map(fn ($id) => ['user_id' => $id, 'migrated_at' => $now])->toArray();

                // Insert ignoring duplicates (if migration run multiple times)
                foreach (array_chunk($rows, 500) as $chunk) {
                    DB::table('candidate_to_member_user_backup')->upsert($chunk, ['user_id'], ['migrated_at']);
                }

                // Update roles
                DB::table('users')->where('role', 'candidate')->update(['role' => 'member']);
            }

            // No explicit commit — migrations are executed in an appropriate context.
        } catch (\Throwable $e) {
            // Let the migration process handle rollback/cleanup when appropriate.
            throw $e;
        }
    }

    /**
     * Reverse the migrations.
     *
     * Reverts only the user rows we changed in up() by reading the backup table.
     */
    public function down(): void
    {
        try {
            if (! Schema::hasTable('candidate_to_member_user_backup')) {
                // Nothing to revert
                DB::commit();
                return;
            }

            $ids = DB::table('candidate_to_member_user_backup')->pluck('user_id');

            if ($ids->isNotEmpty()) {
                // Revert only those users who are currently 'member'
                DB::table('users')
                    ->whereIn('id', $ids)
                    ->where('role', 'member')
                    ->update(['role' => 'candidate']);
            }

            Schema::dropIfExists('candidate_to_member_user_backup');

            // no explicit commit
        } catch (\Throwable $e) {
            throw $e;
        }
    }
};
