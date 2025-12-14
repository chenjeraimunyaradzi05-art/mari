<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        Schema::table('applied_jobs', function (Blueprint $table) {
            if (!$this->indexExists('applied_jobs', 'idx_applied_jobs_candidate_job')) {
                $table->index(['candidate_id', 'job_id'], 'idx_applied_jobs_candidate_job');
            }
            if (!$this->indexExists('applied_jobs', 'idx_applied_jobs_job_date')) {
                $table->index(['job_id', 'created_at'], 'idx_applied_jobs_job_date');
            }
        });

        Schema::table('candidate_cvs', function (Blueprint $table) {
            if (!$this->indexExists('candidate_cvs', 'idx_candidate_cvs_active')) {
                $table->index(['candidate_id', 'is_active'], 'idx_candidate_cvs_active');
            }
            if (!$this->indexExists('candidate_cvs', 'idx_candidate_cvs_public')) {
                $table->index(['is_public', 'created_at'], 'idx_candidate_cvs_public');
            }
        });

        Schema::table('jobs', function (Blueprint $table) {
            if (!$this->indexExists('jobs', 'idx_jobs_company_status')) {
                $table->index(['company_id', 'status', 'deadline'], 'idx_jobs_company_status');
            }
            if (!$this->indexExists('jobs', 'idx_jobs_category_status')) {
                $table->index(['job_category_id', 'status'], 'idx_jobs_category_status');
            }
            if (!$this->indexExists('jobs', 'idx_jobs_active_featured')) {
                $table->index(['status', 'featured', 'deadline'], 'idx_jobs_active_featured');
            }
        });

        Schema::table('candidates', function (Blueprint $table) {
            if (!$this->indexExists('candidates', 'idx_candidates_user_status')) {
                $table->index(['user_id', 'status'], 'idx_candidates_user_status');
            }
            if (!$this->indexExists('candidates', 'idx_candidates_profession')) {
                $table->index(['profession_id', 'status'], 'idx_candidates_profession');
            }
        });

        Schema::table('job_bookmarks', function (Blueprint $table) {
            if (!$this->indexExists('job_bookmarks', 'idx_bookmarks_candidate_job')) {
                $table->index(['candidate_id', 'job_id'], 'idx_bookmarks_candidate_job');
            }
        });
    }

    private function indexExists($table, $indexName)
    {
        if (DB::getDriverName() !== 'mysql') {
            return false;
        }

        $indexList = DB::select("SHOW INDEX FROM $table");
        foreach ($indexList as $index) {
            if ($index->Key_name === $indexName) {
                return true;
            }
        }
        return false;
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        Schema::table('applied_jobs', function (Blueprint $table) {
            $table->dropIndex('idx_applied_jobs_candidate_job');
            $table->dropIndex('idx_applied_jobs_job_date');
        });

        Schema::table('candidate_cvs', function (Blueprint $table) {
            $table->dropIndex('idx_candidate_cvs_active');
            $table->dropIndex('idx_candidate_cvs_public');
        });

        Schema::table('jobs', function (Blueprint $table) {
            $table->dropIndex('idx_jobs_company_status');
            $table->dropIndex('idx_jobs_category_status');
            $table->dropIndex('idx_jobs_active_featured');
        });

        Schema::table('candidates', function (Blueprint $table) {
            $table->dropIndex('idx_candidates_user_status');
            $table->dropIndex('idx_candidates_profession');
        });

        Schema::table('job_bookmarks', function (Blueprint $table) {
            $table->dropIndex('idx_bookmarks_candidate_job');
        });
    }
};
