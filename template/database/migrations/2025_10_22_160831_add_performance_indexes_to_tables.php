<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Add performance indexes to frequently queried columns
     */
    public function up(): void
    {
        // Jobs table indexes
        Schema::table('jobs', function (Blueprint $table) {
            // Index for featured jobs query (show_at_featured + status + deadline)
            $table->index(['featured', 'status', 'deadline'], 'jobs_featured_status_deadline_idx');

            // Index for job listing searches (status + deadline for active jobs)
            $table->index(['status', 'deadline'], 'jobs_status_deadline_idx');

            // Index for company jobs (company_id + status)
            $table->index(['company_id', 'status'], 'jobs_company_status_idx');

            // Index for category filtering (job_category_id + status)
            $table->index(['job_category_id', 'status'], 'jobs_category_status_idx');

            // Index for slug lookups (already unique but explicit index helps)
            $table->index('slug', 'jobs_slug_idx');
        });

        // Job bookmarks table indexes
        Schema::table('job_bookmarks', function (Blueprint $table) {
            // Index for user bookmarks lookup
            $table->index('candidate_id', 'job_bookmarks_candidate_idx');

            // Composite index for checking if job is bookmarked by user
            $table->index(['candidate_id', 'job_id'], 'job_bookmarks_candidate_job_idx');
        });

        // Companies table indexes
        Schema::table('companies', function (Blueprint $table) {
            // Index for slug lookups
            $table->index('slug', 'companies_slug_idx');

            // Index for user lookup
            $table->index('user_id', 'companies_user_idx');
        });

        // Candidates table indexes
        Schema::table('candidates', function (Blueprint $table) {
            // Index for user lookup
            $table->index('user_id', 'candidates_user_idx');
        });

        // Job categories table indexes
        Schema::table('job_categories', function (Blueprint $table) {
            // Index for featured categories
            $table->index('show_at_featured', 'job_categories_featured_idx');

            // Index for popular categories
            $table->index('show_at_popular', 'job_categories_popular_idx');

            // Index for slug lookups
            $table->index('slug', 'job_categories_slug_idx');
        });

        // Orders table indexes
        Schema::table('orders', function (Blueprint $table) {
            // Index for company orders lookup
            $table->index('company_id', 'orders_company_idx');

            // Index for payment status queries
            $table->index('payment_status', 'orders_payment_status_idx');

            // Composite index for company + payment status
            $table->index(['company_id', 'payment_status'], 'orders_company_payment_idx');
        });

        // Applied jobs table indexes
        Schema::table('applied_jobs', function (Blueprint $table) {
            // Index for job applications lookup
            $table->index('job_id', 'applied_jobs_job_idx');

            // Index for candidate applications lookup
            $table->index('candidate_id', 'applied_jobs_candidate_idx');

            // Composite index for unique application check
            $table->index(['job_id', 'candidate_id'], 'applied_jobs_job_candidate_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Jobs table indexes
        Schema::table('jobs', function (Blueprint $table) {
            $table->dropIndex('jobs_featured_status_deadline_idx');
            $table->dropIndex('jobs_status_deadline_idx');
            $table->dropIndex('jobs_company_status_idx');
            $table->dropIndex('jobs_category_status_idx');
            $table->dropIndex('jobs_slug_idx');
        });

        // Job bookmarks table indexes
        Schema::table('job_bookmarks', function (Blueprint $table) {
            $table->dropIndex('job_bookmarks_candidate_idx');
            $table->dropIndex('job_bookmarks_candidate_job_idx');
        });

        // Companies table indexes
        Schema::table('companies', function (Blueprint $table) {
            $table->dropIndex('companies_slug_idx');
            $table->dropIndex('companies_user_idx');
        });

        // Candidates table indexes
        Schema::table('candidates', function (Blueprint $table) {
            $table->dropIndex('candidates_user_idx');
        });

        // Job categories table indexes
        Schema::table('job_categories', function (Blueprint $table) {
            $table->dropIndex('job_categories_featured_idx');
            $table->dropIndex('job_categories_popular_idx');
            $table->dropIndex('job_categories_slug_idx');
        });

        // Orders table indexes
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('orders_company_idx');
            $table->dropIndex('orders_payment_status_idx');
            $table->dropIndex('orders_company_payment_idx');
        });

        // Applied jobs table indexes
        Schema::table('applied_jobs', function (Blueprint $table) {
            $table->dropIndex('applied_jobs_job_idx');
            $table->dropIndex('applied_jobs_candidate_idx');
            $table->dropIndex('applied_jobs_job_candidate_idx');
        });
    }
};
